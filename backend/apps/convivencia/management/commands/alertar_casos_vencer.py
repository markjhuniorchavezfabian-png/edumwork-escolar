"""Alerta a dirección y responsable de casos de convivencia próximos a vencer plazo legal.

Ejecutar diariamente vía cron:
  0 7 * * *  python manage.py alertar_casos_vencer
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.convivencia.models import CasoConvivencia, EstadoCaso
from apps.notificaciones.servicios import notificar
from apps.usuarios.models import Rol, Usuario

log = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Notifica al director, subdirector y responsable de casos que están por vencer plazo legal (30 días MINEDU)."

    def handle(self, *args, **options):
        activos = CasoConvivencia.objects.exclude(
            estado__in=[EstadoCaso.CERRADO, EstadoCaso.CERRADO_FALSO]
        ).select_related("responsable")

        alertados = 0
        vencidos = 0
        for caso in activos:
            nivel = caso.alerta_plazo
            if nivel == "ninguna":
                continue
            if nivel == "vencido":
                vencidos += 1

            destinatarios = set()
            if caso.responsable_id:
                destinatarios.add(caso.responsable)
            for u in Usuario.objects.filter(rol__in=[Rol.DIRECTOR, Rol.SUBDIRECTOR], is_active=True):
                destinatarios.add(u)

            titulo = {
                "vencido": f"⛔ Caso {caso.codigo} VENCIÓ plazo legal",
                "urgente": f"🚨 Caso {caso.codigo} vence en ≤5 días",
                "proximo": f"⏰ Caso {caso.codigo} vence en ≤10 días",
            }[nivel]
            cuerpo = (
                f"Tipo: {caso.get_tipo_display()} · Gravedad: {caso.get_gravedad_display()}\n"
                f"Ubicación: {caso.ubicacion}\n"
                f"Días restantes: {caso.dias_restantes}\n"
                f"Fecha límite: {timezone.localtime(caso.fecha_limite):%d/%m/%Y}"
            )
            for u in destinatarios:
                try:
                    notificar(
                        destinatario=u,
                        titulo=titulo,
                        cuerpo=cuerpo,
                        tipo="convivencia",
                        url_accion=f"/convivencia?caso={caso.id}",
                        forzar_email=(nivel in ("urgente", "vencido")),
                    )
                    alertados += 1
                except Exception as e:  # noqa: BLE001
                    log.warning(f"No se pudo alertar sobre caso {caso.codigo} a {u.username}: {e}")

        self.stdout.write(self.style.SUCCESS(
            f"Alertas enviadas: {alertados} · casos vencidos: {vencidos}"
        ))
