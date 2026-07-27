"""Vistas para asistencia por sesión (uso de laboratorios, AIP, biblioteca)."""
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import serializers as drf_s, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Estudiante, Rol

from apps.asistencia.views import _secciones_docente_ids

from .models import AsistenciaSesion, SesionClase


ROLES_DICTAR = ("director", "subdirector", "docente", "auxiliar", "psicologa")


class AsistenciaSesionSerializer(drf_s.ModelSerializer):
    estudiante_nombre = drf_s.SerializerMethodField(read_only=True)

    class Meta:
        model = AsistenciaSesion
        fields = ["id", "sesion", "estudiante", "estudiante_nombre",
                  "presente", "hora_llegada", "marcado_por", "creado_en"]
        read_only_fields = ["id", "marcado_por", "creado_en"]

    def get_estudiante_nombre(self, obj):
        return obj.estudiante.usuario.get_full_name()


class SesionClaseSerializer(drf_s.ModelSerializer):
    ambiente_nombre = drf_s.CharField(source="ambiente.nombre", read_only=True)
    ambiente_tipo = drf_s.CharField(source="ambiente.tipo", read_only=True)
    docente_nombre = drf_s.SerializerMethodField(read_only=True)
    seccion_nombre = drf_s.CharField(source="seccion.nombre", read_only=True, default=None)
    duracion_minutos = drf_s.IntegerField(read_only=True)
    total_presentes = drf_s.SerializerMethodField(read_only=True)
    asistencias = AsistenciaSesionSerializer(many=True, read_only=True)

    competencia_nombre = drf_s.CharField(
        source="competencia_cneb.nombre", read_only=True, default=None
    )
    capacidad_nombre = drf_s.CharField(
        source="capacidad_cneb.nombre", read_only=True, default=None
    )

    class Meta:
        model = SesionClase
        fields = [
            "id", "ambiente", "ambiente_nombre", "ambiente_tipo",
            "docente", "docente_nombre",
            "seccion", "seccion_nombre",
            "area_curricular", "competencia_cneb", "competencia_nombre",
            "capacidad_cneb", "capacidad_nombre",
            "tema", "fecha", "hora_inicio", "hora_fin",
            "duracion_minutos", "observaciones",
            "total_presentes", "asistencias",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "docente", "duracion_minutos", "asistencias",
                             "creado_en", "actualizado_en"]

    def get_docente_nombre(self, obj):
        return obj.docente.get_full_name() or obj.docente.username

    def get_total_presentes(self, obj):
        return obj.asistencias.filter(presente=True).count()


