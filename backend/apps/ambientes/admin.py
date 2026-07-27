from django.contrib import admin
from .models import Ambiente


@admin.register(Ambiente)
class AmbienteAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "tipo", "piso", "capacidad", "reservable", "activo")
    list_filter = ("tipo", "reservable", "activo")
    search_fields = ("nombre", "codigo")
