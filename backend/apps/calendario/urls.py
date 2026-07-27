from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AnioEscolarViewSet, DiaCalendarioViewSet, calendario_completo, kpi_cumplimiento

router = DefaultRouter()
router.register("dias", DiaCalendarioViewSet, basename="calendario-dia")
router.register("anios", AnioEscolarViewSet, basename="calendario-anio")

urlpatterns = [
    path("kpi/", kpi_cumplimiento, name="calendario-kpi"),
    path("completo/", calendario_completo, name="calendario-completo"),
    path("", include(router.urls)),
]
