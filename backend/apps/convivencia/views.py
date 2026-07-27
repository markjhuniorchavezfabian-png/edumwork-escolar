from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Rol

from .models import (
    CasoConvivencia, EstadoCaso, SeguimientoCaso, TipoCaso, GravedadCaso,
    PLAZO_HABIL_POR_PROTOCOLO, DEFINICION_PROTOCOLO,
)
from .serializers import CasoConvivenciaSerializer, SeguimientoCasoSerializer


ROLES_EQUIPO_CONVIVENCIA = (
    Rol.DIRECTOR, Rol.SUBDIRECTOR, Rol.PSICOLOGA,
    Rol.AUXILIAR, Rol.DOCENTE,  # tutor puede iniciar
)


class CasoConvivenciaViewSet(viewsets.ModelViewSet):
    serializer_class = CasoConvivenciaSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = CasoConvivencia.objects.all().prefetch_related(
            "estudiantes_afectados__usuario",
            "estudiantes_agresores__usuario",
            "seguimientos",
        )
        # Solo equipo de convivencia y padres de estudiantes afectados
        if user.rol in ROLES_EQUIPO_CONVIVENCIA:
            return qs
        if user.rol == Rol.PADRE:
            # Padres solo ven casos donde su hijo es afectado
            try:
                hijos_ids = list(user.perfil_padre.hijos.values_list("id", flat=True))
                return qs.filter(estudiantes_afectados__id__in=hijos_ids).distinct()
            except Exception:
                return qs.none()
        return qs.none()

    def create(self, request, *args, **kwargs):
        if request.user.rol not in ROLES_EQUIPO_CONVIVENCIA:
            raise PermissionDenied("Solo el equipo de convivencia puede iniciar casos.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(reportado_por=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        if self.request.user.rol not in ROLES_EQUIPO_CONVIVENCIA:
            raise PermissionDenied()
        # Auto-set responsable si no está
        if not instance.responsable_id and self.request.user.rol == Rol.PSICOLOGA:
            serializer.save(responsable=self.request.user)
        else:
            serializer.save()

    @action(detail=True, methods=["post"], url_path="seguimientos")
    def agregar_seguimiento(self, request, pk=None):
        if request.user.rol not in ROLES_EQUIPO_CONVIVENCIA:
            raise PermissionDenied()
        caso = self.get_object()
        data = {**request.data, "caso": caso.pk}
        ser = SeguimientoCasoSerializer(data=data)
        ser.is_valid(raise_exception=True)
        ser.save(autor=request.user, caso=caso)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="marcar-siseve")
    def marcar_siseve(self, request, pk=None):
        if request.user.rol not in (Rol.DIRECTOR, Rol.PSICOLOGA):
            raise PermissionDenied()
        caso = self.get_object()
        caso.reportado_siseve = True
        caso.fecha_reporte_siseve = timezone.now()
        caso.save(update_fields=["reportado_siseve", "fecha_reporte_siseve"])
        return Response(CasoConvivenciaSerializer(caso).data)

    @action(detail=False, methods=["get"], url_path="protocolos-rm-383")
    def protocolos_rm_383(self, request):
        """RM 383-2025-MINEDU · Catálogo de los 7 protocolos con plazos hábiles y definiciones."""
        return Response({
            "norma": "RM 383-2025-MINEDU",
            "protocolos": [
                {
                    "codigo": code,
                    "label": label,
                    "plazo_dias_habiles": PLAZO_HABIL_POR_PROTOCOLO.get(code, 30),
                    "definicion": DEFINICION_PROTOCOLO.get(code, ""),
                }
                for code, label in TipoCaso.choices
            ],
            "actores_cgb": [
                "director",
                "responsable_convivencia_escolar",
                "coordinador_tutoria",
                "responsable_inclusion (si involucra estudiante con discapacidad)",
            ],
            "instrumentos_obligatorios": [
                "Libro de Registro de Incidencias",
                "Portal SíseVe (siseve.minedu.gob.pe) — registro en día 3",
                "Actas de reunión (CGB, padres, tutores)",
                "Informe bimestral de seguimiento",
            ],
        })

    @action(detail=True, methods=["post"], url_path="marcar-paso")
    def marcar_paso(self, request, pk=None):
        """Marca un paso del protocolo como completado (o des-completado).

        POST body: {"paso_idx": 0, "completado": true}
        """
        if request.user.rol not in ROLES_EQUIPO_CONVIVENCIA:
            raise PermissionDenied()
        caso = self.get_object()
        idx = request.data.get("paso_idx")
        completado = bool(request.data.get("completado", True))
        if idx is None or idx < 0 or idx >= len(caso.pasos_protocolo):
            return Response({"error": "paso_idx inválido"}, status=400)
        pasos = list(caso.pasos_protocolo)
        pasos[idx] = {**pasos[idx], "completado": completado,
                      "fecha": timezone.now().isoformat() if completado else None,
                      "usuario": request.user.username if completado else None}
        caso.pasos_protocolo = pasos
        caso.save(update_fields=["pasos_protocolo"])
        return Response(CasoConvivenciaSerializer(caso).data)

    @action(detail=True, methods=["post"], url_path="marcar-libro")
    def marcar_libro(self, request, pk=None):
        """Marca la incidencia como registrada en el Libro de Registro de Incidencias."""
        if request.user.rol not in (Rol.DIRECTOR, Rol.PSICOLOGA):
            raise PermissionDenied()
        caso = self.get_object()
        caso.registrado_libro_incidencias = True
        caso.fecha_registro_libro = timezone.now()
        caso.save(update_fields=["registrado_libro_incidencias", "fecha_registro_libro"])
        return Response(CasoConvivenciaSerializer(caso).data)

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        if request.user.rol not in ROLES_EQUIPO_CONVIVENCIA:
            raise PermissionDenied()

        qs = CasoConvivencia.objects.all()
        activos = qs.exclude(estado__in=[EstadoCaso.CERRADO, EstadoCaso.CERRADO_FALSO])
        cerrados = qs.filter(estado__in=[EstadoCaso.CERRADO, EstadoCaso.CERRADO_FALSO])

        # Alertas por plazo
        hoy = timezone.now()
        urgentes = activos.filter(fecha_limite__lte=hoy + timezone.timedelta(days=5)).count()
        vencidos = activos.filter(fecha_limite__lt=hoy).count()

        por_tipo = {c: qs.filter(tipo=c).count() for c, _ in TipoCaso.choices}
        por_gravedad = {c: qs.filter(gravedad=c).count() for c, _ in GravedadCaso.choices}
        siseve_reportados = qs.filter(reportado_siseve=True).count()

        return Response({
            "total": qs.count(),
            "activos": activos.count(),
            "cerrados": cerrados.count(),
            "urgentes": urgentes,
            "vencidos": vencidos,
            "por_tipo": {k: v for k, v in por_tipo.items() if v > 0},
            "por_gravedad": por_gravedad,
            "reportados_siseve": siseve_reportados,
        })
