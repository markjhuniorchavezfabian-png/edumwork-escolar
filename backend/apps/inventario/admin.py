from django.contrib import admin
from .models import Equipo


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):
    list_display = ("codigo_inventario", "tipo", "marca", "modelo", "ubicacion", "estado")
    list_filter = ("estado", "tipo", "ubicacion")
    search_fields = ("codigo_inventario", "marca", "modelo", "numero_serie")
