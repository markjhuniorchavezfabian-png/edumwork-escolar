from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.core.health import health_check

urlpatterns = [
    path("health/", health_check, name="health"),
    path("admin/", admin.site.urls),
    path("api/core/", include("apps.core.urls")),
    path("api/auth/", include("apps.usuarios.urls")),
    path("api/usuarios/", include("apps.usuarios.urls_usuarios")),
    path("api/incidencias/", include("apps.incidencias.urls")),
    path("api/ia/", include("apps.ia.urls")),
    path("api/asistencia/", include("apps.asistencia.urls")),
    path("api/inventario/", include("apps.inventario.urls")),
    path("api/visitas/", include("apps.visitas.urls")),
    path("api/auditoria/", include("apps.auditoria.urls")),
    path("api/comunicados/", include("apps.comunicados.urls")),
    path("api/convivencia/", include("apps.convivencia.urls")),
    path("api/ambientes/", include("apps.ambientes.urls")),
    path("api/notificaciones/", include("apps.notificaciones.urls")),
    path("api/reservas/", include("apps.reservas.urls")),
    path("api/asistencia-personal/", include("apps.asistencia_personal.urls")),
    path("api/justificaciones/", include("apps.justificaciones.urls")),
    path("api/notas/", include("apps.notas.urls")),
    path("api/aula-virtual/", include("apps.aula_virtual.urls")),
    path("api/curricula/", include("apps.curricula.urls")),
    path("api/calendario/", include("apps.calendario.urls")),
]

# Servir MEDIA en dev (fotos subidas por usuarios)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
