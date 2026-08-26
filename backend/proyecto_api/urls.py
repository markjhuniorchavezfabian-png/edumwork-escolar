from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin

from apps.core.views import servir_archivo
from django.urls import include, path

from apps.core.health import health_check

urlpatterns = [
    path("health/", health_check, name="health"),
    path("admin/", admin.site.urls),
    path("api/core/", include("apps.core.urls")),
    # Los archivos subidos: se piden por enlace firmado, no por /media/.
    # Ver `apps/core/archivos.py` para el porqué.
    path("api/archivos/<str:token>/", servir_archivo, name="servir-archivo"),
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

# En dev sólo los logos, igual que en producción (ver `frontend/nginx.conf.template`).
#
# Servía `/media/` entero, así que cualquiera con la URL se bajaba la foto de
# un estudiante o el adjunto de un caso de convivencia sin sesión. Que dev se
# comporte igual que producción es parte del arreglo: si acá funcionara el
# enlace directo, alguien lo usaría en el frontend y se rompería al desplegar.
if settings.DEBUG:
    urlpatterns += static(
        f"{settings.MEDIA_URL}logos/",
        document_root=settings.MEDIA_ROOT / "logos",
    )
