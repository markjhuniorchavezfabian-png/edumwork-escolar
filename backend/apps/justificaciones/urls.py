from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import JustificacionViewSet

router = DefaultRouter()
router.register(r"", JustificacionViewSet, basename="justificacion")

urlpatterns = [path("", include(router.urls))]
