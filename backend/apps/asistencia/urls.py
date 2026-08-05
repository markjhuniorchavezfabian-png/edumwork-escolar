from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .sesiones_views import SesionClaseViewSet
from .views import (
    RegistroAsistenciaViewSet,
    exportar_mensual,
    listar_estudiantes,
    mis_secciones,
    qr_estudiante,
    qrs_por_seccion,
    siagie_asistencia_analizar,
    siagie_asistencia_preview,
    siagie_asistencia_rellenar,
)

router = DefaultRouter()
router.register(r"registros", RegistroAsistenciaViewSet, basename="asistencia-registro")
router.register(r"sesiones", SesionClaseViewSet, basename="asistencia-sesion")

urlpatterns = [
    path("estudiantes/", listar_estudiantes, name="asistencia-estudiantes"),
    path("secciones/mis/", mis_secciones, name="asistencia-mis-secciones"),
    path("qr/<str:codigo>/", qr_estudiante, name="asistencia-qr-estudiante"),
    path("secciones/<int:seccion_id>/qrs/", qrs_por_seccion, name="asistencia-qrs-seccion"),
    path("exportar-mensual/", exportar_mensual, name="asistencia-exportar-mensual"),
    path("siagie/analizar/", siagie_asistencia_analizar, name="asistencia-siagie-analizar"),
    path("siagie/preview/", siagie_asistencia_preview, name="asistencia-siagie-preview"),
    path("siagie/rellenar/", siagie_asistencia_rellenar, name="asistencia-siagie-rellenar"),
    path("", include(router.urls)),
]
