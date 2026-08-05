from django.urls import path
from . import views
from . import views_personal

urlpatterns = [
    path("login/", views.login, name="auth-login"),
    path("refresh/", views.refresh, name="auth-refresh"),
    path("me/", views.me, name="auth-me"),
    path("mi-cuenta/", views_personal.mi_cuenta, name="auth-mi-cuenta"),
    path("mi-backup/", views_personal.mi_backup, name="auth-mi-backup"),

    # ── Invitación e integración de docentes a la I.E. ──────────────────
    path("invitar-docente/", views_personal.invitar_docente, name="auth-invitar-docente"),
    path("invitaciones/", views_personal.listar_invitaciones, name="auth-listar-invitaciones"),
    path("invitacion/<str:token>/", views_personal.ver_invitacion, name="auth-ver-invitacion"),
    path("aceptar-invitacion/", views_personal.aceptar_invitacion, name="auth-aceptar-invitacion"),
]
