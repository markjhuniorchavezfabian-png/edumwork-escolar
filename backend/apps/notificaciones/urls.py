from django.urls import path
from .views import mis_notificaciones, marcar_leida, marcar_todas_leidas, preferencias

urlpatterns = [
    path("", mis_notificaciones, name="notif-lista"),
    path("marcar-todas-leidas/", marcar_todas_leidas, name="notif-marcar-todas"),
    path("preferencias/", preferencias, name="notif-preferencias"),
    path("<int:pk>/leida/", marcar_leida, name="notif-leida"),
]
