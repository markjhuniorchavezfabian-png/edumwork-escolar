from django.contrib import admin

from .models import Curso, Entrega, Leccion, Recurso, Tarea


@admin.register(Curso)
class CursoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "docente", "area", "activo", "creado_en")
    list_filter = ("area", "activo")
    search_fields = ("titulo", "descripcion", "docente__username")
    filter_horizontal = ("secciones",)


@admin.register(Leccion)
class LeccionAdmin(admin.ModelAdmin):
    list_display = ("titulo", "curso", "orden", "publicada")
    list_filter = ("publicada", "curso")
    search_fields = ("titulo", "contenido")


@admin.register(Recurso)
class RecursoAdmin(admin.ModelAdmin):
    list_display = ("titulo", "leccion", "tipo", "orden")
    list_filter = ("tipo",)


@admin.register(Tarea)
class TareaAdmin(admin.ModelAdmin):
    list_display = ("titulo", "curso", "fecha_entrega", "puntaje_maximo", "publicada")
    list_filter = ("publicada", "curso")


@admin.register(Entrega)
class EntregaAdmin(admin.ModelAdmin):
    list_display = ("tarea", "estudiante", "estado", "nota", "entregada_en")
    list_filter = ("estado",)
    readonly_fields = ("entregada_en",)
