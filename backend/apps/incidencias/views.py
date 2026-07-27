from datetime import date, timedelta

from django.db.models import Avg, Count, ExpressionWrapper, F, fields
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.ia import servicios as ia_servicios
from apps.usuarios.models import Rol
from apps.usuarios.permissions import EsDirector, EsDirectorOAdminTIC

from .exportar import exportar_incidencias_excel, exportar_reporte_mensual_word
from .models import (
    ComentarioIncidencia,
    EstadoIncidencia,
    Incidencia,
    PrioridadIncidencia,
    TipoIncidencia,
)
from .permissions import PermisoIncidencia
from .serializers import ComentarioIncidenciaSerializer, IncidenciaSerializer


class IncidenciaViewSet(viewsets.ModelViewSet):
    serializer_class = IncidenciaSerializer
    permission_classes = [IsAuthenticated, PermisoIncidencia]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = Incidencia.objects.all().select_related(
            "reportado_por", "asignado_a", "estudiante_afectado__usuario"
        )
        # Docente solo ve las suyas; admin_tic y director ven todas.
        if user.rol == Rol.DOCENTE:
            qs = qs.filter(reportado_por=user)
        elif user.rol == Rol.PADRE:
            try:
                hijos_ids = list(user.perfil_padre.hijos.values_list("pk", flat=True))
            except AttributeError:
                hijos_ids = []
            qs = qs.filter(estudiante_afectado_id__in=hijos_ids)
        # Filtro opcional por estudiante (para query desde Panel Familiar)
        est_id = self.request.GET.get("estudiante_afectado")
        if est_id:
            qs = qs.filter(estudiante_afectado_id=est_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(reportado_por=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        estado_anterior = instance.estado
        nuevo_estado = serializer.validated_data.get("estado", estado_anterior)

        extra = {}
        # nueva -> en_atencion: setear fecha_atencion y asignado_a si no está.
        if estado_anterior == EstadoIncidencia.NUEVA and nuevo_estado == EstadoIncidencia.EN_ATENCION:
            extra["fecha_atencion"] = timezone.now()
            if not instance.asignado_a_id:
                extra["asignado_a"] = self.request.user

        # cualquier estado -> resuelta: setear fecha_resolucion (validación de solucion ya en serializer)
        paso_a_resuelta = (
            estado_anterior != EstadoIncidencia.RESUELTA and nuevo_estado == EstadoIncidencia.RESUELTA
        )
        if paso_a_resuelta:
            extra["fecha_resolucion"] = timezone.now()

        serializer.save(**extra)

        # Notificar al reportante que su incidencia fue resuelta
        if paso_a_resuelta and instance.reportado_por_id and instance.reportado_por_id != self.request.user.id:
            try:
                from apps.notificaciones.servicios import notificar
                notificar(
                    destinatario=instance.reportado_por,
                    titulo=f"Incidencia resuelta: {instance.titulo}",
                    cuerpo=(
                        f"Tu incidencia TIC fue resuelta por {self.request.user.get_full_name() or self.request.user.username}. "
                        f"Solución: {serializer.validated_data.get('solucion') or instance.solucion or 'ver detalle'}."
                    ),
                    tipo="incidencias",
                    url_accion=f"/incidencias?id={instance.id}",
                )
            except Exception as e:  # noqa: BLE001
                import logging
                logging.getLogger(__name__).warning(f"No se notificó resolución de incidencia {instance.id}: {e}")

    def perform_destroy(self, instance):
        if self.request.user.rol != Rol.DIRECTOR:
            raise PermissionDenied("Solo el director puede eliminar incidencias.")
        instance.delete()

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        user = request.user
        if user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC pueden consultar los KPIs.")

        qs = Incidencia.objects.all()
        total = qs.count()

        # Por estado
        por_estado = {clave: 0 for clave, _ in EstadoIncidencia.choices}
        for row in qs.values("estado").annotate(c=Count("id")):
            por_estado[row["estado"]] = row["c"]

        # Por tipo
        por_tipo = {clave: 0 for clave, _ in TipoIncidencia.choices}
        for row in qs.values("tipo").annotate(c=Count("id")):
            por_tipo[row["tipo"]] = row["c"]

        # Por prioridad
        por_prioridad = {clave: 0 for clave, _ in PrioridadIncidencia.choices}
        for row in qs.values("prioridad").annotate(c=Count("id")):
            por_prioridad[row["prioridad"]] = row["c"]

        # Tiempo promedio de resolución en horas (solo resueltas)
        resueltas = qs.filter(
            estado__in=[EstadoIncidencia.RESUELTA, EstadoIncidencia.CERRADA],
            fecha_resolucion__isnull=False,
        ).annotate(
            duracion=ExpressionWrapper(
                F("fecha_resolucion") - F("creado_en"),
                output_field=fields.DurationField(),
            )
        )
        prom = resueltas.aggregate(prom=Avg("duracion"))["prom"]
        tiempo_promedio_horas = round(prom.total_seconds() / 3600, 2) if prom else 0.0

        # Top 5 ubicaciones
        top5 = list(
            qs.values("ubicacion")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )
        por_ubicacion_top5 = [
            {"ubicacion": r["ubicacion"], "count": r["count"]} for r in top5
        ]

        return Response({
            "total": total,
            "por_estado": por_estado,
            "por_tipo": por_tipo,
            "por_prioridad": por_prioridad,
            "tiempo_promedio_resolucion_horas": tiempo_promedio_horas,
            "por_ubicacion_top5": por_ubicacion_top5,
        })

    @action(detail=True, methods=["post"], url_path="sugerir-solucion")
    def sugerir_solucion(self, request, pk=None):
        """IA sugiere pasos de diagnóstico. Admin TIC solo."""
        if request.user.rol != Rol.ADMIN_TIC:
            raise PermissionDenied("Solo el administrador TIC puede pedir sugerencias.")

        inc = self.get_object()
        # Historial: 3 incidencias resueltas del mismo tipo
        historial = list(
            Incidencia.objects.filter(
                tipo=inc.tipo,
                estado__in=[EstadoIncidencia.RESUELTA, EstadoIncidencia.CERRADA],
            )
            .exclude(pk=inc.pk)
            .exclude(solucion="")
            .order_by("-fecha_resolucion")
            .values("titulo", "tipo", "solucion")[:3]
        )

        try:
            resultado = ia_servicios.sugerir_solucion(
                incidencia_dict={
                    "titulo": inc.titulo,
                    "descripcion": inc.descripcion,
                    "tipo": inc.tipo,
                    "ubicacion": inc.ubicacion,
                },
                historial_similar=historial,
                usuario=request.user,
            )
        except Exception as e:
            return Response({"error": f"Fallo al consultar la IA: {str(e)[:300]}"}, status=502)

        if resultado is None:
            return Response({"error": "No hay IA configurada. Configúrala en /admin-ia."}, status=400)

        return Response(resultado)

    # ── Comentarios (conversación docente ↔ admin TIC ↔ director) ────────────
    @action(
        detail=True,
        methods=["get", "post"],
        url_path="comentarios",
        permission_classes=[IsAuthenticated],
    )
    def comentarios(self, request, pk=None):
        """Listar y crear comentarios en el hilo de una incidencia."""
        incidencia = self.get_object()

        if request.method == "GET":
            qs = incidencia.comentarios.select_related("autor").all()
            return Response(ComentarioIncidenciaSerializer(qs, many=True).data)

        # POST — crear
        texto = (request.data.get("texto") or "").strip()
        if not texto:
            return Response({"error": "El texto es obligatorio."}, status=400)
        if len(texto) > 2000:
            return Response({"error": "Máximo 2000 caracteres."}, status=400)

        comentario = ComentarioIncidencia.objects.create(
            incidencia=incidencia,
            autor=request.user,
            texto=texto,
        )
        return Response(
            ComentarioIncidenciaSerializer(comentario).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="exportar-excel")
    def exportar_excel(self, request):
        """Descarga xlsx con todas las incidencias filtrables por rango de fechas."""
        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC.")

        qs = Incidencia.objects.all().order_by("-creado_en")
        desde = request.GET.get("desde")
        hasta = request.GET.get("hasta")
        if desde:
            qs = qs.filter(creado_en__gte=desde)
        if hasta:
            qs = qs.filter(creado_en__lte=hasta)

        blob = exportar_incidencias_excel(qs)
        resp = HttpResponse(
            blob,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        nombre = f"incidencias_{timezone.now().strftime('%Y-%m-%d')}.xlsx"
        resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
        return resp

    def _rango_mes(self, mes_param):
        hoy = timezone.now().date()
        if mes_param:
            try:
                anio, mes_num = mes_param.split("-")
                mes_inicio = date(int(anio), int(mes_num), 1)
            except (ValueError, TypeError):
                mes_inicio = hoy.replace(day=1)
        else:
            mes_inicio = hoy.replace(day=1)
        if mes_inicio.month == 12:
            mes_fin = date(mes_inicio.year + 1, 1, 1)
        else:
            mes_fin = date(mes_inicio.year, mes_inicio.month + 1, 1)
        return mes_inicio, mes_fin

    @action(detail=False, methods=["get"], url_path="reporte-mensual-preview")
    def reporte_mensual_preview(self, request):
        """Devuelve KPIs + narrativa IA para previsualizar y editar antes de descargar el Word."""
        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC.")

        mes_inicio, mes_fin = self._rango_mes(request.GET.get("mes"))
        qs = Incidencia.objects.filter(creado_en__gte=mes_inicio, creado_en__lt=mes_fin)
        kpis_data = self._calcular_kpis(qs)
        ejemplos = list(qs.order_by("-creado_en")[:5].values("titulo", "estado", "ubicacion"))

        try:
            texto = ia_servicios.resumen_ejecutivo(kpis_data, ejemplos_recientes=ejemplos, usuario=request.user)
        except Exception as e:
            texto = f"[No se pudo generar la narrativa automática: {str(e)[:200]}]"

        if not texto:
            texto = (
                f"Durante el periodo se registraron {kpis_data['total']} incidencias TIC. "
                f"El tiempo promedio de resolución fue de {kpis_data['tiempo_promedio_resolucion_horas']} horas."
            )

        return Response({
            "mes": mes_inicio.strftime("%Y-%m"),
            "mes_etiqueta": mes_inicio.strftime("%B %Y"),
            "kpis": kpis_data,
            "texto_ia": texto,
        })

    @action(detail=False, methods=["get", "post"], url_path="reporte-mensual-word")
    def reporte_mensual_word(self, request):
        """Genera un reporte mensual en Word.
        - GET: usa datos + IA para redactar (backward compat).
        - POST: acepta {"mes":"YYYY-MM","texto":"..."} con la narrativa editada."""
        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC.")

        if request.method == "POST":
            mes_param = request.data.get("mes")
            texto_editado = (request.data.get("texto") or "").strip()
        else:
            mes_param = request.GET.get("mes")
            texto_editado = None

        mes_inicio, mes_fin = self._rango_mes(mes_param)
        qs = Incidencia.objects.filter(creado_en__gte=mes_inicio, creado_en__lt=mes_fin)
        kpis_data = self._calcular_kpis(qs)

        if texto_editado:
            texto_ia = texto_editado
        else:
            ejemplos = list(qs.order_by("-creado_en")[:5].values("titulo", "estado", "ubicacion"))
            try:
                texto_ia = ia_servicios.resumen_ejecutivo(kpis_data, ejemplos_recientes=ejemplos, usuario=request.user)
            except Exception as e:
                texto_ia = f"[No se pudo generar la narrativa automática: {str(e)[:200]}]"
            if not texto_ia:
                texto_ia = (
                    f"Durante el periodo se registraron {kpis_data['total']} incidencias TIC. "
                    f"El tiempo promedio de resolución fue de {kpis_data['tiempo_promedio_resolucion_horas']} horas."
                )

        blob = exportar_reporte_mensual_word(kpis_data, texto_ia, mes_inicio)
        resp = HttpResponse(
            blob,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        nombre = f"reporte_incidencias_{mes_inicio.strftime('%Y-%m')}.docx"
        resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
        return resp

    @action(detail=False, methods=["get"], url_path="resumen-ejecutivo")
    def resumen_ejecutivo(self, request):
        """IA genera resumen en markdown para el director."""
        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC pueden pedir el resumen.")

        # KPIs reales (mismo cálculo que kpis)
        qs = Incidencia.objects.filter(creado_en__gte=timezone.now() - timedelta(days=7))
        kpis_data = self._calcular_kpis(qs)

        ejemplos = list(qs.order_by("-creado_en")[:5].values(
            "titulo", "estado", "ubicacion"
        ))

        try:
            markdown = ia_servicios.resumen_ejecutivo(kpis_data, ejemplos_recientes=ejemplos, usuario=request.user)
        except Exception as e:
            return Response({"error": f"Fallo al consultar la IA: {str(e)[:300]}"}, status=502)

        if markdown is None:
            return Response({"error": "No hay IA configurada."}, status=400)

        return Response({"markdown": markdown, "periodo": "últimos 7 días"})

    def _calcular_kpis(self, qs):
        """Helper reutilizado por kpis y resumen_ejecutivo."""
        total = qs.count()
        por_estado = {c: qs.filter(estado=c).count() for c, _ in EstadoIncidencia.choices}
        por_tipo = {c: qs.filter(tipo=c).count() for c, _ in TipoIncidencia.choices}
        por_prioridad = {c: qs.filter(prioridad=c).count() for c, _ in PrioridadIncidencia.choices}

        resueltas = qs.filter(
            estado__in=[EstadoIncidencia.RESUELTA, EstadoIncidencia.CERRADA],
            fecha_resolucion__isnull=False,
        ).annotate(
            duracion=ExpressionWrapper(
                F("fecha_resolucion") - F("creado_en"),
                output_field=fields.DurationField(),
            )
        )
        prom = resueltas.aggregate(prom=Avg("duracion"))["prom"]
        tiempo_prom = round(prom.total_seconds() / 3600, 2) if prom else 0.0

        top5 = list(
            qs.values("ubicacion")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )
        return {
            "total": total,
            "por_estado": por_estado,
            "por_tipo": por_tipo,
            "por_prioridad": por_prioridad,
            "tiempo_promedio_resolucion_horas": tiempo_prom,
            "por_ubicacion_top5": [{"ubicacion": r["ubicacion"], "count": r["count"]} for r in top5],
        }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def clasificar_incidencia(request):
    """IA convierte texto libre en campos estructurados.
    Endpoint standalone porque se usa ANTES de crear la incidencia."""
    if request.user.rol not in (Rol.DOCENTE, Rol.ADMIN_TIC):
        raise PermissionDenied("Solo docente o admin TIC.")

    texto = request.data.get("texto", "").strip()
    if not texto:
        return Response({"error": "El campo 'texto' es obligatorio."}, status=400)
    if len(texto) < 5:
        return Response({"error": "El texto es demasiado corto."}, status=400)

    try:
        resultado = ia_servicios.clasificar_incidencia(texto, usuario=request.user)
    except Exception as e:
        return Response({"error": f"Fallo al consultar la IA: {str(e)[:300]}"}, status=502)

    if resultado is None:
        return Response({"error": "No hay IA configurada."}, status=400)

    return Response(resultado)
