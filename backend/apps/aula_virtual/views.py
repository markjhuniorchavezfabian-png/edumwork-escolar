from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notificaciones.servicios import notificar
from apps.usuarios.models import Rol, Usuario

from .models import Curso, EstadoEntrega, Entrega, Leccion, Recurso, Tarea
from .serializers import (
    CursoSerializer,
    EntregaSerializer,
    LeccionSerializer,
    RecursoSerializer,
    TareaSerializer,
)


ROLES_CREADORES = (Rol.DOCENTE, Rol.ADMIN_TIC, Rol.DIRECTOR, Rol.PSICOLOGA, Rol.SUBDIRECTOR)


def _es_docente_del_curso(user, curso: Curso) -> bool:
    """Puede editar el curso: docente creador + director/subdirector."""
    if not user or not user.is_authenticated:
        return False
    if user.rol in (Rol.DIRECTOR, Rol.SUBDIRECTOR):
        return True
    return curso.docente_id == user.id


# ─────────────────────────────────────────────────────────────────────────────
class CursoViewSet(viewsets.ModelViewSet):
    serializer_class = CursoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = Curso.objects.filter(activo=True).select_related("docente").prefetch_related("secciones")

        # Docentes ven los suyos + los que dictan otras materias (todos)
        # Estudiante: solo los de su sección
        # Padre: los cursos de las secciones de sus hijos
        # Director/subdirector/admin_tic: todos
        if user.rol == Rol.ESTUDIANTE:
            est = getattr(user, "perfil_estudiante", None)
            if not est or not est.seccion_obj_id:
                return qs.none()
            qs = qs.filter(secciones=est.seccion_obj)
        elif user.rol == Rol.PADRE:
            try:
                secciones_ids = list(
                    user.perfil_padre.hijos.values_list("seccion_obj_id", flat=True)
                )
            except AttributeError:
                return qs.none()
            qs = qs.filter(secciones__in=secciones_ids).distinct()
        # Otros roles ven todos los activos

        # Filtros opcionales
        area = self.request.GET.get("area")
        seccion = self.request.GET.get("seccion")
        q = self.request.GET.get("q")
        if area:
            qs = qs.filter(area=area)
        if seccion:
            qs = qs.filter(secciones=seccion)
        if q:
            qs = qs.filter(Q(titulo__icontains=q) | Q(descripcion__icontains=q))

        return qs

    def perform_create(self, serializer):
        if self.request.user.rol not in ROLES_CREADORES:
            raise PermissionDenied("Solo docentes y directivos pueden crear cursos.")
        serializer.save(docente=self.request.user)

    def perform_update(self, serializer):
        curso = self.get_object()
        if not _es_docente_del_curso(self.request.user, curso):
            raise PermissionDenied("Solo el docente del curso o dirección pueden editarlo.")
        serializer.save()

    def perform_destroy(self, instance):
        if not _es_docente_del_curso(self.request.user, instance):
            raise PermissionDenied("No podés eliminar este curso.")
        instance.activo = False  # soft-delete
        instance.save(update_fields=["activo"])


# ─────────────────────────────────────────────────────────────────────────────
class LeccionViewSet(viewsets.ModelViewSet):
    serializer_class = LeccionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = Leccion.objects.select_related("curso__docente").prefetch_related("recursos")

        # Filtrar por curso (típicamente vendrá ?curso=X en el query)
        curso_id = self.request.GET.get("curso")
        if curso_id:
            qs = qs.filter(curso_id=curso_id)

        # Estudiantes/padres solo ven lecciones publicadas
        if user.rol in (Rol.ESTUDIANTE, Rol.PADRE):
            qs = qs.filter(publicada=True)

        return qs.order_by("curso", "orden")

    def perform_create(self, serializer):
        curso = serializer.validated_data.get("curso")
        if not _es_docente_del_curso(self.request.user, curso):
            raise PermissionDenied("Solo el docente del curso puede agregar lecciones.")
        serializer.save()

    def perform_update(self, serializer):
        leccion = self.get_object()
        if not _es_docente_del_curso(self.request.user, leccion.curso):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _es_docente_del_curso(self.request.user, instance.curso):
            raise PermissionDenied()
        instance.delete()


# ─────────────────────────────────────────────────────────────────────────────
class RecursoViewSet(viewsets.ModelViewSet):
    serializer_class = RecursoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = Recurso.objects.select_related("leccion__curso")
        leccion = self.request.GET.get("leccion")
        if leccion:
            qs = qs.filter(leccion_id=leccion)
        return qs

    def perform_create(self, serializer):
        leccion = serializer.validated_data.get("leccion")
        if not _es_docente_del_curso(self.request.user, leccion.curso):
            raise PermissionDenied()
        serializer.save()

    def perform_update(self, serializer):
        recurso = self.get_object()
        if not _es_docente_del_curso(self.request.user, recurso.leccion.curso):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _es_docente_del_curso(self.request.user, instance.leccion.curso):
            raise PermissionDenied()
        instance.delete()


