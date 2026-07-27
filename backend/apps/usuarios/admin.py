from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, Docente, Estudiante, Padre, Seccion


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("username", "get_full_name", "rol", "dni", "activo", "creado_en")
    list_filter = ("rol", "activo")
    fieldsets = UserAdmin.fieldsets + (
        ("Datos I.E.", {"fields": ("rol", "dni", "telefono", "activo")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Datos I.E.", {"fields": ("rol", "dni", "telefono")}),
    )


@admin.register(Docente)
class DocenteAdmin(admin.ModelAdmin):
    list_display = ("usuario", "especialidad", "fecha_ingreso")


@admin.register(Estudiante)
class EstudianteAdmin(admin.ModelAdmin):
    list_display = ("usuario", "grado", "seccion", "codigo_matricula")


@admin.register(Padre)
class PadreAdmin(admin.ModelAdmin):
    list_display = ("usuario",)
    filter_horizontal = ("hijos",)


@admin.register(Seccion)
class SeccionAdmin(admin.ModelAdmin):
    list_display = ("nombre", "grado", "letra", "tutor", "cantidad_docentes", "cantidad_estudiantes")
    filter_horizontal = ("docentes",)

    def cantidad_docentes(self, obj):
        return obj.docentes.count()
    cantidad_docentes.short_description = "Docentes"

    def cantidad_estudiantes(self, obj):
        return obj.estudiantes.count()
    cantidad_estudiantes.short_description = "Estudiantes"
