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
    path("", include(router.urls)),
]
