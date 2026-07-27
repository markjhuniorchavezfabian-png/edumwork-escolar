from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CasoConvivenciaViewSet

router = DefaultRouter()
router.register(r"casos", CasoConvivenciaViewSet, basename="caso-convivencia")

urlpatterns = [path("", include(router.urls))]
