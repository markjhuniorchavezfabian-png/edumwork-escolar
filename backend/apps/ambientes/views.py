import io

import qrcode
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers as drf_s, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Rol

from .models import Ambiente, BitacoraUsoAmbiente, EstadoBitacora, TipoAmbiente
from .serializers import AmbienteSerializer


class BitacoraUsoSerializer(drf_s.ModelSerializer):
    ambiente_nombre = drf_s.CharField(source="ambiente.nombre", read_only=True)
    ambiente_codigo = drf_s.CharField(source="ambiente.codigo", read_only=True)
    usuario_nombre = drf_s.SerializerMethodField(read_only=True)
    estado_salida_label = drf_s.CharField(source="get_estado_salida_display", read_only=True)
    abierta = drf_s.BooleanField(read_only=True)

    class Meta:
        model = BitacoraUsoAmbiente
        fields = [
            "id", "ambiente", "ambiente_nombre", "ambiente_codigo",
            "usuario", "usuario_nombre",
            "motivo", "inicio", "fin",
            "estado_salida", "estado_salida_label", "observaciones",
            "incidencia_relacionada", "abierta",
        ]
        read_only_fields = ["id", "usuario", "usuario_nombre",
                            "ambiente_nombre", "ambiente_codigo",
                            "inicio", "estado_salida_label", "abierta",
                            "incidencia_relacionada"]

    def get_usuario_nombre(self, obj):
        u = obj.usuario
        return f"{u.first_name} {u.last_name}".strip() or u.username


ROLES_GESTIONAN_AMBIENTES = ("director", "subdirector", "admin_tic", "secretaria")


class AmbienteViewSet(viewsets.ModelViewSet):
    queryset = Ambiente.objects.all()
    serializer_class = AmbienteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Ambiente.objects.all()
        for campo in ("tipo", "reservable", "activo"):
            v = self.request.GET.get(campo)
            if v is not None and v != "":
                if campo in ("reservable", "activo"):
                    qs = qs.filter(**{campo: v.lower() in ("true", "1")})
                else:
                    qs = qs.filter(**{campo: v})
        q = self.request.GET.get("q")
        if q:
            qs = qs.filter(Q(nombre__icontains=q) | Q(codigo__icontains=q))
        return qs.distinct()

    def _check_gestion(self):
        if self.request.user.rol not in ROLES_GESTIONAN_AMBIENTES:
            raise PermissionDenied("Solo el equipo directivo o secretaría puede gestionar ambientes.")

    def create(self, request, *args, **kwargs):
        self._check_gestion()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._check_gestion()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._check_gestion()
        # Soft delete: marcar inactivo
        instance = self.get_object()
        instance.activo = False
        instance.save(update_fields=["activo"])
        return Response(status=204)

    @action(detail=False, methods=["get"], url_path="tipos")
    def tipos(self, request):
        from .models import TIPOS_RESERVABLES
        return Response([
            {"codigo": c, "etiqueta": e, "reservable_por_default": c in TIPOS_RESERVABLES}
            for c, e in TipoAmbiente.choices
        ])

    @action(detail=False, methods=["get"], url_path="por-codigo/(?P<codigo>[^/]+)")
    def por_codigo(self, request, codigo=None):
        """Buscar ambiente por su código (usado desde el escáner QR)."""
        amb = Ambiente.objects.filter(codigo__iexact=codigo, activo=True).first()
        if not amb:
            return Response({"error": f"No hay ambiente con código '{codigo}'."}, status=404)
        return Response(AmbienteSerializer(amb).data)

    @action(detail=True, methods=["get"], url_path="qr")
    def qr_ambiente(self, request, pk=None):
        """PNG del QR del ambiente. Codifica una URL a la vista pública del ambiente."""
        amb = self.get_object()
        # URL del deep-link: el frontend enrutará a /ambiente/CODIGO
        origen = request.build_absolute_uri("/").rstrip("/").replace(":8000", ":5173")
        payload = f"{origen}/ambiente/{amb.codigo}"
        buf = io.BytesIO()
        img = qrcode.make(payload, box_size=10, border=2)
        img.save(buf, format="PNG")
        buf.seek(0)
        return HttpResponse(buf.getvalue(), content_type="image/png")

    @action(detail=True, methods=["get"], url_path="etiqueta-qr")
    def etiqueta_qr(self, request, pk=None):
        """PDF listo para imprimir con el QR del ambiente + código y nombre grandes."""
        from reportlab.lib.pagesizes import A5
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader

        amb = self.get_object()
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A5)
        ancho, alto = A5

        # Título
        from apps.core.models import ConfiguracionInstitucional
        cfg = ConfiguracionInstitucional.get_solo()
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(ancho / 2, alto - 40, cfg.nombre_institucion or "Institución Educativa")
        c.setFont("Helvetica", 11)
        c.drawCentredString(ancho / 2, alto - 60, "Sistema TIC — Registro de uso de ambiente")

        # QR grande al centro
        origen = request.build_absolute_uri("/").rstrip("/").replace(":8000", ":5173")
        payload = f"{origen}/ambiente/{amb.codigo}"
        qr_img = qrcode.make(payload, box_size=10, border=2)
        qr_bio = io.BytesIO()
        qr_img.save(qr_bio, format="PNG")
        qr_bio.seek(0)
        qr_size = 220
        c.drawImage(ImageReader(qr_bio), (ancho - qr_size) / 2, alto / 2 - qr_size / 2 + 20,
                    width=qr_size, height=qr_size)

        # Código y nombre debajo
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(ancho / 2, alto / 2 - qr_size / 2 - 10, amb.codigo)
        c.setFont("Helvetica", 14)
        c.drawCentredString(ancho / 2, alto / 2 - qr_size / 2 - 32, amb.nombre)

        # Instrucciones
        c.setFont("Helvetica", 10)
        c.drawCentredString(ancho / 2, 40, "Escanea con la app del Sistema TIC para registrar tu uso")

        c.showPage()
        c.save()
        buf.seek(0)
        return HttpResponse(buf.getvalue(), content_type="application/pdf",
                            headers={"Content-Disposition": f'attachment; filename="qr-{amb.codigo}.pdf"'})


