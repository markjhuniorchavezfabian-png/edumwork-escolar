from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Usuario


class EstadoAsistenciaPersonal(models.TextChoices):
    ASISTIO = "asistio", "Asistió"
    TARDANZA = "tardanza", "Tardanza"
    AUSENTE = "ausente", "Ausente"
    LICENCIA = "licencia", "Con licencia"
    COMISION = "comision", "Comisión de servicios"
    FERIADO = "feriado", "Feriado"


class RegistroPersonal(BaseModel):
    """Registro diario de asistencia laboral del personal."""
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="asistencias_personal",
    )
    fecha = models.DateField()
    hora_entrada = models.TimeField(null=True, blank=True)
    hora_salida = models.TimeField(null=True, blank=True)
    estado = models.CharField(
        max_length=15,
        choices=EstadoAsistenciaPersonal.choices,
        default=EstadoAsistenciaPersonal.ASISTIO,
    )
    observaciones = models.TextField(blank=True)
    documento_licencia = models.FileField(
        upload_to="asistencia_personal/licencias/%Y/%m/", blank=True, null=True,
        help_text="Resolución de licencia, comisión de servicios, etc.",
    )
    marcado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="asistencias_personal_marcadas",
        help_text="Si es distinto del usuario, alguien lo marcó por él (excepción)",
    )
    # Metadata
    auto_tardanza = models.BooleanField(
        default=False,
        help_text="Marcado automáticamente como tardanza según la hora tope",
    )
    # Verificación GPS
    lat_entrada = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    lng_entrada = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    distancia_metros = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Distancia al centro de la I.E. (metros). Null si no dio GPS.",
    )
    sin_geo = models.BooleanField(
        default=False,
        help_text="El usuario marcó sin permiso GPS (excepción documentada).",
    )

    class Meta:
        db_table = "asistencia_personal_registros"
        unique_together = [("usuario", "fecha")]
        ordering = ["-fecha", "usuario_id"]
        indexes = [
            models.Index(fields=["-fecha"]),
            models.Index(fields=["usuario", "-fecha"]),
        ]

    def __str__(self):
        return f"{self.usuario} · {self.fecha} · {self.get_estado_display()}"
