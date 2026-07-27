from django.contrib import admin
from .models import CasoConvivencia, SeguimientoCaso


@admin.register(CasoConvivencia)
class CasoConvivenciaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "tipo", "estado", "gravedad", "fecha_reporte", "dias_restantes", "reportado_siseve")
    list_filter = ("estado", "tipo", "gravedad", "reportado_siseve")
    search_fields = ("codigo", "descripcion", "ubicacion")
    date_hierarchy = "fecha_reporte"


@admin.register(SeguimientoCaso)
class SeguimientoCasoAdmin(admin.ModelAdmin):
    list_display = ("caso", "accion", "autor", "creado_en")
    list_filter = ("accion",)
