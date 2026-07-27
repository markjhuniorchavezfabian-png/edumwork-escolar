from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Estudiante, Usuario


class MotivoJustificacion(models.TextChoices):
    ENFERMEDAD = "enfermedad", "Enfermedad"
    CITA_MEDICA = "cita_medica", "Cita médica / Essalud"
    TRAMITE = "tramite", "Trámite personal / RENIEC / Municipalidad"
    LUTO = "luto", "Fallecimiento familiar"
    VIAJE = "viaje", "Viaje familiar"
    ACTIVIDAD_ESCOLAR = "actividad_escolar", "Actividad escolar externa"
    OTRO = "otro", "Otro"


class EstadoJustificacion(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente de revisión"
    APROBADA = "aprobada", "Aprobada"
    RECHAZADA = "rechazada", "Rechazada"


class Justificacion(BaseModel):
    """Justificación de falta/tardanza reportada por el padre.
    Cuando el tutor aprueba, actualiza el RegistroAsistencia correspondiente."""

    estudiante = models.ForeignKey(
        Estudiante, on_delete=models.CASCADE, related_name="justificaciones"
    )
    fecha_falta = models.DateField(help_text="Fecha de la ausencia/tardanza a justificar")

    motivo = models.CharField(max_length=20, choices=MotivoJustificacion.choices)
    descripcion = models.TextField(help_text="Explicación del padre")
    constancia = models.FileField(
        upload_to="justificaciones/%Y/%m/", blank=True, null=True,
        help_text="Foto/PDF de constancia médica, oficio, etc.",
    )

    reportada_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="justificaciones_reportadas",
        help_text="Padre que reporta",
    )
    estado = models.CharField(
        max_length=15, choices=EstadoJustificacion.choices, default=EstadoJustificacion.PENDIENTE
    )
    revisada_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="justificaciones_revisadas",
    )
    fecha_revision = models.DateTimeField(null=True, blank=True)
    razon_rechazo = models.TextField(blank=True)

    class Meta:
        db_table = "justificaciones"
        ordering = ["-fecha_falta", "-creado_en"]
        unique_together = [("estudiante", "fecha_falta")]

    def __str__(self):
        return f"{self.estudiante} · {self.fecha_falta} · {self.get_estado_display()}"
