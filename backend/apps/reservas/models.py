from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Usuario


class EstadoReserva(models.TextChoices):
    SOLICITADA = "solicitada", "Solicitada"
    APROBADA = "aprobada", "Aprobada"
    RECHAZADA = "rechazada", "Rechazada"
    CANCELADA = "cancelada", "Cancelada por el solicitante"
    COMPLETADA = "completada", "Completada"


class Reserva(BaseModel):
    ambiente = models.ForeignKey(
        "ambientes.Ambiente", on_delete=models.PROTECT, related_name="reservas"
    )
    solicitante = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="reservas_solicitadas"
    )

    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    motivo = models.CharField(max_length=200, help_text="Ej: 'Clase de laboratorio de física - 3ro A'")
    descripcion = models.TextField(blank=True)
    participantes_estimados = models.PositiveIntegerField(null=True, blank=True)

    estado = models.CharField(
        max_length=15, choices=EstadoReserva.choices, default=EstadoReserva.SOLICITADA
    )
    revisado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reservas_revisadas",
    )
    fecha_revision = models.DateTimeField(null=True, blank=True)
    razon_rechazo = models.TextField(blank=True)

    class Meta:
        db_table = "reservas"
        ordering = ["-fecha", "hora_inicio"]
        indexes = [
            models.Index(fields=["ambiente", "fecha", "estado"]),
            models.Index(fields=["solicitante", "-fecha"]),
        ]

    def __str__(self):
        return f"{self.ambiente.nombre} · {self.fecha} {self.hora_inicio}-{self.hora_fin} ({self.get_estado_display()})"

    def hay_conflicto(self):
        """Devuelve QuerySet de reservas aprobadas que se solapan con esta."""
        return Reserva.objects.filter(
            ambiente=self.ambiente,
            fecha=self.fecha,
            estado=EstadoReserva.APROBADA,
            hora_inicio__lt=self.hora_fin,
            hora_fin__gt=self.hora_inicio,
        ).exclude(pk=self.pk or 0)
