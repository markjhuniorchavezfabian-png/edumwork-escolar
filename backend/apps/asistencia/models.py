from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Estudiante, Seccion, Usuario


class EstadoAsistencia(models.TextChoices):
    PRESENTE = "presente", "Presente"
    TARDANZA = "tardanza", "Tardanza"
    AUSENTE = "ausente", "Ausente"
    JUSTIFICADO = "justificado", "Justificado"


class RegistroAsistencia(BaseModel):
    """Un registro por estudiante por fecha (asistencia general diaria)."""
    estudiante = models.ForeignKey(
        Estudiante, on_delete=models.CASCADE, related_name="asistencias"
    )
    fecha = models.DateField()
    estado = models.CharField(
        max_length=15, choices=EstadoAsistencia.choices, default=EstadoAsistencia.PRESENTE
    )
    hora_llegada = models.TimeField(null=True, blank=True)
    justificacion = models.TextField(blank=True)
    marcado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="asistencias_marcadas"
    )

    class Meta:
        db_table = "asistencia_registros"
        unique_together = [("estudiante", "fecha")]
        ordering = ["-fecha", "estudiante_id"]
        indexes = [
            models.Index(fields=["-fecha"]),
            models.Index(fields=["estudiante", "-fecha"]),
            models.Index(fields=["fecha", "estado"]),
        ]

    def __str__(self):
        return f"{self.estudiante} - {self.fecha} - {self.get_estado_display()}"


class SesionClase(BaseModel):
    """Una sesión de clase específica en un ambiente concreto.
    Ej: 'Química en Laboratorio de Química, 10:00-11:30, sección 5to A'.

    Permite monitorear USO REAL de ambientes especiales (AIP, laboratorios,
    biblioteca) y justificar inversión ante UGEL / GOREHCO."""
    ambiente = models.ForeignKey(
        "ambientes.Ambiente", on_delete=models.PROTECT, related_name="sesiones",
    )
    docente = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="sesiones_dictadas",
    )
    seccion = models.ForeignKey(
        Seccion, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="sesiones",
    )
    area_curricular = models.CharField(max_length=100, blank=True, help_text="Área según CNEB")
    competencia_cneb = models.ForeignKey(
        "curricula.Competencia", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sesiones",
    )
    capacidad_cneb = models.ForeignKey(
        "curricula.Capacidad", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="sesiones",
    )
    tema = models.CharField(max_length=200, blank=True)
    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField(null=True, blank=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        db_table = "sesiones_clase"
        ordering = ["-fecha", "-hora_inicio"]
        indexes = [
            models.Index(fields=["ambiente", "-fecha"]),
            models.Index(fields=["docente", "-fecha"]),
        ]

    def __str__(self):
        return f"{self.ambiente.nombre} · {self.fecha} {self.hora_inicio}"

    @property
    def duracion_minutos(self):
        if not self.hora_fin:
            return None
        from datetime import datetime, date
        dt_i = datetime.combine(date.today(), self.hora_inicio)
        dt_f = datetime.combine(date.today(), self.hora_fin)
        return int((dt_f - dt_i).total_seconds() // 60)


class AsistenciaSesion(BaseModel):
    """Presencia de un estudiante en una sesión específica.
    Complementa RegistroAsistencia (que es la asistencia general del día)."""
    sesion = models.ForeignKey(
        SesionClase, on_delete=models.CASCADE, related_name="asistencias",
    )
    estudiante = models.ForeignKey(
        Estudiante, on_delete=models.CASCADE, related_name="asistencias_sesion",
    )
    presente = models.BooleanField(default=True)
    hora_llegada = models.TimeField(null=True, blank=True)
    marcado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="+",
    )

    class Meta:
        db_table = "asistencia_sesion"
        unique_together = [("sesion", "estudiante")]
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.estudiante} · sesión {self.sesion_id}"
