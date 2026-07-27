"""Signals: comprimir imágenes al guardar en modelos con foto/constancia/adjunto."""
import logging

from django.core.exceptions import ValidationError
from django.db.models.signals import pre_save
from django.dispatch import receiver

from .imagenes import comprimir_imagen_field, validar_tamano_archivo

log = logging.getLogger(__name__)


def _procesar_field(instance, campo):
    field_file = getattr(instance, campo, None)
    if not field_file or not field_file.name:
        return
    # Solo procesar si es un archivo NUEVO (no ya guardado en disco)
    if not hasattr(field_file, "file") or not hasattr(field_file.file, "read"):
        return
    try:
        validar_tamano_archivo(field_file)
    except ValidationError as e:
        # No podemos abortar el save desde el signal; validación real vive en la vista.
        log.warning(
            "Archivo excede tamaño máximo (%s en %s.%s): %s",
            field_file.name, instance.__class__.__name__, campo, e,
        )
    except (OSError, ValueError) as e:
        log.warning("Error leyendo archivo %s.%s (%s): %s", instance.__class__.__name__, campo, field_file.name, e)
    try:
        comprimir_imagen_field(field_file)
    except (OSError, ValueError) as e:
        log.warning("No se pudo comprimir %s.%s (%s): %s", instance.__class__.__name__, campo, field_file.name, e)


def registrar_compresion():
    """Se llama en apps/core/apps.py::ready()."""
    from apps.incidencias.models import Incidencia
    from apps.justificaciones.models import Justificacion
    from apps.convivencia.models import SeguimientoCaso
    from apps.comunicados.models import Comunicado
    from apps.asistencia_personal.models import RegistroPersonal

    @receiver(pre_save, sender=Incidencia, weak=False)
    def _incidencia(sender, instance, **kw):
        _procesar_field(instance, "foto")

    @receiver(pre_save, sender=Justificacion, weak=False)
    def _justificacion(sender, instance, **kw):
        _procesar_field(instance, "constancia")

    @receiver(pre_save, sender=SeguimientoCaso, weak=False)
    def _seguimiento(sender, instance, **kw):
        _procesar_field(instance, "adjunto")

    @receiver(pre_save, sender=Comunicado, weak=False)
    def _comunicado(sender, instance, **kw):
        _procesar_field(instance, "adjunto")

    @receiver(pre_save, sender=RegistroPersonal, weak=False)
    def _personal(sender, instance, **kw):
        _procesar_field(instance, "documento_licencia")
