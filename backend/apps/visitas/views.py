import io
from datetime import timedelta

import qrcode
from django.db.models import Avg, Count, ExpressionWrapper, F, fields
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.core.models import ConfiguracionInstitucional
from apps.core.ratelimit import ratelimit_drf
from rest_framework.response import Response

from apps.usuarios.models import Rol

from .models import CampanaAutoRegistro, EstadoVisita, MotivoVisita, OrigenVisita, Visita
from .serializers import VisitaSerializer


class PermisoVisita(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            return request.user.rol in (Rol.ADMIN_TIC, Rol.DIRECTOR, Rol.DOCENTE)
        return True


class VisitaViewSet(viewsets.ModelViewSet):
    serializer_class = VisitaSerializer
    permission_classes = [PermisoVisita]

    def get_queryset(self):
        qs = Visita.objects.select_related("registrado_por").all()
        estado = self.request.GET.get("estado")
        if estado == "dentro":
            qs = qs.filter(hora_salida__isnull=True)
        elif estado == "salidos":
            qs = qs.filter(hora_salida__isnull=False)
        desde = self.request.GET.get("desde")
        hasta = self.request.GET.get("hasta")
        if desde:
            qs = qs.filter(hora_entrada__gte=desde)
        if hasta:
            qs = qs.filter(hora_entrada__lte=hasta)
        return qs.order_by("-hora_entrada")

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)

    @action(detail=True, methods=["post"], url_path="marcar-salida")
    def marcar_salida(self, request, pk=None):
        """Marca la hora de salida de la visita."""
        v = self.get_object()
        if v.hora_salida:
            return Response({"error": "La visita ya tenía salida registrada."}, status=400)
        v.hora_salida = timezone.now()
        v.salida_registrada_por = request.user
        v.save(update_fields=["hora_salida", "salida_registrada_por", "actualizado_en"])
        return Response(VisitaSerializer(v).data)

    @action(detail=False, methods=["post"], url_path="salida-por-gafete")
    def salida_por_gafete(self, request):
        """Marca salida por escaneo del QR del gafete."""
        codigo = request.data.get("codigo_gafete")
        if not codigo:
            return Response({"error": "codigo_gafete requerido"}, status=400)
        v = Visita.objects.filter(codigo_gafete=codigo).first()
        if not v:
            return Response({"error": "Gafete no reconocido."}, status=404)
        if v.hora_salida:
            return Response({
                "error": "Este visitante ya salió.",
                "visitante": v.nombre_completo,
                "hora_salida_previa": v.hora_salida,
            }, status=400)
        v.hora_salida = timezone.now()
        v.salida_registrada_por = request.user
        v.save()
        return Response({
            "ok": True,
            "visitante": v.nombre_completo,
            "duracion_minutos": v.duracion_minutos,
        })

    @action(detail=True, methods=["get"], url_path="gafete-qr")
    def gafete_qr(self, request, pk=None):
        v = self.get_object()
        img = qrcode.make(str(v.codigo_gafete), box_size=10, border=2)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return HttpResponse(buf.getvalue(), content_type="image/png")

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC.")

        hoy = timezone.now().date()
        hace_7 = timezone.now() - timedelta(days=7)
        hace_30 = timezone.now() - timedelta(days=30)

        qs_hoy = Visita.objects.filter(hora_entrada__date=hoy)
        qs_semana = Visita.objects.filter(hora_entrada__gte=hace_7)
        qs_mes = Visita.objects.filter(hora_entrada__gte=hace_30)

        dentro = Visita.objects.filter(hora_salida__isnull=True).count()

        # Duración promedio (solo salidas registradas)
        qs_dur = Visita.objects.filter(hora_salida__isnull=False)
        prom = qs_dur.annotate(
            dur=ExpressionWrapper(
                F("hora_salida") - F("hora_entrada"),
                output_field=fields.DurationField(),
            )
        ).aggregate(prom=Avg("dur"))["prom"]
        duracion_prom_min = int(prom.total_seconds() // 60) if prom else 0

        # Top motivos del mes
        top_motivos = list(
            qs_mes.values("motivo").annotate(c=Count("id")).order_by("-c")[:5]
        )
        motivos_map = dict(MotivoVisita.choices)
        top_motivos_fmt = [{
            "motivo": motivos_map.get(m["motivo"], m["motivo"]),
            "cantidad": m["c"],
        } for m in top_motivos]

        return Response({
            "hoy": qs_hoy.count(),
            "semana": qs_semana.count(),
            "mes": qs_mes.count(),
            "dentro_ahora": dentro,
            "duracion_promedio_minutos": duracion_prom_min,
            "top_motivos_mes": top_motivos_fmt,
        })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalogo_motivos(request):
    return Response([{"codigo": c, "etiqueta": e} for c, e in MotivoVisita.choices])


# ═════════════════════════════════════════════════════════════════════════════
# AUTO-REGISTRO POR QR (público, sin auth)
# ═════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="120/m")
def info_campana(request, token):
    """Devuelve la info de la campaña de auto-registro (para mostrar en el form público)."""
    c = CampanaAutoRegistro.objects.filter(token=token, activa=True).first()
    if not c:
        return Response({"error": "Este QR no está activo."}, status=404)
    return Response({
        "campana_id": c.pk,
        "nombre": c.nombre,
        "requiere_confirmacion": c.requiere_confirmacion,
        "motivo_forzado": c.motivo_forzado,
        "a_quien_visita_forzado": c.a_quien_visita_forzado,
        "mensaje_bienvenida": c.mensaje_bienvenida,
        "motivos_disponibles": [{"codigo": c_, "etiqueta": e} for c_, e in MotivoVisita.choices],
        "instituto": ConfiguracionInstitucional.get_solo().nombre_institucion or "Institución Educativa",
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="20/h")
def auto_registrar(request, token):
    """Registra una visita desde el QR público."""
    c = CampanaAutoRegistro.objects.filter(token=token, activa=True).first()
    if not c:
        return Response({"error": "QR inválido o inactivo."}, status=404)

    dni = (request.data.get("dni") or "").strip()
    nombre = (request.data.get("nombre_completo") or "").strip()
    telefono = (request.data.get("telefono") or "").strip()
    motivo = request.data.get("motivo") or c.motivo_forzado or "otro"
    a_quien = request.data.get("a_quien_visita") or c.a_quien_visita_forzado or ""
    observaciones = request.data.get("observaciones", "")

    if len(dni) != 8 or not dni.isdigit():
        return Response({"error": "DNI debe ser 8 dígitos."}, status=400)
    if not nombre:
        return Response({"error": "Nombre requerido."}, status=400)
    if not a_quien:
        return Response({"error": "Debes indicar a quién visitas."}, status=400)

    estado = EstadoVisita.PENDIENTE if c.requiere_confirmacion else EstadoVisita.CONFIRMADA

    v = Visita.objects.create(
        dni=dni,
        nombre_completo=nombre,
        telefono=telefono,
        motivo=motivo,
        a_quien_visita=a_quien,
        observaciones=observaciones,
        origen=OrigenVisita.AUTO_REGISTRO,
        estado=estado,
        campana=c,
        registrado_por=None,
    )

    return Response({
        "ok": True,
        "requiere_confirmacion": c.requiere_confirmacion,
        "visita_id": v.pk,
        "codigo_gafete": str(v.codigo_gafete),
        "mensaje": (
            "Registro recibido. El personal de portería confirmará y entregará su gafete."
            if c.requiere_confirmacion
            else "Ingreso registrado. Puede recoger su gafete en portería."
        ),
    })


@api_view(["GET"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="60/m")
def qr_campana_publico(request, token):
    """PNG del QR para imprimir. La URL codificada es la del formulario público."""
    c = CampanaAutoRegistro.objects.filter(token=token, activa=True).first()
    if not c:
        return HttpResponse("Inactivo", status=404)
    # Codifica la URL absoluta del formulario público
    origen = request.build_absolute_uri("/").rstrip("/")
    # El QR apunta al frontend
    url_form = f"{origen}/registro-visita/{token}"
    # Cambiar el puerto del backend por el del frontend si es dev
    url_form = url_form.replace(":8000", ":5173")
    img = qrcode.make(url_form, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return HttpResponse(buf.getvalue(), content_type="image/png")


# Extensión del ViewSet: gestionar campañas
class CampanaAutoRegistroViewSet(viewsets.ModelViewSet):
    queryset = CampanaAutoRegistro.objects.all()
    permission_classes = [IsAuthenticated]

    def _check(self):
        if self.request.user.rol not in ("director", "subdirector", "admin_tic", "secretaria"):
            raise PermissionDenied()

    def get_serializer_class(self):
        from rest_framework import serializers as drf
        _Campana = CampanaAutoRegistro
        class _S(drf.ModelSerializer):
            class Meta:
                model = _Campana
                fields = "__all__"
                read_only_fields = ["id", "token", "creado_por", "creado_en", "actualizado_en"]
        return _S

    def create(self, request, *args, **kwargs):
        self._check()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._check()
        return super().update(request, *args, **kwargs)

    def partial_update(self, *a, **kw):
        return self.update(*a, **kw)

    def destroy(self, *a, **kw):
        self._check()
        return super().destroy(*a, **kw)

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)
