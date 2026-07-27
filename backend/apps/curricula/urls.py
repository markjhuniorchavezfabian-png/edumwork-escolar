from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AreaViewSet, CapacidadViewSet, CompetenciaViewSet, DesempenoViewSet, ImportarCNEBView

router = DefaultRouter()
router.register("areas", AreaViewSet, basename="curricula-area")
router.register("competencias", CompetenciaViewSet, basename="curricula-competencia")
router.register("capacidades", CapacidadViewSet, basename="curricula-capacidad")
router.register("desempenos", DesempenoViewSet, basename="curricula-desempeno")

urlpatterns = router.urls + [
    path("importar/", ImportarCNEBView.as_view(), name="curricula-importar"),
]
