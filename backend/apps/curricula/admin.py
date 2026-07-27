from django.contrib import admin

from .models import AreaCurricular, Capacidad, Competencia, Desempeno


class CapacidadInline(admin.TabularInline):
    model = Capacidad
    extra = 0


class CompetenciaInline(admin.TabularInline):
    model = Competencia
    extra = 0


@admin.register(AreaCurricular)
class AreaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "nivel", "orden"]
    list_filter = ["nivel"]
    inlines = [CompetenciaInline]


@admin.register(Competencia)
class CompetenciaAdmin(admin.ModelAdmin):
    list_display = ["area", "numero", "nombre"]
    list_filter = ["area__nivel", "area"]
    inlines = [CapacidadInline]


@admin.register(Capacidad)
class CapacidadAdmin(admin.ModelAdmin):
    list_display = ["competencia", "nombre", "orden"]
    list_filter = ["competencia__area__nivel"]


@admin.register(Desempeno)
class DesempenoAdmin(admin.ModelAdmin):
    list_display = ["competencia", "grado", "orden", "descripcion"]
    list_filter = ["grado"]
