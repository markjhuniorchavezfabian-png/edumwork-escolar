from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CampanaAutoRegistroViewSet,
    VisitaViewSet,
    auto_registrar,
    catalogo_motivos,
    info_campana,
    qr_campana_publico,
)

router = DefaultRouter()
router.register(r"campanas", CampanaAutoRegistroViewSet, basename="campana-visita")
router.register(r"registros", VisitaViewSet, basename="visita")

urlpatterns = [
    path("motivos/", catalogo_motivos, name="visitas-motivos"),
    # Endpoints PÚBLICOS (auto-registro)
    path("publico/<uuid:token>/info/", info_campana, name="visitas-publico-info"),
    path("publico/<uuid:token>/registrar/", auto_registrar, name="visitas-publico-registrar"),
    path("publico/<uuid:token>/qr.png", qr_campana_publico, name="visitas-publico-qr"),
    path("", include(router.urls)),
]
