from rest_framework.routers import DefaultRouter

from .views import AvisoViewSet, CursoViewSet, EntregaViewSet, LeccionViewSet, RecursoViewSet, TareaViewSet


router = DefaultRouter()
router.register(r"cursos", CursoViewSet, basename="curso")
router.register(r"lecciones", LeccionViewSet, basename="leccion")
router.register(r"recursos", RecursoViewSet, basename="recurso")
router.register(r"tareas", TareaViewSet, basename="tarea")
router.register(r"entregas", EntregaViewSet, basename="entrega")
router.register(r"avisos", AvisoViewSet, basename="aviso")

urlpatterns = router.urls
