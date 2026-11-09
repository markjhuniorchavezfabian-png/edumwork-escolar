from rest_framework.routers import DefaultRouter

from .views import (
    ConceptoPagoViewSet,
    ObligacionPagoViewSet,
    PagoViewSet,
    MovimientoCajaViewSet,
    ResumenFinancieroViewSet,
)

router = DefaultRouter()
router.register(r"conceptos", ConceptoPagoViewSet, basename="finanzas-conceptos")
router.register(r"obligaciones", ObligacionPagoViewSet, basename="finanzas-obligaciones")
router.register(r"pagos", PagoViewSet, basename="finanzas-pagos")
router.register(r"caja", MovimientoCajaViewSet, basename="finanzas-caja")
router.register(r"resumen", ResumenFinancieroViewSet, basename="finanzas-resumen")

urlpatterns = router.urls
