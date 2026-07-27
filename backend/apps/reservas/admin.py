from django.contrib import admin
from .models import Reserva


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ("id", "ambiente", "solicitante", "fecha", "hora_inicio", "hora_fin", "estado")
    list_filter = ("estado", "ambiente__tipo")
    search_fields = ("motivo", "descripcion", "solicitante__username")
    date_hierarchy = "fecha"
