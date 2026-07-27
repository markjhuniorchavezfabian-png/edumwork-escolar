from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import RegistroPersonalViewSet, configuracion

router = DefaultRouter()
router.register(r"registros", RegistroPersonalViewSet, basename="asist-personal")

urlpatterns = [
    path("configuracion/", configuracion, name="config-institucional"),
    path("", include(router.urls)),
]