class BitacoraUsoViewSet(viewsets.ModelViewSet):
    """Bitácora de uso de ambientes: cada docente registra que está usando el ambiente
    (idealmente escaneando el QR pegado en la puerta) y al terminar cierra la sesión
    reportando el estado."""
    serializer_class = BitacoraUsoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = BitacoraUsoAmbiente.objects.select_related("ambiente", "usuario", "incidencia_relacionada")
        ambiente = self.request.GET.get("ambiente")
        codigo = self.request.GET.get("codigo")
        abiertas = self.request.GET.get("abiertas")
        if ambiente:
            qs = qs.filter(ambiente_id=ambiente)
        if codigo:
            qs = qs.filter(ambiente__codigo__iexact=codigo)
        if abiertas == "true":
            qs = qs.filter(fin__isnull=True)
        # Docentes/etc. ven sus propias entradas; dirección y admin_tic ven todas
        if user.rol not in ("director", "subdirector", "admin_tic"):
            qs = qs.filter(usuario=user)
        return qs.order_by("-inicio")

    def perform_create(self, serializer):
        # No permitir 2 bitácoras abiertas simultáneas del mismo user en el mismo ambiente
        user = self.request.user
        ambiente = serializer.validated_data.get("ambiente")
        abierta = BitacoraUsoAmbiente.objects.filter(
            usuario=user, ambiente=ambiente, fin__isnull=True
        ).first()
        if abierta:
            raise PermissionDenied(
                f"Ya tenés una sesión abierta en este ambiente desde {abierta.inicio:%H:%M}. Cerrala antes."
            )
        serializer.save(usuario=user)

    @action(detail=True, methods=["post"], url_path="cerrar")
    def cerrar(self, request, pk=None):
        """Cerrar la bitácora, reportar estado del ambiente y opcionalmente
        crear una incidencia si algo estaba mal."""
        bit = self.get_object()
        if bit.usuario_id != request.user.id and request.user.rol not in ("director", "subdirector", "admin_tic"):
            raise PermissionDenied("Solo el que abrió la sesión puede cerrarla.")
        if bit.fin:
            return Response({"error": "Esta bitácora ya fue cerrada."}, status=400)

        estado = request.data.get("estado_salida") or EstadoBitacora.OK
        observaciones = (request.data.get("observaciones") or "").strip()

        bit.fin = timezone.now()
        bit.estado_salida = estado
        bit.observaciones = observaciones
        bit.save()

        # Si reporta incidente y quiere crear incidencia
        if estado == EstadoBitacora.INCIDENTE and request.data.get("crear_incidencia"):
            from apps.incidencias.models import EstadoIncidencia, Incidencia, PrioridadIncidencia, TipoIncidencia
            inc = Incidencia.objects.create(
                titulo=f"[{bit.ambiente.codigo}] Reporte desde bitácora",
                descripcion=observaciones or f"Reportado durante uso de {bit.ambiente.nombre}",
                ubicacion=bit.ambiente.nombre,
                tipo=TipoIncidencia.OTRO,
                prioridad=PrioridadIncidencia.MEDIA,
                estado=EstadoIncidencia.NUEVA,
                reportado_por=request.user,
            )
            bit.incidencia_relacionada = inc
            bit.save(update_fields=["incidencia_relacionada"])

        return Response(BitacoraUsoSerializer(bit).data)
