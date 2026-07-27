from django.contrib import admin

from .models import ComentarioIncidencia, Incidencia


@admin.register(Incidencia)
class IncidenciaAdmin(admin.ModelAdmin):
    list_display = ("id", "titulo", "tipo", "prioridad", "estado", "ubicacion", "reportado_por", "creado_en")
    list_filter = ("estado", "tipo", "prioridad")
    search_fields = ("titulo", "descripcion", "ubicacion")
    date_hierarchy = "creado_en"


@admin.register(ComentarioIncidencia)
class ComentarioIncidenciaAdmin(admin.ModelAdmin):
    list_display = ("id", "incidencia", "autor", "creado_en")
    list_filter = ("autor__rol",)
    search_fields = ("texto",)
