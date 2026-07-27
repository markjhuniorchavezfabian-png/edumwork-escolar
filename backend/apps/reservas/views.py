from datetime import datetime, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Rol
from apps.notificaciones.servicios import notificar

from .models import EstadoReserva, Reserva
from .serializers import ReservaSerializer


ROLES_APROBADORES = ("director", "subdirector", "secretaria", "admin_tic")
ROLES_PUEDEN_SOLICITAR = (
    "director", "subdirector", "docente", "auxiliar", "psicologa", "admin_tic", "secretaria"
)


class ReservaViewSet(viewsets.ModelViewSet):
    serializer_class = ReservaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Reserva.objects.all().select_related("ambiente", "solicitante", "revisado_por")

        # El staff aprobador ve todo. Los demás solo sus propias reservas.
        if user.rol not in ROLES_APROBADORES:
            qs = qs.filter(solicitante=user)

        # Filtros query
        estado = self.request.GET.get("estado")
        if estado:
            qs = qs.filter(estado=estado)
        ambiente = self.request.GET.get("ambiente")
        if ambiente:
            qs = qs.filter(ambiente_id=ambiente)
        desde = self.request.GET.get("desde")
        hasta = self.request.GET.get("hasta")
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)

        return qs.order_by("-fecha", "hora_inicio")

    def create(self, request, *args, **kwargs):
        if request.user.rol not in ROLES_PUEDEN_SOLICITAR:
            raise PermissionDenied("Este rol no puede solicitar reservas.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(solicitante=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        # Solo el solicitante puede editar mientras esté 'solicitada'
        if instance.solicitante_id != self.request.user.id:
            raise PermissionDenied("Solo el solicitante puede editar.")
        if instance.estado != EstadoReserva.SOLICITADA:
            raise ValidationError("Solo se puede editar mientras esté en estado solicitada.")
        serializer.save()

    @action(detail=True, methods=["post"], url_path="aprobar")
    def aprobar(self, request, pk=None):
        if request.user.rol not in ROLES_APROBADORES:
            raise PermissionDenied()
        reserva = self.get_object()
        if reserva.estado != EstadoReserva.SOLICITADA:
            return Response({"error": f"Solo se aprueban las solicitadas (actual: {reserva.estado})"}, status=400)

        # Validar conflicto
        conflictos = reserva.hay_conflicto()
        if conflictos.exists():
            return Response({
                "error": "Hay reservas aprobadas que se solapan.",
                "conflictos": [{"id": c.pk, "solicitante": c.solicitante.get_full_name(), "hora": f"{c.hora_inicio}-{c.hora_fin}"} for c in conflictos],
            }, status=400)

        reserva.estado = EstadoReserva.APROBADA
        reserva.revisado_por = request.user
        reserva.fecha_revision = timezone.now()
        reserva.save()

        # Notificar al solicitante
        try:
            notificar(
                destinatario=reserva.solicitante,
                titulo=f"Reserva aprobada: {reserva.ambiente.nombre}",
                cuerpo=f"Tu reserva de {reserva.ambiente.nombre} para el {reserva.fecha} de {reserva.hora_inicio} a {reserva.hora_fin} fue APROBADA.",
                tipo="reserva",
                url_accion="/reservas",
            )
        except Exception:
            pass

        return Response(ReservaSerializer(reserva).data)

    @action(detail=True, methods=["post"], url_path="rechazar")
    def rechazar(self, request, pk=None):
        if request.user.rol not in ROLES_APROBADORES:
            raise PermissionDenied()
        reserva = self.get_object()
        razon = (request.data.get("razon") or "").strip()
        reserva.estado = EstadoReserva.RECHAZADA
        reserva.revisado_por = request.user
        reserva.fecha_revision = timezone.now()
        reserva.razon_rechazo = razon
        reserva.save()

        try:
            notificar(
                destinatario=reserva.solicitante,
                titulo=f"Reserva rechazada: {reserva.ambiente.nombre}",
                cuerpo=f"Tu reserva del {reserva.fecha} fue rechazada. Motivo: {razon or 'sin razón indicada'}",
                tipo="reserva",
                url_accion="/reservas",
            )
        except Exception:
            pass
        return Response(ReservaSerializer(reserva).data)

    @action(detail=True, methods=["post"], url_path="cancelar")
    def cancelar(self, request, pk=None):
        reserva = self.get_object()
        if reserva.solicitante_id != request.user.id and request.user.rol not in ROLES_APROBADORES:
            raise PermissionDenied()
        reserva.estado = EstadoReserva.CANCELADA
        reserva.save()
        return Response(ReservaSerializer(reserva).data)

    @action(detail=False, methods=["get"], url_path="calendario")
    def calendario(self, request):
        """Retorna las reservas de un ambiente en un rango de fechas.
        Query: ?ambiente=X&desde=YYYY-MM-DD&hasta=YYYY-MM-DD"""
        ambiente = request.GET.get("ambiente")
        desde = request.GET.get("desde")
        hasta = request.GET.get("hasta")
        qs = Reserva.objects.filter(estado__in=[EstadoReserva.APROBADA, EstadoReserva.SOLICITADA])
        if ambiente:
            qs = qs.filter(ambiente_id=ambiente)
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)
        return Response(ReservaSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        if request.user.rol not in ROLES_APROBADORES:
            raise PermissionDenied()
        qs = Reserva.objects.all()
        return Response({
            "total": qs.count(),
            "pendientes": qs.filter(estado=EstadoReserva.SOLICITADA).count(),
            "aprobadas": qs.filter(estado=EstadoReserva.APROBADA).count(),
            "rechazadas": qs.filter(estado=EstadoReserva.RECHAZADA).count(),
            "por_ambiente_top5": list(
                qs.filter(estado=EstadoReserva.APROBADA)
                .values("ambiente__nombre").annotate(c=Count("id"))
                .order_by("-c")[:5]
                .values_list("ambiente__nombre", "c")
            ),
        })
