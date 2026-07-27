from django.contrib import admin
from .models import LLMConfig, LLMUsage


@admin.register(LLMConfig)
class LLMConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "provider", "modelo_default", "usuario", "activo",
                    "ultima_prueba_ok", "actualizado_en")
    list_filter = ("provider", "activo", "ultima_prueba_ok")
    search_fields = ("usuario__username", "modelo_default")
    readonly_fields = ("api_key_cifrada", "ultima_prueba_ok", "ultima_prueba_en",
                       "creado_en", "actualizado_en")


@admin.register(LLMUsage)
class LLMUsageAdmin(admin.ModelAdmin):
    list_display = ("creado_en", "usuario", "con_config_propia", "provider",
                    "endpoint", "tokens_in", "tokens_out", "costo_usd", "ok")
    list_filter = ("provider", "endpoint", "ok", "con_config_propia")
    search_fields = ("usuario__username",)
    date_hierarchy = "creado_en"
    readonly_fields = tuple(f.name for f in LLMUsage._meta.fields)
