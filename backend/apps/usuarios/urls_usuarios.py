from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    FichaApoderadoViewSet,
    FichaEstudianteViewSet,
    SeccionViewSet,
    UsuarioViewSet,
    cambiar_password,
    cambiar_situacion_matricula,
    catalogo_roles,
    confirmar_reset_password,
    generar_codigo_recuperacion,
    recuperar_con_codigo,
    descargar_credenciales,
    descargar_template_docentes,
    imprimir_lista_seccion,
    descargar_template_estudiantes,
    descargar_template_padres,
    importar_docentes_endpoint,
    importar_estudiantes_endpoint,
    importar_padres_endpoint,
    lista_estudiantes,
    matricula_list,
    matricular_estudiante,
    solicitar_reset_password,
)

router = DefaultRouter()
router.register(r"secciones", SeccionViewSet, basename="seccion")
router.register(r"fichas-estudiantes", FichaEstudianteViewSet, basename="ficha-estudiante")
router.register(r"fichas-apoderados", FichaApoderadoViewSet, basename="ficha-apoderado")
router.register(r"", UsuarioViewSet, basename="usuario")

urlpatterns = [
    path("cambiar-password/", cambiar_password, name="cambiar-password"),
    # Reset por email (público)
    path("reset-password/solicitar/", solicitar_reset_password, name="reset-solicitar"),
    path("reset-password/confirmar/", confirmar_reset_password, name="reset-confirmar"),
    path("reset-password/generar-codigo/", generar_codigo_recuperacion, name="reset-generar-codigo"),
    path("reset-password/con-codigo/", recuperar_con_codigo, name="reset-con-codigo"),
    path("roles/", catalogo_roles, name="catalogo-roles"),
    path("estudiantes/lista/", lista_estudiantes, name="lista-estudiantes"),
    path("matricula/", matricula_list, name="matricula-list"),
    path("matricula/nuevo/", matricular_estudiante, name="matricular-estudiante"),
    path("matricula/<int:pk>/situacion/", cambiar_situacion_matricula, name="cambiar-situacion-matricula"),
    # RM 556-2024 · Instructivo Matrícula 2025
    path("matricula/checklist/<int:estudiante_id>/", __import__("apps.usuarios.matricula_checklist", fromlist=["checklist_estudiante"]).checklist_estudiante, name="matricula-checklist"),
    path("matricula/reporte-cumplimiento/", __import__("apps.usuarios.matricula_checklist", fromlist=["reporte_cumplimiento_matricula"]).reporte_cumplimiento_matricula, name="matricula-reporte"),
    path("secciones/<int:seccion_id>/imprimir/", imprimir_lista_seccion, name="imprimir-lista-seccion"),
    # Import masivo
    path("importar/template-docentes/", descargar_template_docentes, name="import-template-doc"),
    path("importar/template-estudiantes/", descargar_template_estudiantes, name="import-template-est"),
    path("importar/template-padres/", descargar_template_padres, name="import-template-pad"),
    path("importar/docentes/", importar_docentes_endpoint, name="import-docentes"),
    path("importar/estudiantes/", importar_estudiantes_endpoint, name="import-estudiantes"),
    path("importar/padres/", importar_padres_endpoint, name="import-padres"),
    path("importar/credenciales/", descargar_credenciales, name="import-credenciales"),
    path("", include(router.urls)),
]
