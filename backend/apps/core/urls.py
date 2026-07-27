from django.urls import path

from .views import (
    info_institucional, onboarding_status, configuracion_institucional,
    email_status, email_test, subir_logo, descargar_backup, restaurar_backup,
    versiones_sistema, kpis_director,
)

urlpatterns = [
    path("info/", info_institucional, name="core-info-institucional"),
    path("logo/", subir_logo, name="core-logo"),
    path("onboarding-status/", onboarding_status, name="core-onboarding-status"),
    path("configuracion/", configuracion_institucional, name="core-configuracion"),
    path("email-status/", email_status, name="core-email-status"),
    path("email-test/", email_test, name="core-email-test"),
    path("backup/", descargar_backup, name="core-backup"),
    path("restore/", restaurar_backup, name="core-restore"),
    path("versiones/", versiones_sistema, name="core-versiones"),
    path("kpis-director/", kpis_director, name="core-kpis-director"),
]
