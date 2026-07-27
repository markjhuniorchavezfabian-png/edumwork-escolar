from django.contrib import admin
from .models import RegistroPersonal


@admin.register(RegistroPersonal)
class RegistroPersonalAdmin(admin.ModelAdmin):
    list_display = ("usuario", "fecha", "hora_entrada", "hora_salida", "estado", "auto_tardanza")
    list_filter = ("estado", "auto_tardanza")
    date_hierarchy = "fecha"
    search_fields = ("usuario__username", "usuario__first_name", "usuario__last_name")
