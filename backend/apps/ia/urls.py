from django.urls import path
from . import views

urlpatterns = [
    path("catalogo/", views.catalogo, name="ia-catalogo"),
    path("config/", views.config, name="ia-config"),
    path("mi-config/", views.mi_config, name="ia-mi-config"),
    path("probar/", views.probar, name="ia-probar"),
    path("uso/", views.uso, name="ia-uso"),
    path("costos/", views.costos, name="ia-costos"),
    path("chat/", views.chat_asistente, name="ia-chat"),
    path("sugerir-temas/", views.sugerir_temas, name="ia-sugerir-temas"),
    path("completar-campo/", views.completar_campo, name="ia-completar-campo"),
    path("sesion/", views.generar_sesion, name="ia-sesion"),
    path("resumen-semanal/", views.resumen_semanal, name="ia-resumen-semanal"),
    path("reporte-riesgo/", views.reporte_riesgo_ia, name="ia-reporte-riesgo"),
    path("cierre-bimestre/", views.cierre_bimestre_ia, name="ia-cierre-bimestre"),
]
