import io
import json
from datetime import date, timedelta

import qrcode
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Estudiante, Matricula, Padre, Rol, Seccion

from .exportacion import excel_asistencia_mensual, pdf_asistencia_mensual
from apps.notas.models import AsignacionDocente

from .models import EstadoAsistencia, RegistroAsistencia
from .permissions import PermisoAsistencia
from .serializers import (
    EstudianteListaSerializer,
    MarcaMasivaSerializer,
    RegistroAsistenciaSerializer,
)


ROLES_SIAGIE_ASISTENCIA = (
    Rol.DIRECTOR,
    Rol.SUBDIRECTOR,
    Rol.ADMIN_TIC,
    Rol.SECRETARIA,
    Rol.AUXILIAR,
)


def _anio_lectivo_activo():
    from apps.core.models import ConfiguracionInstitucional
    return ConfiguracionInstitucional.get_solo().anio_lectivo_activo or 2026


def _parse_mes(mes_str: str):
    if not mes_str or "-" not in mes_str:
        raise ValueError("Parametro 'mes' requerido en formato YYYY-MM.")
    anio_s, mes_s = mes_str.split("-", 1)
    anio, mes = int(anio_s), int(mes_s)
    if not 1 <= mes <= 12:
        raise ValueError
    return anio, mes


def _params_siagie_asistencia(request):
    archivo = request.FILES.get("archivo")
    if not archivo:
        return None, None, None, Response({"error": "Envía el Excel en 'archivo'."}, status=400)
    seccion_id = request.POST.get("seccion_id") or request.POST.get("seccion")
    if not seccion_id:
        return None, None, None, Response({"error": "Parametro 'seccion_id' requerido."}, status=400)
    try:
        anio, mes = _parse_mes((request.POST.get("mes") or "").strip())
    except (TypeError, ValueError):
        return None, None, None, Response({"error": "'mes' debe ser YYYY-MM (ej: 2026-07)."}, status=400)
    return archivo, int(seccion_id), (anio, mes), None


def _mapeo_manual_asistencia(request):
    raw = request.POST.get("mapeo_json")
    if not raw:
        return None
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("mapeo_json debe ser una lista de hojas.")
    hojas = []
    for item in data:
        mapeo = item.get("mapeo") or item.get("columnas_detectadas") or {}
        hojas.append({
            "hash": item.get("hash", "manual"),
            "hoja": item.get("hoja", ""),
            "fila_datos": int(item.get("fila_datos") or 1),
            "mapeo": {int(k): v for k, v in mapeo.items()},
            "dias": item.get("dias", []),
            "metodo": "manual",
            "confianza": "alta",
            "errores": [],
            "muestra_header": item.get("muestra_header", ""),
        })
    return hojas


