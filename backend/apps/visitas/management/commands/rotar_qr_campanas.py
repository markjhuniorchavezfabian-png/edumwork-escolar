"""Rota tokens de campañas de auto-registro que hayan cumplido su ciclo.

Ejecutar diariamente vía cron:
  0 3 * * *  python manage.py rotar_qr_campanas
"""
import logging

from django.core.management.base import BaseCommand

from apps.notificaciones.servicios import notificar
from apps.usuarios.models import Rol, Usuario
from apps.visitas.models import CampanaAutoRegistro

log = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Rota el token de campañas de QR con política de rotación cumplida."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Rota TODAS las campañas activas ignorando la política.")

    def handle(self, *args, **options):
        forzar = options.get("force", False)
        campanas = CampanaAutoRegistro.objects.filter(activa=True)

        rotadas = []
        for c in campanas:
            if forzar or c.debe_rotar():
                token_antiguo = str(c.token)
                c.rotar_token()
                rotadas.append((c.pk, c.nombre, token_antiguo, str(c.token)))
                self.stdout.write(
                    self.style.SUCCESS(f"  ✔ Campaña #{c.pk} '{c.nombre}': token rotado.")
                )

        # Avisar a admin_tic + director que reimpriman el QR
        if rotadas:
            for u in Usuario.objects.filter(rol__in=[Rol.ADMIN_TIC, Rol.DIRECTOR], is_active=True):
                try:
                    notificar(
                        destinatario=u,
                        titulo=f"🔄 {len(rotadas)} QR de portería rotado(s)",
                        cuerpo=(
                            f"Se rotó el token de: {', '.join(r[1] for r in rotadas)}. "
                            "Descarga y reimprime el QR desde el módulo de Visitas para actualizar el cartel."
                        ),
                        tipo="visitas",
                        url_accion="/visitas",
                        forzar_email=True,
                    )
                except Exception as e:  # noqa: BLE001
                    log.warning(f"No se pudo notificar rotación QR a {u.username}: {e}")

        self.stdout.write(self.style.SUCCESS(
            f"\nTotal campañas rotadas: {len(rotadas)} · sin cambios: {campanas.count() - len(rotadas)}"
        ))
