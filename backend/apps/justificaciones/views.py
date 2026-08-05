from datetime import date

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.asistencia.models import EstadoAsistencia, RegistroAsistencia
from apps.core.models import ConfiguracionInstitucional
from apps.notificaciones.servicios import notificar
from apps.usuarios.models import Estudiante, Padre, Rol, Usuario

from .models import EstadoJustificacion, Justificacion
from .serializers import JustificacionSerializer


ROLES_REVISORES = ("director", "subdirector", "docente", "auxiliar", "psicologa", "secretaria")


def puede_gestionar_justificacion(user, justificacion) -> bool:
    """Director/subdirector gestionan todo; auxiliar gestiona todas; docente gestiona las de su sección."""
    if user.rol in (Rol.DIRECTOR, Rol.SUBDIRECTOR, Rol.AUXILIAR):
        return True
    if user.rol == Rol.DOCENTE:
        seccion = justificacion.estudiante.seccion_obj
        if not seccion:
            return False
        if seccion.tutor_id == user.id:
            return True
        return user.secciones_asignadas.filter(id=seccion.id).exists()
    return False


class JustificacionViewSet(viewsets.ModelViewSet):
    serializer_class = JustificacionSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = Justificacion.objects.select_related(
            "estudiante__usuario", "reportada_por", "revisada_por"
        )

        if user.rol == Rol.PADRE:
            # Padre solo ve las justificaciones de sus hijos
            padre = Padre.objects.filter(usuario=user).first()
            if not padre:
                return qs.none()
            qs = qs.filter(estudiante__in=padre.hijos.all())
        elif user.rol == Rol.DOCENTE:
            # Docente ve las de sus secciones
            secciones_ids = set(user.secciones_asignadas.values_list("id", flat=True))
            secciones_ids.update(user.secciones_como_tutor.values_list("id", flat=True))
            anio = ConfiguracionInstitucional.get_solo().anio_lectivo_activo or 2026
            qs = qs.filter(
                estudiante__matriculas__seccion_id__in=secciones_ids,
                estudiante__matriculas__anio_lectivo=anio,
            ).distinct()
        elif user.rol not in ROLES_REVISORES:
            return qs.none()

        estado = self.request.GET.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        return qs.order_by("-fecha_falta", "-creado_en")

    def create(self, request, *args, **kwargs):
        # Solo el padre puede reportar
        if request.user.rol != Rol.PADRE:
            raise PermissionDenied("Solo un padre/apoderado puede reportar justificaciones.")
        # Verificar que el estudiante es hijo del padre
        estudiante_id = request.data.get("estudiante")
        try:
            estudiante = Estudiante.objects.get(pk=estudiante_id)
        except (Estudiante.DoesNotExist, ValueError, TypeError):
            return Response({"error": "Estudiante inválido."}, status=400)
        padre = Padre.objects.filter(usuario=request.user).first()
        if not padre or estudiante not in padre.hijos.all():
            return Response({"error": "Este estudiante no está vinculado a tu cuenta."}, status=403)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        j = serializer.save(reportada_por=self.request.user)
        # Notificar al tutor de la sección del estudiante
        seccion = j.estudiante.seccion_obj
        if seccion and seccion.tutor:
            try:
                notificar(
                    destinatario=seccion.tutor,
                    titulo=f"Justificación reportada: {j.estudiante.usuario.first_name}",
                    cuerpo=f"El padre/madre reporta ausencia el {j.fecha_falta}. Motivo: {j.get_motivo_display()}. Requiere revisión.",
                    tipo="asistencia",
                    url_accion="/justificaciones",
                )
            except Exception:
                pass

    @action(detail=True, methods=["post"], url_path="aprobar")
    def aprobar(self, request, pk=None):
        j = self.get_object()
        if not puede_gestionar_justificacion(request.user, j):
            raise PermissionDenied("Solo el tutor de la sección o auxiliar pueden aprobar esta justificación.")
        if j.estado != EstadoJustificacion.PENDIENTE:
            return Response({"error": "Solo se aprueban las pendientes."}, status=400)
        j.estado = EstadoJustificacion.APROBADA
        j.revisada_por = request.user
        j.fecha_revision = timezone.now()
        j.save()

        # Actualizar el RegistroAsistencia correspondiente (si existe)
        reg = RegistroAsistencia.objects.filter(estudiante=j.estudiante, fecha=j.fecha_falta).first()
        if reg:
            reg.estado = EstadoAsistencia.JUSTIFICADO
            reg.justificacion = f"[{j.get_motivo_display()}] {j.descripcion}"[:500]
            reg.save(update_fields=["estado", "justificacion"])
        else:
            # Crear el registro directamente
            RegistroAsistencia.objects.create(
                estudiante=j.estudiante,
                fecha=j.fecha_falta,
                estado=EstadoAsistencia.JUSTIFICADO,
                justificacion=f"[{j.get_motivo_display()}] {j.descripcion}"[:500],
                marcado_por=request.user,
            )

        # Notificar al padre
        try:
            notificar(
                destinatario=j.reportada_por,
                titulo=f"Justificación aprobada: {j.estudiante.usuario.first_name}",
                cuerpo=f"Su solicitud para el {j.fecha_falta} fue APROBADA. La asistencia queda registrada como justificada.",
                tipo="asistencia",
                url_accion="/justificaciones",
            )
        except Exception:
            pass

        return Response(JustificacionSerializer(j).data)

    @action(detail=True, methods=["post"], url_path="rechazar")
    def rechazar(self, request, pk=None):
        j = self.get_object()
        if not puede_gestionar_justificacion(request.user, j):
            raise PermissionDenied("Solo el tutor de la sección o auxiliar pueden rechazar esta justificación.")
        if j.estado != EstadoJustificacion.PENDIENTE:
            return Response({"error": "Solo se rechazan las pendientes."}, status=400)
        razon = (request.data.get("razon") or "").strip()
        j.estado = EstadoJustificacion.RECHAZADA
        j.revisada_por = request.user
        j.fecha_revision = timezone.now()
        j.razon_rechazo = razon
        j.save()

        try:
            notificar(
                destinatario=j.reportada_por,
                titulo=f"Justificación rechazada: {j.estudiante.usuario.first_name}",
                cuerpo=f"Su solicitud para el {j.fecha_falta} fue rechazada. Motivo: {razon or 'sin razón indicada'}",
                tipo="asistencia",
                url_accion="/justificaciones",
            )
        except Exception:
            pass

        return Response(JustificacionSerializer(j).data)

    @action(detail=False, methods=["get"], url_path="motivos")
    def motivos(self, request):
        from .models import MotivoJustificacion
        return Response([{"codigo": c, "etiqueta": e} for c, e in MotivoJustificacion.choices])

    @action(detail=False, methods=["get"], url_path="pendientes-count")
    def pendientes_count(self, request):
        """Cantidad de justificaciones pendientes que ve el usuario."""
        qs = self.get_queryset().filter(estado=EstadoJustificacion.PENDIENTE)
        return Response({"pendientes": qs.count()})
