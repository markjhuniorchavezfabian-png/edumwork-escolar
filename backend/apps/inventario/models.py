from django.db import models

from apps.core.models import BaseModel


class TipoEquipo(models.TextChoices):
    PC = "pc", "Computadora"
    LAPTOP = "laptop", "Laptop"
    PROYECTOR = "proyector", "Proyector"
    PIZARRA = "pizarra", "Pizarra digital"
    IMPRESORA = "impresora", "Impresora"
    TABLET = "tablet", "Tablet"
    SWITCH = "switch", "Switch de red"
    ROUTER = "router", "Router / Access Point"
    SERVIDOR = "servidor", "Servidor"
    OTRO = "otro", "Otro"


class EstadoEquipo(models.TextChoices):
    OPERATIVO = "operativo", "Operativo"
    MANTENIMIENTO = "mantenimiento", "En mantenimiento"
    REPARACION = "reparacion", "En reparación"
    BAJA = "baja", "Dado de baja"


class Equipo(BaseModel):
    codigo_inventario = models.CharField(max_length=50, unique=True)
    tipo = models.CharField(max_length=20, choices=TipoEquipo.choices, default=TipoEquipo.OTRO)
    marca = models.CharField(max_length=60, blank=True)
    modelo = models.CharField(max_length=100, blank=True)
    numero_serie = models.CharField(max_length=100, blank=True)
    ubicacion = models.CharField(max_length=100, help_text="Ubicación textual (legacy)")
    ambiente = models.ForeignKey(
        "ambientes.Ambiente",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="equipos",
        help_text="Ambiente físico donde está el equipo",
    )
    estado = models.CharField(
        max_length=20, choices=EstadoEquipo.choices, default=EstadoEquipo.OPERATIVO
    )
    fecha_adquisicion = models.DateField(null=True, blank=True)
    valor_referencial = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        db_table = "inventario_equipos"
        ordering = ["ubicacion", "tipo", "codigo_inventario"]

    def __str__(self):
        return f"{self.codigo_inventario} - {self.get_tipo_display()}"
