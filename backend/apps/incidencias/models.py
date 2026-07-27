from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Estudiante, Usuario


class TipoIncidencia(models.TextChoices):
    PROYECTOR = "proyector", "Proyector"
    PC = "pc", "Computadora"
    RED = "red", "Red / Conectividad"
    PIZARRA = "pizarra", "Pizarra digital"
    IMPRESORA = "impresora", "Impresora"
    OTRO = "otro", "Otro"


class PrioridadIncidencia(models.TextChoices):
    ALTA = "alta", "Alta"
    MEDIA = "media", "Media"
    BAJA = "baja", "Baja"


class EstadoIncidencia(models.TextChoices):
    NUEVA = "nueva", "Nueva"
    EN_ATENCION = "en_atencion", "En atención"
    RESUELTA = "resuelta", "Resuelta"
    CERRADA = "cerrada", "Cerrada"


class Incidencia(BaseModel):
    titulo = models.CharField(max_length=140)
    descripcion = models.TextField()
    ubicacion = models.CharField(
        max_length=100,
        help_text="Aula, ambiente. Ej: 'Aula 5to A', 'AIP', 'Dirección'",
    )

    tipo = models.CharField(
        max_length=20, choices=TipoIncidencia.choices, default=TipoIncidencia.OTRO
    )
    prioridad = models.CharField(
        max_length=10, choices=PrioridadIncidencia.choices, default=PrioridadIncidencia.MEDIA
    )
    estado = models.CharField(
        max_length=15, choices=EstadoIncidencia.choices, default=EstadoIncidencia.NUEVA
    )

    reportado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="incidencias_reportadas"
    )
    asignado_a = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidencias_asignadas",
    )

    fecha_atencion = models.DateTimeField(null=True, blank=True)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    notas_admin = models.TextField(blank=True)
    solucion = models.TextField(blank=True)

    foto = models.ImageField(
        upload_to="incidencias/%Y/%m/",
        blank=True,
        null=True,
        help_text="Foto del equipo o problema (JPG/PNG)",
    )

    estudiante_afectado = models.ForeignKey(
        Estudiante,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidencias_afectando",
        help_text="Estudiante directamente involucrado (opcional). "
                  "Usado para que sus padres vean la incidencia en Panel Familiar.",
    )

    class Meta:
        db_table = "incidencias"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"[{self.get_estado_display()}] {self.titulo}"


class ComentarioIncidencia(BaseModel):
    """Conversación en el hilo de una incidencia.
    Cualquier participante (docente reportante, admin TIC, director) puede comentar."""
    incidencia = models.ForeignKey(
        Incidencia, on_delete=models.CASCADE, related_name="comentarios"
    )
    autor = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="comentarios_incidencia"
    )
    texto = models.TextField()

    class Meta:
        db_table = "incidencia_comentarios"
        ordering = ["creado_en"]

    def __str__(self):
        return f"Comentario de {self.autor} en #{self.incidencia_id}"
