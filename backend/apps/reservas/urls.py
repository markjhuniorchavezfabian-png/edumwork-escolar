from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ReservaViewSet

router = DefaultRouter()
router.register(r"", ReservaViewSet, basename="reserva")

urlpatterns = [path("", include(router.urls))]
