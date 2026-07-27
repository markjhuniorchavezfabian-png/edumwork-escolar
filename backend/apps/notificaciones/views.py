from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notificacion, PreferenciasNotificacion
from .serializers import NotificacionSerializer, PreferenciasNotificacionSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mis_notificaciones(request):
    """Lista las notificaciones del usuario autenticado."""
    solo_no_leidas = request.GET.get("no_leidas") in ("1", "true", "True")
    qs = Notificacion.objects.filter(destinatario=request.user)
    if solo_no_leidas:
        qs = qs.filter(leida=False)
    limite = int(request.GET.get("limite", 30))
    return Response({
        "no_leidas": Notificacion.objects.filter(destinatario=request.user, leida=False).count(),
        "resultados": NotificacionSerializer(qs[:limite], many=True).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def marcar_leida(request, pk):
    """Marca una notificación como leída."""
    try:
        n = Notificacion.objects.get(pk=pk, destinatario=request.user)
    except Notificacion.DoesNotExist:
        return Response({"error": "No encontrada"}, status=404)
    if not n.leida:
        n.leida = True
        n.fecha_leida = timezone.now()
        n.save(update_fields=["leida", "fecha_leida"])
    return Response(NotificacionSerializer(n).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def marcar_todas_leidas(request):
    count = Notificacion.objects.filter(destinatario=request.user, leida=False).update(
        leida=True, fecha_leida=timezone.now()
    )
    return Response({"marcadas": count})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def preferencias(request):
    prefs, _ = PreferenciasNotificacion.objects.get_or_create(usuario=request.user)
    if request.method == "PATCH":
        ser = PreferenciasNotificacionSerializer(prefs, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
    return Response(PreferenciasNotificacionSerializer(prefs).data)
