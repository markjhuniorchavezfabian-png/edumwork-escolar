from django.db import models

from apps.usuarios.models import Usuario


class TipoAccion(models.TextChoices):
    CREAR = "crear", "Crear"
    ACTUALIZAR = "actualizar", "Actualizar"
    ELIMINAR = "eliminar", "Eliminar"
    ACCION = "accion", "Acción"


class Auditoria(models.Model):
    """Bitácora ISO 9001 / NIST CSF 2.0 GV.OC.
    Cada operación relevante deja registro con quién, cuándo, qué y cambios."""
    usuario = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True,
        related_name="acciones_auditoria",
    )
    usuario_username = models.CharField(max_length=150, blank=True)
    tipo = models.CharField(max_length=20, choices=TipoAccion.choices)
    modelo = models.CharField(max_length=100, help_text="Ej: 'Incidencia', 'Equipo'")
    objeto_id = models.CharField(max_length=50, blank=True)
    descripcion = models.CharField(max_length=250, blank=True)
    cambios = models.JSONField(default=dict, blank=True)
    ip_origen = models.GenericIPAddressField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auditoria"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["-creado_en"]),
            models.Index(fields=["modelo", "objeto_id"]),
            models.Index(fields=["usuario", "-creado_en"]),
        ]

    def __str__(self):
        return f"[{self.creado_en:%Y-%m-%d %H:%M}] {self.usuario_username} · {self.tipo} · {self.modelo}"
