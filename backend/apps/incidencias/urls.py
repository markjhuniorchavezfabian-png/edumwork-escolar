from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IncidenciaViewSet, clasificar_incidencia

router = DefaultRouter()
router.register(r"", IncidenciaViewSet, basename="incidencia")

urlpatterns = [
    path("clasificar/", clasificar_incidencia, name="incidencias-clasificar"),
    path("", include(router.urls)),
]
