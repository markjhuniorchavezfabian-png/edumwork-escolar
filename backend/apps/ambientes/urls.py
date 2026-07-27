from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AmbienteViewSet, BitacoraUsoViewSet

router = DefaultRouter()
router.register(r"bitacoras", BitacoraUsoViewSet, basename="bitacora-ambiente")
router.register(r"", AmbienteViewSet, basename="ambiente")

urlpatterns = [path("", include(router.urls))]
