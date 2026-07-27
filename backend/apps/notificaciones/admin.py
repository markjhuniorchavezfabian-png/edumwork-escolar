from django.contrib import admin
from .models import Notificacion, PreferenciasNotificacion


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ("destinatario", "tipo", "titulo", "leida", "creado_en")
    list_filter = ("tipo", "leida")
    search_fields = ("titulo", "cuerpo", "destinatario__username")


@admin.register(PreferenciasNotificacion)
class PreferenciasAdmin(admin.ModelAdmin):
    list_display = ("usuario", "recibir_email", "recibir_whatsapp")
