from django.db import models
from apps.usuarios.models import Usuario


class CanalNotificacion(models.TextChoices):
    APP = "app", "En la aplicación"
    EMAIL = "email", "Correo electrónico"
    WHATSAPP = "whatsapp", "WhatsApp (futuro)"


class TipoNotificacion(models.TextChoices):
    ASISTENCIA = "asistencia", "Asistencia"
    COMUNICADO = "comunicado", "Comunicado"
    INCIDENCIA = "incidencia", "Incidencia"
    CONVIVENCIA = "convivencia", "Convivencia"
    VISITA = "visita", "Visita"
    RESERVA = "reserva", "Reserva"
    GENERAL = "general", "General"


class Notificacion(models.Model):
    """Notificación in-app (base). Puede replicarse en email/whatsapp según preferencias del usuario."""
    destinatario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="notificaciones"
    )
    tipo = models.CharField(max_length=20, choices=TipoNotificacion.choices, default=TipoNotificacion.GENERAL)
    titulo = models.CharField(max_length=200)
    cuerpo = models.TextField()
    url_accion = models.CharField(max_length=300, blank=True, help_text="URL relativa opcional")

    leida = models.BooleanField(default=False)
    fecha_leida = models.DateTimeField(null=True, blank=True)

    canales_enviados = models.CharField(
        max_length=100, blank=True,
        help_text="Lista separada por coma con los canales por los que se envió",
    )

    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notificaciones"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["destinatario", "leida", "-creado_en"]),
        ]

    def __str__(self):
        return f"[{self.tipo}] {self.destinatario} · {self.titulo[:40]}"


class PreferenciasNotificacion(models.Model):
    """Cómo prefiere ser notificado cada usuario. Por defecto: solo in-app + email."""
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="preferencias_notif"
    )
    recibir_asistencia = models.BooleanField(default=True)
    recibir_comunicados = models.BooleanField(default=True)
    recibir_incidencias = models.BooleanField(default=True)
    recibir_convivencia = models.BooleanField(default=True)
    recibir_email = models.BooleanField(default=True)
    recibir_whatsapp = models.BooleanField(default=False)  # Fase futura

    class Meta:
        db_table = "notif_preferencias"

    def __str__(self):
        return f"Prefs de {self.usuario}"
