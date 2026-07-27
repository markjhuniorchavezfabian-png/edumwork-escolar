from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Rol

from .models import Comunicado, LecturaComunicado
from .serializers import ComunicadoSerializer, LecturaComunicadoSerializer


ROLES_PUEDEN_PUBLICAR = ("director", "subdirector", "docente", "psicologa", "secretaria", "admin_tic")

ROLES_STAFF = ("director", "subdirector", "docente", "psicologa", "secretaria", "admin_tic", "auxiliar", "conserje")


def _notificar_destinatarios(comunicado):
    """Notifica a los usuarios que deberían ver este comunicado según su alcance."""
    from apps.usuarios.models import Usuario, Rol
    from apps.notificaciones.servicios import notificar
    import logging

    log = logging.getLogger(__name__)
    try:
        qs = Usuario.objects.filter(is_active=True).exclude(id=comunicado.autor_id)
        if comunicado.alcance == "toda_ie":
            pass  # todos
        elif comunicado.alcance == "staff":
            qs = qs.filter(rol__in=ROLES_STAFF)
        elif comunicado.alcance == "padres":
            qs = qs.filter(rol=Rol.PADRE)
        elif comunicado.alcance == "seccion" and comunicado.seccion_id:
            # Padres cuyos hijos estén en la sección + docente tutor de la sección + estudiantes
            padres_ids = Usuario.objects.filter(
                rol=Rol.PADRE,
                perfil_padre__hijos__seccion_obj_id=comunicado.seccion_id,
            ).values_list("id", flat=True)
            estudiantes_ids = Usuario.objects.filter(
                rol=Rol.ESTUDIANTE,
                perfil_estudiante__seccion_obj_id=comunicado.seccion_id,
            ).values_list("id", flat=True)
            qs = qs.filter(id__in=list(padres_ids) + list(estudiantes_ids))
        else:
            return

        from apps.core.models import ConfiguracionInstitucional
        cfg = ConfiguracionInstitucional.get_solo()
        es_emergencia = comunicado.categoria == "emergencia"
        # Email permitido si: es emergencia (siempre) O el config institucional lo habilita
        allow_email = es_emergencia or cfg.email_comunicados_habilitado

        titulo = f"📢 {comunicado.titulo}"
        cuerpo = (comunicado.cuerpo or "")[:280]
        for u in qs.iterator():
            try:
                notificar(
                    destinatario=u,
                    titulo=titulo,
                    cuerpo=cuerpo,
                    tipo="comunicados",
                    url_accion=f"/comunicados?id={comunicado.id}",
                    forzar_email=es_emergencia,
                    allow_email=allow_email,
                )
            except Exception as e:  # noqa: BLE001
                log.warning(f"Fallo notif comunicado {comunicado.id} a user {u.id}: {e}")
    except Exception as e:  # noqa: BLE001
        log.warning(f"Fallo despacho de notificaciones para comunicado {comunicado.id}: {e}")


class ComunicadoViewSet(viewsets.ModelViewSet):
    serializer_class = ComunicadoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        """El usuario ve los comunicados de su alcance:
        - Staff ve todos los que van a staff + toda_ie.
        - Padres ven los que van a toda_ie + padres + sección de sus hijos.
        - Otros roles: solo toda_ie."""
        user = self.request.user
        base = Comunicado.objects.filter(activo=True).select_related("autor", "seccion")

        if user.rol in ROLES_PUEDEN_PUBLICAR + ("director",):
            # Staff ve todo
            return base.order_by("-fecha_publicacion")

        if user.rol == Rol.PADRE:
            # Padre ve: toda_ie + padres + sección de sus hijos
            secciones_hijos = []
            try:
                secciones_hijos = list(user.perfil_padre.hijos.values_list("seccion_obj_id", flat=True))
            except Exception:
                pass
            return base.filter(
                Q(alcance="toda_ie")
                | Q(alcance="padres")
                | Q(alcance="seccion", seccion_id__in=secciones_hijos)
            ).order_by("-fecha_publicacion")

        return base.filter(alcance="toda_ie").order_by("-fecha_publicacion")

    def perform_create(self, serializer):
        if self.request.user.rol not in ROLES_PUEDEN_PUBLICAR:
            raise PermissionDenied("Solo el personal docente/administrativo puede publicar comunicados.")
        comunicado = serializer.save(autor=self.request.user)
        _notificar_destinatarios(comunicado)

    def perform_update(self, serializer):
        instance = self.get_object()
        if instance.autor_id != self.request.user.id and self.request.user.rol not in ("director", "subdirector"):
            raise PermissionDenied("Solo el autor o dirección pueden editar este comunicado.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.autor_id != self.request.user.id and self.request.user.rol not in ("director", "subdirector"):
            raise PermissionDenied("Solo el autor o dirección pueden eliminar este comunicado.")
        # Soft delete
        instance.activo = False
        instance.save(update_fields=["activo"])

    @action(detail=True, methods=["post"], url_path="marcar-leido")
    def marcar_leido(self, request, pk=None):
        """Registra que el usuario autenticado leyó este comunicado. Idempotente."""
        comunicado = self.get_object()
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR"))
        if ip:
            ip = ip.split(",")[0].strip()
        _, creado = LecturaComunicado.objects.get_or_create(
            comunicado=comunicado, usuario=request.user,
            defaults={"ip_origen": ip},
        )
        return Response({"ok": True, "nueva_lectura": creado})

    @action(detail=True, methods=["get"], url_path="lecturas")
    def lecturas(self, request, pk=None):
        """Solo staff: lista quiénes leyeron y cuándo."""
        if request.user.rol not in ROLES_PUEDEN_PUBLICAR:
            raise PermissionDenied()
        comunicado = self.get_object()
        qs = comunicado.lecturas.select_related("usuario").order_by("-leido_en")
        return Response(LecturaComunicadoSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="no-leidos")
    def no_leidos(self, request):
        """Cantidad de comunicados no leídos del usuario actual."""
        qs = self.get_queryset()
        leidos_ids = LecturaComunicado.objects.filter(usuario=request.user).values_list("comunicado_id", flat=True)
        no_leidos = qs.exclude(id__in=leidos_ids).count()
        return Response({"no_leidos": no_leidos, "total": qs.count()})
