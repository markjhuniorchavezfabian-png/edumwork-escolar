from django.conf import settings
from django.db import models
from .providers import PROVIDER_CHOICES


class LLMConfig(models.Model):
    """
    Configuración de IA (BYOK).

    - Si `usuario` es NULL → configuración INSTITUCIONAL (fallback global).
      Solo director puede editarla. Se usa cuando el usuario no tiene su propia.
    - Si `usuario` es un docente/admin → su configuración personal.
      Cada docente puede poner su propia API key para no cargar a la institución.
    """
    usuario          = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="config_ia",
        help_text="NULL = configuración institucional. Con usuario = personal.",
    )
    provider         = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    api_key_cifrada  = models.TextField(blank=True, default="")
    modelo_default   = models.CharField(max_length=100)
    base_url         = models.CharField(max_length=300, blank=True, default="")
    activo           = models.BooleanField(default=True)
    ultima_prueba_ok = models.BooleanField(null=True, blank=True)
    ultima_prueba_en = models.DateTimeField(null=True, blank=True)
    creado_en        = models.DateTimeField(auto_now_add=True)
    actualizado_en   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ia_config"
        constraints = [
            models.UniqueConstraint(
                fields=["usuario"],
                condition=models.Q(activo=True),
                name="ia_config_una_activa_por_usuario",
            ),
        ]

    def __str__(self):
        alcance = f"@{self.usuario.username}" if self.usuario_id else "institucional"
        return f"{self.provider}/{self.modelo_default} ({alcance})"

    @property
    def api_key(self) -> str:
        from .crypto import descifrar
        return descifrar(self.api_key_cifrada)

    @property
    def key_enmascarada(self) -> str:
        from .crypto import descifrar, enmascarar
        return enmascarar(descifrar(self.api_key_cifrada))

    @classmethod
    def get_activa(cls):
        """Config institucional (usuario NULL). Compatibilidad con código previo."""
        return cls.objects.filter(usuario__isnull=True, activo=True).first()

    @classmethod
    def get_para(cls, usuario):
        """Devuelve la config del usuario si existe; si no, fallback a institucional.
        Retorna None si no hay ninguna."""
        if usuario and getattr(usuario, "is_authenticated", False):
            propia = cls.objects.filter(usuario=usuario, activo=True).first()
            if propia:
                return propia
        return cls.get_activa()


class LLMUsage(models.Model):
    """Registro por request para tracking de uso y costo."""
    usuario     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="ia_usage",
        help_text="Usuario que disparó la request. NULL para cron/sistema.",
    )
    con_config_propia = models.BooleanField(
        default=False,
        help_text="True si se usó la API key del propio usuario (BYOK). False si fallback institucional.",
    )
    provider    = models.CharField(max_length=20)
    modelo      = models.CharField(max_length=100)
    endpoint    = models.CharField(max_length=100)
    tokens_in   = models.IntegerField(default=0)
    tokens_out  = models.IntegerField(default=0)
    costo_usd   = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latencia_ms = models.IntegerField(default=0)
    ok          = models.BooleanField(default=True)
    error       = models.TextField(blank=True, default="")
    creado_en   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ia_usage"
        indexes  = [
            models.Index(fields=["-creado_en"]),
            models.Index(fields=["usuario", "-creado_en"]),
        ]
