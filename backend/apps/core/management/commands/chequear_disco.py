"""Avisa al director y al admin TIC cuando el disco del servidor se está llenando.

Un VPS de colegio no tiene a nadie mirándolo. Si el disco llega al 100%,
Postgres deja de aceptar escrituras: nadie puede marcar asistencia ni cargar
notas, y el mensaje de error no dice "disco lleno" — dice cualquier cosa. Este
comando convierte eso en un aviso con semanas de anticipación.

Ejecutar diariamente vía cron:
    30 6 * * *  python manage.py chequear_disco

La notificación es in-app (no depende de que el colegio tenga SMTP configurado);
si hay email configurado, además sale por correo.
"""

import logging
import shutil

from django.core.management.base import BaseCommand

from apps.notificaciones.servicios import notificar
from apps.usuarios.models import Rol, Usuario

log = logging.getLogger(__name__)

GB = 1024 ** 3


class Command(BaseCommand):
    help = "Notifica a dirección si el uso de disco supera el umbral (default 80%)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--umbral", type=int, default=80,
            help="Porcentaje de uso a partir del cual avisa. Default: 80.",
        )
        parser.add_argument(
            "--ruta", default="/",
            help="Punto de montaje a revisar. Default: /.",
        )

    def handle(self, *args, **opts):
        umbral, ruta = opts["umbral"], opts["ruta"]
        uso = shutil.disk_usage(ruta)
        pct = round(uso.used / uso.total * 100)
        libre_gb = uso.free / GB

        self.stdout.write(
            f"{ruta}: {pct}% usado · {libre_gb:.1f} GB libres de {uso.total / GB:.1f} GB"
        )

        if pct < umbral:
            self.stdout.write(self.style.SUCCESS(f"Por debajo del umbral ({umbral}%)."))
            return

        critico = pct >= 90
        titulo = (
            f"⛔ Disco del servidor al {pct}%" if critico
            else f"⚠️ Disco del servidor al {pct}%"
        )
        cuerpo = (
            f"Quedan {libre_gb:.1f} GB libres. Si el disco se llena, el sistema deja de "
            f"guardar asistencia, notas y archivos.\n\n"
            f"Qué hacer: avisa al proveedor del sistema para liberar espacio "
            f"(purgar bitácora vieja, revisar backups y archivos adjuntos) o ampliar "
            f"el disco del servidor."
        )

        destinatarios = Usuario.objects.filter(
            rol__in=[Rol.DIRECTOR, Rol.SUBDIRECTOR, Rol.ADMIN_TIC], is_active=True,
        )
        enviadas = 0
        for u in destinatarios:
            # Un disco lleno tumba el sistema entero: se fuerza el email aunque
            # el usuario tenga los avisos por correo apagados.
            if notificar(u, titulo, cuerpo, tipo="general", forzar_email=critico):
                enviadas += 1

        log.warning("Disco al %s%% en %s — %s avisos enviados", pct, ruta, enviadas)
        self.stdout.write(self.style.WARNING(
            f"Umbral superado. {enviadas} avisos enviados."
        ))
