from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Seccion, Usuario


class CategoriaComunicado(models.TextChoices):
    ACADEMICO = "academico", "Académico"
    ADMINISTRATIVO = "administrativo", "Administrativo"
    ACTIVIDAD = "actividad", "Actividad / Evento"
    RECORDATORIO = "recordatorio", "Recordatorio"
    CONVOCATORIA = "convocatoria", "Convocatoria"
    EMERGENCIA = "emergencia", "Emergencia / Urgente"


class AlcanceComunicado(models.TextChoices):
    TODA_IE = "toda_ie", "Toda la institución"
    SECCION = "seccion", "Sección específica"
    STAFF = "staff", "Solo personal"
    PADRES = "padres", "Solo padres de familia"


class Comunicado(BaseModel):
    titulo = models.CharField(max_length=200)
    cuerpo = models.TextField()
    categoria = models.CharField(
        max_length=20, choices=CategoriaComunicado.choices, default=CategoriaComunicado.ACADEMICO
    )
    alcance = models.CharField(
        max_length=20, choices=AlcanceComunicado.choices, default=AlcanceComunicado.TODA_IE
    )
    seccion = models.ForeignKey(
        Seccion, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="comunicados",
        help_text="Requerido si alcance='seccion'",
    )
    fecha_publicacion = models.DateTimeField(auto_now_add=True)
    fecha_evento = models.DateField(null=True, blank=True, help_text="Fecha a la que refiere el comunicado (opcional)")

    autor = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="comunicados_publicados"
    )
    adjunto = models.FileField(upload_to="comunicados/%Y/%m/", blank=True, null=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "comunicados"
        ordering = ["-fecha_publicacion"]

    def __str__(self):
        return self.titulo


class LecturaComunicado(models.Model):
    """Registro de quién y cuándo leyó cada comunicado.
    Un registro por (comunicado, usuario). Se crea en el momento en que
    el usuario abre el detalle del comunicado en la app."""
    comunicado = models.ForeignKey(
        Comunicado, on_delete=models.CASCADE, related_name="lecturas"
    )
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="lecturas_comunicados"
    )
    leido_en = models.DateTimeField(auto_now_add=True)
    ip_origen = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "comunicado_lecturas"
        unique_together = [("comunicado", "usuario")]
        ordering = ["-leido_en"]
        indexes = [
            models.Index(fields=["comunicado", "usuario"]),
        ]

    def __str__(self):
        return f"{self.usuario} leyó '{self.comunicado.titulo}' el {self.leido_en:%Y-%m-%d %H:%M}"