class SesionClaseViewSet(viewsets.ModelViewSet):
    serializer_class = SesionClaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = SesionClase.objects.select_related("ambiente", "docente", "seccion").all()

        # Docente ve sus sesiones + las de sus secciones (Q evita duplicados vs. OR de querysets)
        if user.rol == Rol.DOCENTE:
            from django.db.models import Q
            secciones_ids = _secciones_docente_ids(user)
            qs = qs.filter(Q(docente=user) | Q(seccion_id__in=secciones_ids)).distinct()
        elif user.rol not in ("director", "subdirector", "admin_tic", "secretaria", "auxiliar", "psicologa"):
            return qs.none()

        # Filtros
        ambiente = self.request.GET.get("ambiente")
        docente = self.request.GET.get("docente")
        fecha = self.request.GET.get("fecha")
        desde = self.request.GET.get("desde")
        hasta = self.request.GET.get("hasta")
        activas = self.request.GET.get("activas")
        if ambiente:
            qs = qs.filter(ambiente_id=ambiente)
        if docente:
            qs = qs.filter(docente_id=docente)
        if fecha:
            qs = qs.filter(fecha=fecha)
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)
        if activas in ("1", "true", "True"):
            qs = qs.filter(hora_fin__isnull=True)

        return qs.distinct().order_by("-fecha", "-hora_inicio")

    def create(self, request, *args, **kwargs):
        if request.user.rol not in ROLES_DICTAR:
            raise PermissionDenied("Este rol no puede iniciar sesiones.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Auto: si no viene fecha/hora_inicio, ahora
        extra = {"docente": self.request.user}
        if not serializer.validated_data.get("fecha"):
            extra["fecha"] = timezone.localdate()
        if not serializer.validated_data.get("hora_inicio"):
            extra["hora_inicio"] = timezone.localtime().time().replace(second=0, microsecond=0)
        serializer.save(**extra)

    @action(detail=True, methods=["post"], url_path="cerrar")
    def cerrar(self, request, pk=None):
        """Cierra la sesión (marca hora_fin = ahora)."""
        s = self.get_object()
        if s.docente_id != request.user.id and request.user.rol not in ("director", "subdirector"):
            raise PermissionDenied("Solo el docente que abrió la sesión puede cerrarla.")
        if s.hora_fin:
            return Response({"error": "La sesión ya está cerrada."}, status=400)
        s.hora_fin = timezone.localtime().time().replace(second=0, microsecond=0)
        s.observaciones = request.data.get("observaciones", s.observaciones)
        s.save(update_fields=["hora_fin", "observaciones", "actualizado_en"])
        return Response(SesionClaseSerializer(s).data)

    @action(detail=True, methods=["post"], url_path="marcar-qr")
    def marcar_qr(self, request, pk=None):
        """Marca a un estudiante presente en la sesión, por código QR."""
        s = self.get_object()
        if s.hora_fin:
            return Response({"error": "La sesión ya está cerrada."}, status=400)
        codigo = (request.data.get("codigo") or "").strip()
        if not codigo:
            return Response({"error": "codigo requerido"}, status=400)
        est = Estudiante.objects.filter(codigo_matricula=codigo).select_related("usuario").first()
        if not est:
            return Response({"error": f"No hay estudiante con código '{codigo}'."}, status=404)

        obj, creado = AsistenciaSesion.objects.update_or_create(
            sesion=s, estudiante=est,
            defaults={
                "presente": True,
                "hora_llegada": timezone.localtime().time().replace(second=0, microsecond=0),
                "marcado_por": request.user,
            },
        )
        return Response({
            "ok": True,
            "nueva": creado,
            "estudiante": {
                "id": est.pk,
                "nombre": est.usuario.get_full_name(),
                "codigo": est.codigo_matricula,
                "grado": est.grado,
                "seccion": est.seccion,
            },
        })

    @action(detail=True, methods=["post"], url_path="marcar-lista")
    def marcar_lista(self, request, pk=None):
        """Marca varios estudiantes de una sección de golpe.
        Payload: {"estudiantes": [id1, id2, ...]}"""
        s = self.get_object()
        if s.hora_fin:
            return Response({"error": "La sesión ya está cerrada."}, status=400)
        ids = request.data.get("estudiantes", [])
        if not isinstance(ids, list):
            return Response({"error": "estudiantes debe ser lista de ids"}, status=400)
        agregados = 0
        for eid in ids:
            est = Estudiante.objects.filter(pk=eid).first()
            if not est:
                continue
            AsistenciaSesion.objects.update_or_create(
                sesion=s, estudiante=est,
                defaults={"presente": True, "marcado_por": request.user},
            )
            agregados += 1
        return Response({"ok": True, "agregados": agregados})

    @action(detail=False, methods=["get"], url_path="kpis-uso")
    def kpis_uso(self, request):
        """Estadísticas de USO REAL de ambientes (para director + UGEL)."""
        if request.user.rol not in ("director", "subdirector", "admin_tic"):
            raise PermissionDenied()
        desde = request.GET.get("desde") or (timezone.localdate() - timezone.timedelta(days=30))
        qs = SesionClase.objects.filter(fecha__gte=desde)
        por_ambiente = list(
            qs.values("ambiente__nombre", "ambiente__tipo")
            .annotate(sesiones=Count("id"))
            .order_by("-sesiones")[:10]
        )
        return Response({
            "desde": str(desde),
            "total_sesiones": qs.count(),
            "por_ambiente_top10": [{
                "ambiente": r["ambiente__nombre"],
                "tipo": r["ambiente__tipo"],
                "sesiones": r["sesiones"],
            } for r in por_ambiente],
        })
