"""Signals: cuando se crea/actualiza un RegistroAsistencia, notifica a los padres."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.asistencia.models import RegistroAsistencia
from apps.usuarios.models import Padre

from .servicios import notificar


ETIQUETA_ESTADO = {
    "presente": "presente ✓",
    "tardanza": "con tardanza ⚠",
    "ausente": "ausente ✗",
    "justificado": "con inasistencia justificada",
}


@receiver(post_save, sender=RegistroAsistencia)
def notificar_asistencia_a_padres(sender, instance: RegistroAsistencia, created, **kwargs):
    """Al crear/actualizar asistencia, notifica al/los padres del estudiante."""
    try:
        estudiante = instance.estudiante
        padres = Padre.objects.filter(hijos=estudiante).select_related("usuario")

        nombre_est = estudiante.usuario.get_full_name() or estudiante.usuario.username
        etiq = ETIQUETA_ESTADO.get(instance.estado, instance.estado)
        hora = instance.hora_llegada.strftime("%H:%M") if instance.hora_llegada else "sin registro de hora"
        fecha = instance.fecha.strftime("%d/%m/%Y")

        titulo = f"Asistencia de {estudiante.usuario.first_name}: {etiq}"
        cuerpo = (
            f"Su hijo/a {nombre_est} figura como {etiq} el {fecha}.\n"
            f"Hora de llegada: {hora}."
        )
        if instance.justificacion:
            cuerpo += f"\nJustificación: {instance.justificacion}"

        for padre in padres:
            if padre.usuario.activo:
                notificar(
                    destinatario=padre.usuario,
                    titulo=titulo,
                    cuerpo=cuerpo,
                    tipo="asistencia",
                    url_accion="/asistencia",
                )
    except Exception:
        # No interrumpimos la operación si algo falla
        import logging
        logging.getLogger(__name__).exception("Error notificando asistencia")
