import io
from datetime import date, datetime, timedelta

from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import ConfiguracionInstitucional
from apps.notificaciones.servicios import notificar
from apps.usuarios.models import Rol, Usuario

from .models import EstadoAsistenciaPersonal, RegistroPersonal
from .serializers import RegistroPersonalSerializer


ROLES_STAFF = ("director", "subdirector", "docente", "admin_tic", "secretaria",
               "auxiliar", "psicologa", "conserje")
ROLES_APROBADORES = ("director", "subdirector", "secretaria", "admin_tic")


def _determinar_hora_esperada_personal(usuario, config: ConfiguracionInstitucional, fecha=None):
    """Calcula la hora de ingreso esperada para el miembro del personal."""
    from datetime import time
    hoy = fecha or date.today()
    dias_map = {0: "lun", 1: "mar", 2: "mie", 3: "jue", 4: "vie", 5: "sab"}
    dia_codigo = dias_map.get(hoy.weekday())

    # 1. Si es docente y tiene horario de clases hoy
    if usuario.rol == "docente" and dia_codigo:
        try:
            from apps.notas.models import HorarioClase
            primer_bloque = HorarioClase.objects.filter(
                asignacion__docente=usuario,
                dia_semana=dia_codigo,
            ).order_by("hora_inicio").first()
            if primer_bloque:
                return primer_bloque.hora_inicio
        except Exception:
            pass

    # 2. Si tiene perfil de docente con turno o jornada individual
    perfil_doc = getattr(usuario, "perfil_docente", None)
    if perfil_doc:
        if perfil_doc.hora_entrada_jornada:
            return perfil_doc.hora_entrada_jornada
        if perfil_doc.turno == "tarde":
            return time(12, 45)

    # 3. Fallback: hora_tope_entrada_personal institucional
    return config.hora_tope_entrada_personal or time(8, 0)


def _determinar_estado(hora_entrada, usuario, config: ConfiguracionInstitucional, fecha=None):
    """Auto-detecta si es tardanza según hora tope esperada individual + tolerancia."""
    if not hora_entrada:
        return EstadoAsistenciaPersonal.ASISTIO, False
    hoy = fecha or date.today()
    hora_tope = _determinar_hora_esperada_personal(usuario, config, hoy)
    tolerancia = timedelta(minutes=config.tolerancia_minutos)
    dt_tope = datetime.combine(hoy, hora_tope) + tolerancia
    dt_entrada = datetime.combine(hoy, hora_entrada)
    if dt_entrada > dt_tope:
        return EstadoAsistenciaPersonal.TARDANZA, True
    return EstadoAsistenciaPersonal.ASISTIO, False


def _distancia_metros(lat1, lng1, lat2, lng2):
    """Haversine — distancia entre 2 puntos GPS en metros."""
    from math import asin, cos, radians, sin, sqrt
    lat1_r, lng1_r, lat2_r, lng2_r = map(radians, [float(lat1), float(lng1), float(lat2), float(lng2)])
    d_lat = lat2_r - lat1_r
    d_lng = lng2_r - lng1_r
    a = sin(d_lat / 2) ** 2 + cos(lat1_r) * cos(lat2_r) * sin(d_lng / 2) ** 2
    c = 2 * asin(sqrt(a))
    R = 6_371_000  # radio Tierra en metros
    return int(R * c)


class RegistroPersonalViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroPersonalSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = RegistroPersonal.objects.select_related("usuario", "marcado_por")

        # Staff aprobador ve todo; el resto solo sus propios registros
        if user.rol not in ROLES_APROBADORES:
            qs = qs.filter(usuario=user)

        rol = self.request.GET.get("rol")
        estado = self.request.GET.get("estado")
        desde = self.request.GET.get("desde")
        hasta = self.request.GET.get("hasta")
        if rol:
            qs = qs.filter(usuario__rol=rol)
        if estado:
            qs = qs.filter(estado=estado)
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)
        return qs.order_by("-fecha", "usuario__last_name")

    @action(detail=False, methods=["post"], url_path="marcar-entrada")
    def marcar_entrada(self, request):
        """El usuario autenticado marca su propia entrada.
        Payload opcional: {"lat": -9.936, "lng": -76.238, "accuracy": 15}
        Si config.exigir_geolocalizacion=True, sin GPS se rechaza."""
        if request.user.rol not in ROLES_STAFF:
            raise PermissionDenied("Solo el personal puede marcar asistencia.")

        config = ConfiguracionInstitucional.get_solo()
        hora = timezone.localtime().time().replace(second=0, microsecond=0)
        estado, es_tardanza = _determinar_estado(hora, request.user, config)

        # ── Validación GPS ────────────────────────────────────────────────
        lat = request.data.get("lat")
        lng = request.data.get("lng")
        sin_geo = lat is None or lng is None
        distancia = None

        if sin_geo and config.exigir_geolocalizacion and config.latitud_ie is not None and config.longitud_ie is not None:
            return Response({
                "error": "La institución exige verificación GPS para marcar asistencia. "
                         "Habilita el permiso de ubicación en tu navegador.",
            }, status=400)

        if not sin_geo:
            if config.latitud_ie is not None and config.longitud_ie is not None:
                try:
                    distancia = _distancia_metros(lat, lng, config.latitud_ie, config.longitud_ie)
                except (TypeError, ValueError):
                    return Response({"error": "Coordenadas GPS inválidas."}, status=400)
                if distancia > config.radio_permitido_metros:
                    return Response({
                        "error": f"Estás a {distancia}m de la I.E. Solo se permite marcar dentro de {config.radio_permitido_metros}m.",
                        "distancia_metros": distancia,
                        "radio_permitido": config.radio_permitido_metros,
                    }, status=403)
            else:
                distancia = 0  # Coordenadas institucionales pendientes de configurar

        registro, creado = RegistroPersonal.objects.update_or_create(
            usuario=request.user,
            fecha=timezone.localdate(),
            defaults={
                "hora_entrada": hora,
                "estado": estado,
                "auto_tardanza": es_tardanza,
                "marcado_por": request.user,
                "lat_entrada": lat,
                "lng_entrada": lng,
                "distancia_metros": distancia,
                "sin_geo": sin_geo,
            },
        )

        # Notificar tardanzas al director + subdirector
        if es_tardanza:
            directivos = Usuario.objects.filter(rol__in=("director", "subdirector"), activo=True)
            for d in directivos:
                try:
                    notificar(
                        destinatario=d,
                        titulo=f"Tardanza: {request.user.get_full_name()}",
                        cuerpo=f"{request.user.get_full_name()} ({request.user.get_rol_display()}) marcó entrada a las {hora.strftime('%H:%M')}. Hora tope: {config.hora_tope_entrada_personal.strftime('%H:%M')}.",
                        tipo="asistencia",
                        url_accion="/asistencia-personal",
                    )
                except Exception:
                    pass

        return Response({
            "ok": True,
            "creado": creado,
            "registro": RegistroPersonalSerializer(registro).data,
        })

    @action(detail=False, methods=["post"], url_path="marcar-salida")
    def marcar_salida(self, request):
        """Marca la hora de salida del usuario autenticado (hoy)."""
        if request.user.rol not in ROLES_STAFF:
            raise PermissionDenied()

        registro = RegistroPersonal.objects.filter(
            usuario=request.user, fecha=timezone.localdate()
        ).first()
        if not registro:
            hoy = timezone.localdate()
            if hoy.weekday() >= 5:
                # En fin de semana o día no laborable, permite registrar salida extraordinaria directamente
                ahora = timezone.localtime().time().replace(second=0, microsecond=0)
                registro = RegistroPersonal.objects.create(
                    usuario=request.user,
                    fecha=hoy,
                    hora_entrada=ahora,
                    hora_salida=ahora,
                    estado=EstadoAsistenciaPersonal.PRESENTE,
                    metodo=MetodoRegistroPersonal.MANUAL,
                    observaciones="Jornada extraordinaria fin de semana",
                )
                return Response(RegistroPersonalSerializer(registro).data)
            return Response({"error": "No has marcado tu entrada hoy."}, status=400)
        registro.hora_salida = timezone.localtime().time().replace(second=0, microsecond=0)
        registro.save(update_fields=["hora_salida"])
        return Response(RegistroPersonalSerializer(registro).data)

    @action(detail=False, methods=["get"], url_path="mi-registro-hoy")
    def mi_registro_hoy(self, request):
        hoy = timezone.localdate()
        es_fin_de_semana = hoy.weekday() >= 5
        config = ConfiguracionInstitucional.get_solo()
        hora_esperada = _determinar_hora_esperada_personal(request.user, config, hoy)

        registro = RegistroPersonal.objects.filter(
            usuario=request.user, fecha=hoy
        ).first()

        dia_nombre = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][hoy.weekday()]

        return Response({
            "tiene_registro": registro is not None,
            "es_dia_no_laborable": es_fin_de_semana,
            "motivo_no_laborable": f"Hoy es {dia_nombre} (Día no laborable / Sin jornada programada)" if es_fin_de_semana else "",
            "hora_esperada_ingreso": hora_esperada.strftime("%H:%M") if hora_esperada else "08:00",
            "tolerancia_minutos": config.tolerancia_minutos,
            "registro": RegistroPersonalSerializer(registro).data if registro else None,
        })

    @action(detail=False, methods=["post"], url_path="marcar-por-otro")
    def marcar_por_otro(self, request):
        """Excepción: staff aprobador marca a otro (por olvido, sin celular, etc.)."""
        if request.user.rol not in ROLES_APROBADORES:
            raise PermissionDenied()
        usuario_id = request.data.get("usuario")
        fecha = request.data.get("fecha") or timezone.localdate().isoformat()
        hora_entrada = request.data.get("hora_entrada")
        hora_salida = request.data.get("hora_salida")
        estado = request.data.get("estado", "asistio")
        observaciones = request.data.get("observaciones", "")

        try:
            u = Usuario.objects.get(pk=usuario_id)
        except Usuario.DoesNotExist:
            return Response({"error": "Usuario no encontrado."}, status=404)

        r, creado = RegistroPersonal.objects.update_or_create(
            usuario=u, fecha=fecha,
            defaults={
                "hora_entrada": hora_entrada,
                "hora_salida": hora_salida,
                "estado": estado,
                "observaciones": observaciones,
                "marcado_por": request.user,
                "auto_tardanza": False,
            },
        )
        return Response(RegistroPersonalSerializer(r).data)

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        if request.user.rol not in ROLES_APROBADORES:
            raise PermissionDenied()
        hoy = timezone.localdate()
        mes_inicio = hoy.replace(day=1)
        es_fin_de_semana = hoy.weekday() >= 5

        total_staff = Usuario.objects.filter(activo=True, rol__in=ROLES_STAFF).count()
        qs_hoy = RegistroPersonal.objects.filter(fecha=hoy)
        qs_mes = RegistroPersonal.objects.filter(fecha__gte=mes_inicio)

        sin_marcar_hoy = 0 if (es_fin_de_semana and qs_hoy.count() == 0) else max(0, total_staff - qs_hoy.count())

        return Response({
            "es_dia_no_laborable": es_fin_de_semana,
            "motivo_no_laborable": "Fin de semana (no laborable)" if es_fin_de_semana else "",
            "total_staff": total_staff,
            "presentes_hoy": qs_hoy.exclude(estado="ausente").count(),
            "tardanzas_hoy": qs_hoy.filter(estado="tardanza").count(),
            "sin_marcar_hoy": sin_marcar_hoy,
            "tardanzas_mes": qs_mes.filter(estado="tardanza").count(),
            "ausencias_mes": qs_mes.filter(estado="ausente").count(),
            "por_estado_mes": {c: qs_mes.filter(estado=c).count() for c, _ in EstadoAsistenciaPersonal.choices},
        })

    @action(detail=False, methods=["get"], url_path="exportar-mensual")
    def exportar_mensual(self, request):
        """Excel consolidado mensual — formato para UGEL."""
        if request.user.rol not in ROLES_APROBADORES:
            raise PermissionDenied()
        mes = request.GET.get("mes") or timezone.localdate().strftime("%Y-%m")
        try:
            anio, mes_num = mes.split("-")
            desde = date(int(anio), int(mes_num), 1)
        except (ValueError, TypeError):
            return Response({"error": "Formato de mes inválido (YYYY-MM)."}, status=400)
        if desde.month == 12:
            hasta = date(desde.year + 1, 1, 1) - timedelta(days=1)
        else:
            hasta = date(desde.year, desde.month + 1, 1) - timedelta(days=1)

        wb = Workbook()
        ws = wb.active
        ws.title = f"Asistencia {desde.strftime('%b %Y')}"

        config = ConfiguracionInstitucional.get_solo()
        ws["A1"] = config.nombre_institucion.upper()
        ws["A2"] = f"Código modular: {config.codigo_modular}  ·  {config.ugel}"
        ws["A3"] = f"CONSOLIDADO DE ASISTENCIA DEL PERSONAL — {desde.strftime('%B %Y').upper()}"
        for i in range(1, 4):
            ws[f"A{i}"].font = Font(size=12 if i < 3 else 13, bold=True, color="1E3A5F")
            ws.merge_cells(f"A{i}:F{i}")

        # Cabecera
        cabeceras = ["N°", "Apellidos y Nombres", "Rol", "Asistencias", "Tardanzas", "Ausencias"]
        fila_cab = 5
        borde = Border(left=Side(style="thin", color="CBD5E1"),
                       right=Side(style="thin", color="CBD5E1"),
                       top=Side(style="thin", color="CBD5E1"),
                       bottom=Side(style="thin", color="CBD5E1"))
        for i, c in enumerate(cabeceras, 1):
            cel = ws.cell(row=fila_cab, column=i, value=c)
            cel.font = Font(bold=True, color="FFFFFF", size=11)
            cel.fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
            cel.border = borde
            cel.alignment = Alignment(horizontal="center", vertical="center")

        anchos = [6, 40, 25, 12, 12, 12]
        for i, a in enumerate(anchos, 1):
            ws.column_dimensions[chr(64 + i)].width = a

        # Filas
        staff = Usuario.objects.filter(activo=True, rol__in=ROLES_STAFF).order_by("last_name", "first_name")
        for idx, u in enumerate(staff, 1):
            fila = fila_cab + idx
            qs = RegistroPersonal.objects.filter(usuario=u, fecha__gte=desde, fecha__lte=hasta)
            valores = [
                idx,
                f"{u.last_name}, {u.first_name}",
                u.get_rol_display(),
                qs.filter(estado="asistio").count(),
                qs.filter(estado="tardanza").count(),
                qs.filter(estado="ausente").count(),
            ]
            for col, v in enumerate(valores, 1):
                c = ws.cell(row=fila, column=col, value=v)
                c.border = borde
                if idx % 2 == 0:
                    c.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

        # Firmas
        fila_firmas = fila_cab + len(staff) + 4
        ws.cell(row=fila_firmas, column=2, value="_" * 30).alignment = Alignment(horizontal="center")
        ws.cell(row=fila_firmas, column=5, value="_" * 30).alignment = Alignment(horizontal="center")
        ws.cell(row=fila_firmas + 1, column=2, value="Director/a").font = Font(bold=True)
        ws.cell(row=fila_firmas + 1, column=5, value="Secretario/a").font = Font(bold=True)
        ws.cell(row=fila_firmas + 1, column=2).alignment = Alignment(horizontal="center")
        ws.cell(row=fila_firmas + 1, column=5).alignment = Alignment(horizontal="center")

        out = io.BytesIO()
        wb.save(out)
        resp = HttpResponse(
            out.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = f'attachment; filename="asistencia_personal_{mes}.xlsx"'
        return resp


# ═════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN INSTITUCIONAL (config general de la app)
# ═════════════════════════════════════════════════════════════════════════════
from rest_framework import serializers as _s


class _ConfigSerializer(_s.ModelSerializer):
    class Meta:
        model = ConfiguracionInstitucional
        fields = "__all__"


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def configuracion(request):
    """GET: cualquiera. PATCH: solo director/subdirector."""
    cfg = ConfiguracionInstitucional.get_solo()
    if request.method == "PATCH":
        if request.user.rol not in ("director", "subdirector"):
            raise PermissionDenied("Solo la dirección puede modificar la configuración.")
        ser = _ConfigSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
    return Response(_ConfigSerializer(cfg).data)
