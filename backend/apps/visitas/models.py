import uuid

from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Usuario


class MotivoVisita(models.TextChoices):
    APODERADO = "apoderado", "Apoderado / Padre de familia"
    PROVEEDOR = "proveedor", "Proveedor / Servicio técnico"
    UGEL = "ugel", "UGEL / DRE / MINEDU"
    AUTORIDAD = "autoridad", "Autoridad municipal / regional"
    ENTREVISTA = "entrevista", "Entrevista de trabajo"
    OTRO = "otro", "Otro"


class OrigenVisita(models.TextChoices):
    PORTERIA = "porteria", "Registrada en portería"
    AUTO_REGISTRO = "auto", "Auto-registro por QR"


class EstadoVisita(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente de confirmación"
    CONFIRMADA = "confirmada", "Confirmada"


class CampanaAutoRegistro(BaseModel):
    """Configuración del QR permanente en portería para auto-registro.
    Permite habilitar/deshabilitar el auto-registro y decidir si requiere
    confirmación humana (para reuniones especiales, etc.)."""
    nombre = models.CharField(max_length=100, default="Auto-registro portería")
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    activa = models.BooleanField(default=True)
    requiere_confirmacion = models.BooleanField(
        default=False,
        help_text="Si es True, cada visita queda pendiente hasta que el conserje confirme",
    )
    motivo_forzado = models.CharField(
        max_length=20, choices=MotivoVisita.choices, blank=True,
        help_text="Si se llena, el visitante NO elige motivo — se aplica este por defecto",
    )
    a_quien_visita_forzado = models.CharField(max_length=200, blank=True)
    mensaje_bienvenida = models.TextField(blank=True, help_text="Mensaje que ve el visitante al escanear")
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="campanas_qr",
    )

    token_rota_cada_dias = models.PositiveIntegerField(
        default=0,
        help_text="Si es >0, el token se rota automáticamente cada N días "
                  "(comando 'rotar_qr_campanas'). Recomendado: 30 para porterías.",
    )
    token_rotado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "visitas_campanas_qr"

    def __str__(self):
        return f"{self.nombre} ({'activa' if self.activa else 'inactiva'})"

    def debe_rotar(self):
        """True si el token debería rotarse ahora según la política."""
        if not self.token_rota_cada_dias or self.token_rota_cada_dias <= 0:
            return False
        from django.utils import timezone
        from datetime import timedelta
        ref = self.token_rotado_en or self.creado_en
        return (timezone.now() - ref) >= timedelta(days=self.token_rota_cada_dias)

    def rotar_token(self):
        """Genera nuevo token y guarda fecha de rotación."""
        from django.utils import timezone
        self.token = uuid.uuid4()
        self.token_rotado_en = timezone.now()
        self.save(update_fields=["token", "token_rotado_en"])


class Visita(BaseModel):
    """Registro de visita a la institución con gafete QR."""
    codigo_gafete = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    dni = models.CharField(max_length=8)
    nombre_completo = models.CharField(max_length=200)
    telefono = models.CharField(max_length=15, blank=True)

    motivo = models.CharField(max_length=20, choices=MotivoVisita.choices, default=MotivoVisita.OTRO)
    a_quien_visita = models.CharField(max_length=200, help_text="Nombre del anfitrión o cargo")
    observaciones = models.TextField(blank=True)

    hora_entrada = models.DateTimeField(auto_now_add=True)
    hora_salida = models.DateTimeField(null=True, blank=True)

    origen = models.CharField(
        max_length=15, choices=OrigenVisita.choices, default=OrigenVisita.PORTERIA
    )
    estado = models.CharField(
        max_length=15, choices=EstadoVisita.choices, default=EstadoVisita.CONFIRMADA,
    )
    campana = models.ForeignKey(
        CampanaAutoRegistro, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="visitas",
    )

    registrado_por = models.ForeignKey(
        Usuario,
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name="visitas_registradas",
    )
    salida_registrada_por = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visitas_salida_registradas",
    )

    class Meta:
        db_table = "visitas"
        ordering = ["-hora_entrada"]
        indexes = [
            models.Index(fields=["-hora_entrada"]),
            models.Index(fields=["hora_salida"]),
        ]

    def __str__(self):
        return f"{self.nombre_completo} → {self.a_quien_visita} ({self.hora_entrada:%Y-%m-%d %H:%M})"

    @property
    def dentro(self) -> bool:
        return self.hora_salida is None

    @property
    def duracion_minutos(self) -> int | None:
        if not self.hora_salida:
            return None
        return int((self.hora_salida - self.hora_entrada).total_seconds() // 60)
