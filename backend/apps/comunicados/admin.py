from django.contrib import admin
from .models import Comunicado, LecturaComunicado


@admin.register(Comunicado)
class ComunicadoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "categoria", "alcance", "autor", "fecha_publicacion", "activo")
    list_filter = ("categoria", "alcance", "activo")
    search_fields = ("titulo", "cuerpo")


@admin.register(LecturaComunicado)
class LecturaComunicadoAdmin(admin.ModelAdmin):
    list_display = ("comunicado", "usuario", "leido_en")
    list_filter = ("comunicado__categoria",)
