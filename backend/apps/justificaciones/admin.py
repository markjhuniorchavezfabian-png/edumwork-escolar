from django.contrib import admin
from .models import Justificacion


@admin.register(Justificacion)
class JustificacionAdmin(admin.ModelAdmin):
    list_display = ("estudiante", "fecha_falta", "motivo", "estado", "reportada_por", "revisada_por")
    list_filter = ("estado", "motivo")
    date_hierarchy = "fecha_falta"
    search_fields = ("estudiante__usuario__first_name", "estudiante__usuario__last_name")
