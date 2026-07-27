from django.contrib import admin
from .models import CampanaAutoRegistro, Visita


@admin.register(Visita)
class VisitaAdmin(admin.ModelAdmin):
    list_display = ("nombre_completo", "dni", "motivo", "a_quien_visita",
                    "hora_entrada", "hora_salida", "estado", "origen")
    list_filter = ("motivo", "estado", "origen")
    search_fields = ("nombre_completo", "dni", "a_quien_visita")
    date_hierarchy = "hora_entrada"
    readonly_fields = ("codigo_gafete", "creado_en", "actualizado_en")


@admin.register(CampanaAutoRegistro)
class CampanaAutoRegistroAdmin(admin.ModelAdmin):
    list_display = ("nombre", "activa", "requiere_confirmacion",
                    "token_rota_cada_dias", "token_rotado_en", "creado_por")
    list_filter = ("activa", "requiere_confirmacion")
    search_fields = ("nombre",)
    readonly_fields = ("token", "token_rotado_en", "creado_en", "actualizado_en")
    actions = ["accion_rotar_token"]

    @admin.action(description="Rotar token de las campañas seleccionadas")
    def accion_rotar_token(self, request, queryset):
        rotadas = 0
        for c in queryset:
            c.rotar_token()
            rotadas += 1
        self.message_user(request, f"Se rotó el token de {rotadas} campaña(s).")
