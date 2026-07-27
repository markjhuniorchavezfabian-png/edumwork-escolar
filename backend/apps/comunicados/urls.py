from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ComunicadoViewSet

router = DefaultRouter()
router.register(r"", ComunicadoViewSet, basename="comunicado")

urlpatterns = [path("", include(router.urls))]
