"""
Calendario escolar — RM 556-2024-MINEDU + normas posteriores anuales.
Norma exige mínimo 160 días lectivos + 30 días de gestión por año.
"""
from django.db import models
from apps.core.models import BaseModel


class TipoDia(models.TextChoices):
    LECTIVO = "lectivo", "Lectivo"
    GESTION = "gestion", "Semana de gestión"
    FERIADO_NACIONAL = "feriado_nacional", "Feriado nacional"
    FERIADO_REGIONAL = "feriado_regional", "Feriado regional"
    FERIADO_LOCAL = "feriado_local", "Feriado local / municipal"
    NO_LABORABLE = "no_laborable", "Día no laborable"
    SUSPENDIDO = "suspendido", "Suspendido (DRE por clima/emergencia)"


class DiaCalendario(BaseModel):
    """Registro de días especiales del año escolar.
    Los días lectivos NO se registran individualmente — se derivan de
    (rango del año escolar) - (feriados + gestión + no laborables + suspendidos).
    """
    fecha = models.DateField(unique=True)
    tipo = models.CharField(max_length=25, choices=TipoDia.choices)
    descripcion = models.CharField(max_length=200, blank=True)
    anio_lectivo = models.PositiveSmallIntegerField(db_index=True)

    class Meta:
        db_table = "calendario_dia"
        ordering = ["fecha"]
        indexes = [
            models.Index(fields=["anio_lectivo", "tipo"]),
            models.Index(fields=["fecha", "tipo"]),
        ]

    def __str__(self):
        return f"{self.fecha} · {self.get_tipo_display()} · {self.descripcion}"


class AnioEscolar(BaseModel):
    """Definición del año escolar: fecha inicio, fecha fin.
    RM 556-2024 (año 2025): 17-mar-2025 a 31-dic-2025."""
    anio = models.PositiveSmallIntegerField(unique=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    norma_referencia = models.CharField(
        max_length=100, blank=True,
        help_text="Ej: RM 556-2024-MINEDU (año 2025)",
    )
    activo = models.BooleanField(default=False)

    class Meta:
        db_table = "calendario_anio_escolar"
        ordering = ["-anio"]

    def __str__(self):
        return f"Año {self.anio}: {self.fecha_inicio} → {self.fecha_fin}"
