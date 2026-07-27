from django.contrib import admin

from .models import RegistroAsistencia


@admin.register(RegistroAsistencia)
class RegistroAsistenciaAdmin(admin.ModelAdmin):
    list_display = ("id", "estudiante", "fecha", "estado", "hora_llegada", "marcado_por")
    list_filter = ("estado", "fecha")
    search_fields = ("estudiante__usuario__first_name", "estudiante__usuario__last_name")
    date_hierarchy = "fecha"