def _secciones_docente_ids(user):
    """Devuelve los IDs de secciones que un docente puede atender en asistencia:
    - Secciones asignadas directamente o como tutor.
    - Secciones donde tiene asignaciones de notas en el año lectivo activo
      (incluye secundaria: profesor por materia; inicial/primaria: profesor de aula).
    """
    secciones_ids = set(user.secciones_asignadas.values_list("id", flat=True))
    secciones_ids.update(user.secciones_como_tutor.values_list("id", flat=True))
    anio = _anio_lectivo_activo()
    secciones_ids.update(
        AsignacionDocente.objects.filter(
            docente=user, anio_lectivo=anio
        ).values_list("seccion_id", flat=True)
    )
    return secciones_ids


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def exportar_mensual(request):
    """Descarga reporte mensual de asistencia de una sección.
    Params: mes=YYYY-MM, seccion=id, formato=xlsx|pdf (default xlsx)."""
    mes_str = (request.query_params.get("mes") or "").strip()
    seccion_id = request.query_params.get("seccion")
    formato = (request.query_params.get("formato") or "xlsx").lower()

    if not mes_str or "-" not in mes_str:
        return Response({"error": "Parametro 'mes' requerido en formato YYYY-MM."}, status=400)
    try:
        anio_s, mes_s = mes_str.split("-")
        anio, mes = int(anio_s), int(mes_s)
        if not 1 <= mes <= 12:
            raise ValueError
    except ValueError:
        return Response({"error": "'mes' debe ser YYYY-MM (ej: 2026-07)."}, status=400)

    if not seccion_id:
        return Response({"error": "Parametro 'seccion' requerido."}, status=400)

    rol = getattr(request.user, "rol", None)
    if rol not in ("director", "subdirector", "docente", "admin_tic",
                   "secretaria", "auxiliar", "psicologa"):
        raise PermissionDenied()

    try:
        if formato == "pdf":
            data = pdf_asistencia_mensual(int(seccion_id), anio, mes)
            content_type = "application/pdf"
            ext = "pdf"
        else:
            data = excel_asistencia_mensual(int(seccion_id), anio, mes)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ext = "xlsx"
    except ValueError as e:
        return Response({"error": str(e)}, status=404)

    resp = HttpResponse(data, content_type=content_type)
    resp["Content-Disposition"] = (
        f'attachment; filename="asistencia_{seccion_id}_{anio}-{mes:02d}.{ext}"'
    )
    return resp


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def siagie_asistencia_analizar(request):
    if request.user.rol not in ROLES_SIAGIE_ASISTENCIA:
        raise PermissionDenied()

    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el Excel en 'archivo'."}, status=400)

    try:
        from .siagie_asistencia import analizar_template_asistencia, resumen_confianza
        hojas = analizar_template_asistencia(io.BytesIO(archivo.read()))
        confianza, errores = resumen_confianza(hojas)
    except Exception as e:
        return Response({"error": f"No se pudo analizar el archivo: {str(e)[:300]}"}, status=400)

    return Response({
        "ok": True,
        "n_hojas": len(hojas),
        "confianza": confianza,
        "errores": errores,
        "hojas": [
            {
                "hash": h.get("hash", ""),
                "hoja": h.get("hoja", ""),
                "fila_datos": h.get("fila_datos", 0),
                "metodo": h.get("metodo", ""),
                "confianza": h.get("confianza", ""),
                "errores": h.get("errores", []),
                "muestra_header": h.get("muestra_header", ""),
                "dias": h.get("dias", []),
                "columnas_detectadas": {str(k): v for k, v in h.get("mapeo", {}).items()},
                "n_columnas_mapeadas": len(h.get("mapeo", {})),
            }
            for h in hojas
        ],
    })


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def siagie_asistencia_preview(request):
    if request.user.rol not in ROLES_SIAGIE_ASISTENCIA:
        raise PermissionDenied()

    archivo, seccion_id, periodo, error = _params_siagie_asistencia(request)
    if error:
        return error
    anio, mes = periodo

    try:
        from .siagie_asistencia import (
            analizar_template_asistencia,
            datos_asistencia_por_dni,
            preview_relleno_asistencia,
            resumen_confianza,
        )
        contenido = archivo.read()
        hojas = _mapeo_manual_asistencia(request) or analizar_template_asistencia(io.BytesIO(contenido))
        confianza, errores = resumen_confianza(hojas)
        if confianza == "baja":
            return Response({"error": "No se pudo detectar la plantilla SIAGIE.", "errores": errores}, status=400)
        datos = datos_asistencia_por_dni(seccion_id, anio, mes)
        preview = preview_relleno_asistencia(io.BytesIO(contenido), datos, hojas)
    except Exception as e:
        return Response({"error": f"Error en preview: {str(e)[:300]}"}, status=400)

    return Response({
        "ok": True,
        "total_filas": preview["total_filas"],
        "se_rellenaran": preview["se_rellenaran"],
        "sin_datos": preview["sin_datos"],
        "dnis_sin_datos": preview["dnis_sin_datos"],
        "asistencias_disponibles": len(datos),
        "n_hojas": len(hojas),
        "confianza": confianza,
        "errores": errores,
        "hojas": [
            {
                "hash": h.get("hash", ""),
                "hoja": h.get("hoja", ""),
                "fila_datos": h.get("fila_datos", 0),
                "metodo": h.get("metodo", ""),
                "confianza": h.get("confianza", ""),
                "dias": h.get("dias", []),
                "columnas_detectadas": {str(k): v for k, v in h.get("mapeo", {}).items()},
            }
            for h in hojas
        ],
    })


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def siagie_asistencia_rellenar(request):
    if request.user.rol not in ROLES_SIAGIE_ASISTENCIA:
        raise PermissionDenied()

    archivo, seccion_id, periodo, error = _params_siagie_asistencia(request)
    if error:
        return error
    anio, mes = periodo

    try:
        from .siagie_asistencia import (
            analizar_template_asistencia,
            datos_asistencia_por_dni,
            rellenar_template_asistencia,
            resumen_confianza,
        )
        contenido = archivo.read()
        hojas = _mapeo_manual_asistencia(request) or analizar_template_asistencia(io.BytesIO(contenido))
        confianza, errores = resumen_confianza(hojas)
        if confianza == "baja":
            return Response({"error": "No se pudo detectar la plantilla SIAGIE.", "errores": errores}, status=400)
        datos = datos_asistencia_por_dni(seccion_id, anio, mes)
        excel_out, n_rellenadas = rellenar_template_asistencia(io.BytesIO(contenido), datos, hojas)
    except Exception as e:
        return Response({"error": f"Error al rellenar: {str(e)[:300]}"}, status=400)

    resp = HttpResponse(
        excel_out.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    nombre = archivo.name or f"asistencia_siagie_{anio}-{mes:02d}.xlsx"
    resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
    resp["X-Filas-Rellenadas"] = str(n_rellenadas)
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_estudiantes(request):
    """Lista de estudiantes para el marcado del docente.
    - Docente: solo estudiantes de las secciones asignadas o tutoradas por él.
    - Admin TIC / Director: todos.
    Filtros: ?seccion_id=X"""
    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()
    anio_lectivo = cfg.anio_lectivo_activo or 2026

    qs = Estudiante.objects.select_related("usuario").filter(
        usuario__activo=True,
        matriculas__anio_lectivo=anio_lectivo,
        matriculas__situacion__in=["matriculado", "suspendido"],
    ).order_by(
        "usuario__last_name", "usuario__first_name"
    ).distinct()
    user = request.user
    if user.rol == Rol.DOCENTE:
        secciones_ids = _secciones_docente_ids(user)
        qs = qs.filter(matriculas__seccion_id__in=secciones_ids, matriculas__anio_lectivo=anio_lectivo)

    seccion_id = request.GET.get("seccion_id")
    grado = request.GET.get("grado")
    seccion = request.GET.get("seccion")
    if seccion_id:
        qs = qs.filter(matriculas__seccion_id=seccion_id, matriculas__anio_lectivo=anio_lectivo)
    elif grado:
        qs = qs.filter(matriculas__seccion__grado=grado, matriculas__anio_lectivo=anio_lectivo)
        if seccion:
            qs = qs.filter(matriculas__seccion__letra=seccion, matriculas__anio_lectivo=anio_lectivo)
    return Response(EstudianteListaSerializer(qs, many=True).data)


class RegistroAsistenciaViewSet(viewsets.ModelViewSet):
    serializer_class = RegistroAsistenciaSerializer
    permission_classes = [IsAuthenticated, PermisoAsistencia]

    def get_queryset(self):
        user = self.request.user
        qs = RegistroAsistencia.objects.select_related(
            "estudiante__usuario", "marcado_por"
        )

        # Padre: solo asistencias de sus hijos
        if user.rol == Rol.PADRE:
            padre = Padre.objects.filter(usuario=user).first()
            if not padre:
                return qs.none()
            qs = qs.filter(estudiante__in=padre.hijos.all())

        # Estudiante: solo la suya
        elif user.rol == Rol.ESTUDIANTE:
            est = Estudiante.objects.filter(usuario=user).first()
            if not est:
                return qs.none()
            qs = qs.filter(estudiante=est)

        # Filtros por query params
        estudiante = self.request.GET.get("estudiante")
        fecha = self.request.GET.get("fecha")
        desde = self.request.GET.get("desde")
        hasta = self.request.GET.get("hasta")
        if estudiante:
            qs = qs.filter(estudiante_id=estudiante)
        if fecha:
            qs = qs.filter(fecha=fecha)
        if desde:
            qs = qs.filter(fecha__gte=desde)
        if hasta:
            qs = qs.filter(fecha__lte=hasta)

        return qs

    def perform_create(self, serializer):
        serializer.save(marcado_por=self.request.user)

    @action(detail=False, methods=["post"], url_path="marcar-masivo")
    def marcar_masivo(self, request):
        """Marca asistencia de varios estudiantes en una sola fecha.
        Payload: {"fecha": "YYYY-MM-DD", "registros": [{"estudiante": id, "estado": "presente", "hora_llegada": "07:30", "justificacion": ""}, ...]}
        Upsert: si ya hay registro para ese estudiante+fecha, se actualiza."""
        if request.user.rol not in (Rol.DOCENTE, Rol.ADMIN_TIC, Rol.DIRECTOR):
            raise PermissionDenied("Solo personal docente/admin puede marcar asistencia.")

        ser = MarcaMasivaSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        fecha = ser.validated_data["fecha"]
        registros = ser.validated_data["registros"]

        # Docente: validar que todos los estudiantes pertenecen a sus secciones
        if request.user.rol == Rol.DOCENTE:
            secciones_ids = _secciones_docente_ids(request.user)
            estudiantes_ids = [r["estudiante"] for r in registros]
            anio_lectivo = _anio_lectivo_activo()
            permitidos = set(
                Estudiante.objects.filter(
                    id__in=estudiantes_ids,
                    matriculas__seccion_id__in=secciones_ids,
                    matriculas__anio_lectivo=anio_lectivo,
                ).values_list("id", flat=True)
            )
            if set(estudiantes_ids) - permitidos:
                raise PermissionDenied("Solo puedes marcar estudiantes de tus secciones.")

        creados, actualizados = 0, 0
        with transaction.atomic():
            for r in registros:
                obj, creado = RegistroAsistencia.objects.update_or_create(
                    estudiante_id=r["estudiante"],
                    fecha=fecha,
                    defaults={
                        "estado": r["estado"],
                        "hora_llegada": r.get("hora_llegada") or None,
                        "justificacion": r.get("justificacion", ""),
                        "marcado_por": request.user,
                    },
                )
                if creado:
                    creados += 1
                else:
                    actualizados += 1

        return Response({
            "ok": True,
            "fecha": str(fecha),
            "creados": creados,
            "actualizados": actualizados,
            "total": creados + actualizados,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="del-dia")
    def del_dia(self, request):
        """Retorna todos los registros de una fecha (default: hoy). Útil al abrir la vista de marcado."""
        fecha_str = request.GET.get("fecha")
        try:
            f = date.fromisoformat(fecha_str) if fecha_str else timezone.now().date()
        except ValueError:
            return Response({"error": "Formato de fecha inválido"}, status=400)

        qs = self.get_queryset().filter(fecha=f)
        return Response({
            "fecha": str(f),
            "registros": RegistroAsistenciaSerializer(qs, many=True).data,
        })

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        """KPIs de asistencia para el panel del director.
        Por defecto: últimos 30 días."""
        if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC):
            raise PermissionDenied("Solo director o admin TIC.")

        desde_str = request.GET.get("desde")
        hasta_str = request.GET.get("hasta")

        hasta = date.fromisoformat(hasta_str) if hasta_str else timezone.now().date()
        desde = date.fromisoformat(desde_str) if desde_str else hasta - timedelta(days=30)

        qs = RegistroAsistencia.objects.filter(fecha__gte=desde, fecha__lte=hasta)
        total = qs.count()

        por_estado = {c: qs.filter(estado=c).count() for c, _ in EstadoAsistencia.choices}

        total_estudiantes = Estudiante.objects.count()
        # % de asistencia = (presente + tardanza) / total registros
        presente_o_tardanza = por_estado.get("presente", 0) + por_estado.get("tardanza", 0)
        porc_asistencia = round((presente_o_tardanza / total * 100), 1) if total else 0.0

        # Top ausencias por estudiante
        anio_activo = _anio_lectivo_activo()
        top_ausentes = list(
            qs.filter(estado=EstadoAsistencia.AUSENTE)
            .filter(estudiante__matriculas__anio_lectivo=anio_activo)
            .values("estudiante__usuario__first_name", "estudiante__usuario__last_name",
                    "estudiante__matriculas__seccion__grado", "estudiante__matriculas__seccion__letra")
            .annotate(ausencias=Count("id"))
            .order_by("-ausencias")[:5]
        )
        top_ausentes_fmt = [{
            "nombre": f"{r['estudiante__usuario__first_name']} {r['estudiante__usuario__last_name']}".strip(),
            "grado": r["estudiante__matriculas__seccion__grado"],
            "seccion": r["estudiante__matriculas__seccion__letra"],
            "ausencias": r["ausencias"],
        } for r in top_ausentes]

        return Response({
            "desde": str(desde),
            "hasta": str(hasta),
            "total_registros": total,
            "total_estudiantes": total_estudiantes,
            "por_estado": por_estado,
            "porcentaje_asistencia": porc_asistencia,
            "top_ausentes": top_ausentes_fmt,
        })

    @action(detail=False, methods=["get"], url_path="mis-hijos")
    def mis_hijos(self, request):
        """Padre: resumen de asistencia de sus hijos."""
        if request.user.rol != Rol.PADRE:
            raise PermissionDenied("Solo padres.")

        padre = Padre.objects.filter(usuario=request.user).first()
        if not padre:
            return Response({"hijos": []})

        from django.db.models import Count

        resultado = []
        for hijo in padre.hijos.select_related("usuario").all():
            qs = RegistroAsistencia.objects.filter(estudiante=hijo)
            ultimos = qs.order_by("-fecha")[:10]

            # Agregado en 1 query (GROUP BY estado) en vez de N counts
            por_estado = {c: 0 for c, _ in EstadoAsistencia.choices}
            for row in qs.values("estado").annotate(c=Count("id")):
                por_estado[row["estado"]] = row["c"]
            total = sum(por_estado.values())
            asistidos = por_estado.get("presente", 0) + por_estado.get("tardanza", 0)
            porc = round((asistidos / total * 100), 1) if total else 0.0

            resultado.append({
                "estudiante_id": hijo.pk,
                "nombre": f"{hijo.usuario.first_name} {hijo.usuario.last_name}".strip(),
                "grado": hijo.grado,
                "seccion": hijo.seccion,
                "total_registros": total,
                "porcentaje_asistencia": porc,
                "por_estado": por_estado,
                "ultimos_10": RegistroAsistenciaSerializer(ultimos, many=True).data,
            })

        return Response({"hijos": resultado})

    # ── QR: escaneo y marca automática ───────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="marcar-qr")
    def marcar_qr(self, request):
        """Marca asistencia por QR escaneado.
        Payload: {"codigo": "20260016", "fecha": "YYYY-MM-DD" (opcional, default hoy), "estado": "presente" (opcional, default presente)}"""
        if request.user.rol not in (Rol.DOCENTE, Rol.ADMIN_TIC, Rol.DIRECTOR):
            raise PermissionDenied("Solo personal docente/admin puede marcar.")

        codigo = (request.data.get("codigo") or "").strip()
        if not codigo:
            return Response({"error": "El campo 'codigo' es requerido."}, status=400)

        from apps.core.models import ConfiguracionInstitucional
        cfg = ConfiguracionInstitucional.get_solo()
        anio_lectivo = cfg.anio_lectivo_activo or 2026

        matricula = Matricula.objects.select_related("estudiante__usuario", "seccion").filter(
            codigo_matricula=codigo,
            anio_lectivo=anio_lectivo,
        ).first()
        if not matricula:
            return Response({"error": f"No hay estudiante matriculado con código '{codigo}' en {anio_lectivo}."}, status=404)

        est = matricula.estudiante

        # Docente: solo puede marcar estudiantes de sus secciones
        if request.user.rol == Rol.DOCENTE:
            secciones_ids = _secciones_docente_ids(request.user)
            if matricula.seccion_id not in secciones_ids:
                return Response(
                    {"error": f"{est.usuario.first_name} no pertenece a tus secciones."},
                    status=403,
                )

        try:
            fecha_str = request.data.get("fecha")
            fecha = date.fromisoformat(fecha_str) if fecha_str else timezone.localdate()
        except ValueError:
            return Response({"error": "Formato de fecha inválido."}, status=400)

        estado_pedido = request.data.get("estado", "auto")
        hora_ahora = timezone.localtime().time().replace(second=0, microsecond=0)
        auto_tardanza = False

        # Auto-detección de tardanza según hora tope institucional
        if estado_pedido == "auto":
            from apps.core.models import ConfiguracionInstitucional
            from datetime import datetime as _dt, timedelta as _td
            cfg = ConfiguracionInstitucional.get_solo()
            hoy = date.today()
            dt_tope = _dt.combine(hoy, cfg.hora_tope_entrada_estudiantes) + _td(minutes=cfg.tolerancia_minutos)
            dt_ahora = _dt.combine(hoy, hora_ahora)
            if dt_ahora > dt_tope:
                estado = "tardanza"
                auto_tardanza = True
            else:
                estado = "presente"
        else:
            if estado_pedido not in [c for c, _ in EstadoAsistencia.choices]:
                return Response({"error": "Estado inválido."}, status=400)
            estado = estado_pedido

        obj, creado = RegistroAsistencia.objects.update_or_create(
            estudiante=est,
            fecha=fecha,
            defaults={
                "estado": estado,
                "hora_llegada": hora_ahora if estado in ("presente", "tardanza") else None,
                "marcado_por": request.user,
            },
        )
        return Response({
            "ok": True,
            "creado": creado,
            "auto_tardanza": auto_tardanza,
            "estudiante": {
                "id": est.pk,
                "nombre": f"{est.usuario.first_name} {est.usuario.last_name}".strip(),
                "grado": est.grado,
                "seccion": est.seccion,
                "codigo_matricula": est.codigo_matricula,
            },
            "fecha": str(fecha),
            "estado": estado,
            "hora": hora_ahora.strftime("%H:%M"),
        })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def qr_estudiante(request, codigo):
    """Genera un PNG con el QR de un estudiante (contenido = código matrícula)."""
    anio_lectivo = _anio_lectivo_activo()
    matricula = Matricula.objects.select_related("estudiante__usuario").filter(
        codigo_matricula=codigo,
        anio_lectivo=anio_lectivo,
    ).first()
    est = matricula.estudiante if matricula else None
    if not est:
        return HttpResponse("No existe", status=404)

    img = qrcode.make(codigo, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return HttpResponse(buf.getvalue(), content_type="image/png")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def qrs_por_seccion(request, seccion_id):
    """Devuelve lista de estudiantes con URL de su QR para imprimir."""
    if request.user.rol not in (Rol.DOCENTE, Rol.ADMIN_TIC, Rol.DIRECTOR):
        raise PermissionDenied("Solo personal docente/admin.")

    seccion = Seccion.objects.filter(pk=seccion_id).first()
    if not seccion:
        return Response({"error": "Sección no encontrada."}, status=404)

    anio_lectivo = _anio_lectivo_activo()
    ests = list(
        Estudiante.objects.por_seccion(seccion.pk, anio_lectivo)
        .select_related("usuario")
        .order_by("usuario__last_name")
    )
    resultado = [{
        "id": e.pk,
        "nombre": f"{e.usuario.first_name} {e.usuario.last_name}".strip(),
        "codigo_matricula": e.codigo_matricula,
        "qr_url": f"/api/asistencia/qr/{e.codigo_matricula}/" if e.codigo_matricula else None,
    } for e in ests]
    return Response({
        "seccion": {"id": seccion.pk, "nombre": seccion.nombre},
        "estudiantes": resultado,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mis_secciones(request):
    """Devuelve las secciones que el docente puede atender en asistencia.
    Combina secciones asignadas/tutoradas con las asignaciones de notas del año activo."""
    user = request.user
    anio_lectivo = _anio_lectivo_activo()
    if user.rol == Rol.DOCENTE:
        secciones_ids = _secciones_docente_ids(user)
        qs = Seccion.objects.filter(id__in=secciones_ids)
    elif user.rol in (Rol.ADMIN_TIC, Rol.DIRECTOR):
        qs = Seccion.objects.all()
    else:
        qs = Seccion.objects.none()

    return Response([
        {"id": s.pk, "nombre": s.nombre, "grado": s.grado, "letra": s.letra,
         "nivel": s.nivel, "cantidad_estudiantes": Estudiante.objects.por_seccion(s.pk, anio_lectivo).count()}
        for s in qs.order_by("nivel", "grado", "letra")
    ])