# ─────────────────────────────────────────────────────────────────────────────
class TareaViewSet(viewsets.ModelViewSet):
    serializer_class = TareaSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = Tarea.objects.select_related("curso__docente", "leccion")

        curso_id = self.request.GET.get("curso")
        if curso_id:
            qs = qs.filter(curso_id=curso_id)

        # Estudiantes solo ven publicadas de sus cursos
        if user.rol == Rol.ESTUDIANTE:
            est = getattr(user, "perfil_estudiante", None)
            if not est or not est.seccion_obj_id:
                return qs.none()
            qs = qs.filter(publicada=True, curso__secciones=est.seccion_obj)

        return qs

    def perform_create(self, serializer):
        curso = serializer.validated_data.get("curso")
        if not _es_docente_del_curso(self.request.user, curso):
            raise PermissionDenied()
        tarea = serializer.save()

        # Notificar a estudiantes de las secciones del curso
        try:
            estudiantes_users = Usuario.objects.filter(
                rol=Rol.ESTUDIANTE,
                perfil_estudiante__seccion_obj__in=curso.secciones.all(),
                is_active=True,
            ).distinct()
            for u in estudiantes_users:
                notificar(
                    destinatario=u,
                    titulo=f"Nueva tarea en {curso.titulo}: {tarea.titulo}",
                    cuerpo=f"Fecha de entrega: {tarea.fecha_entrega:%d/%m/%Y %H:%M}",
                    tipo="general",
                    url_accion=f"/aprender/curso/{curso.id}",
                )
        except Exception:  # noqa: BLE001
            pass

    def perform_update(self, serializer):
        tarea = self.get_object()
        if not _es_docente_del_curso(self.request.user, tarea.curso):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _es_docente_del_curso(self.request.user, instance.curso):
            raise PermissionDenied()
        instance.delete()


# ─────────────────────────────────────────────────────────────────────────────
class EntregaViewSet(viewsets.ModelViewSet):
    serializer_class = EntregaSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = Entrega.objects.select_related("tarea__curso", "estudiante__usuario")

        tarea_id = self.request.GET.get("tarea")
        if tarea_id:
            qs = qs.filter(tarea_id=tarea_id)

        if user.rol == Rol.ESTUDIANTE:
            est = getattr(user, "perfil_estudiante", None)
            if not est:
                return qs.none()
            qs = qs.filter(estudiante=est)
        elif user.rol == Rol.PADRE:
            try:
                hijos_ids = list(user.perfil_padre.hijos.values_list("pk", flat=True))
            except AttributeError:
                return qs.none()
            qs = qs.filter(estudiante_id__in=hijos_ids)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.rol != Rol.ESTUDIANTE:
            raise PermissionDenied("Solo los estudiantes pueden entregar tareas.")
        est = getattr(user, "perfil_estudiante", None)
        if not est:
            raise PermissionDenied("Tu cuenta no tiene perfil de estudiante.")

        tarea = serializer.validated_data.get("tarea")
        if not tarea:
            raise PermissionDenied("Tarea inválida.")

        # Verificar que la tarea pertenezca a un curso de su sección
        if not tarea.curso.secciones.filter(pk=est.seccion_obj_id).exists():
            raise PermissionDenied("Esta tarea no es de tu sección.")

        # Determinar estado según fecha
        ahora = timezone.now()
        estado = EstadoEntrega.TARDIA if ahora > tarea.fecha_entrega else EstadoEntrega.ENTREGADA

        serializer.save(estudiante=est, estado=estado)

    @action(detail=True, methods=["post"], url_path="calificar")
    def calificar(self, request, pk=None):
        entrega = self.get_object()
        if not _es_docente_del_curso(request.user, entrega.tarea.curso):
            raise PermissionDenied("Solo el docente del curso puede calificar.")

        try:
            nota = float(request.data.get("nota"))
        except (TypeError, ValueError):
            return Response({"error": "Nota inválida."}, status=400)

        if not (0 <= nota <= float(entrega.tarea.puntaje_maximo)):
            return Response({"error": f"La nota debe estar entre 0 y {entrega.tarea.puntaje_maximo}."}, status=400)

        entrega.nota = nota
        entrega.comentario_docente = request.data.get("comentario", "").strip()
        entrega.estado = EstadoEntrega.CALIFICADA
        entrega.calificada_por = request.user
        entrega.calificada_en = timezone.now()
        entrega.save()

        # Notificar al estudiante
        try:
            notificar(
                destinatario=entrega.estudiante.usuario,
                titulo=f"Tarea calificada: {entrega.tarea.titulo}",
                cuerpo=f"Nota: {nota}/{entrega.tarea.puntaje_maximo}. {entrega.comentario_docente[:120]}",
                tipo="general",
                url_accion=f"/aprender/curso/{entrega.tarea.curso_id}",
            )
        except Exception:  # noqa: BLE001
            pass

        return Response(EntregaSerializer(entrega, context={"request": request}).data)


# ─────────────────────────────────────────────────────────────────────────────
class AvisoViewSet(viewsets.ModelViewSet):
    """CRUD de avisos/recordatorios de un curso."""
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_serializer_class(self):
        from .serializers import AvisoSerializer
        return AvisoSerializer

    def get_queryset(self):
        from .models import Aviso
        curso_id = self.request.GET.get("curso")
        qs = Aviso.objects.select_related("autor", "curso")
        if curso_id:
            qs = qs.filter(curso_id=curso_id)
        return qs

    def perform_create(self, serializer):
        from .models import Aviso
        curso = serializer.validated_data["curso"]
        if not _es_docente_del_curso(self.request.user, curso):
            raise PermissionDenied("Solo el docente del curso puede publicar avisos.")
        serializer.save(autor=self.request.user)

    def perform_update(self, serializer):
        aviso = self.get_object()
        if not _es_docente_del_curso(self.request.user, aviso.curso):
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _es_docente_del_curso(self.request.user, instance.curso):
            raise PermissionDenied()
        instance.delete()
