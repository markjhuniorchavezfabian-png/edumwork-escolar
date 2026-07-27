import io

from django.http import HttpResponse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from rest_framework import serializers as drf_s, status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Estudiante, Padre, Rol, Seccion, Usuario

from .models import AsignacionDocente, CONCLUSIONES_NL, HorarioClase, NotaBimestre


ROLES_PUEDEN_CARGAR = ("director", "subdirector", "secretaria", "docente")


def _es_docente_activo(user) -> bool:
    """True si el usuario debe comportarse como docente: rol docente O director/subdirector con es_docente=True."""
    return user.rol == "docente" or getattr(user, "es_docente", False)


def _anio_lectivo_activo():
    """Devuelve el año lectivo activo configurado institucionalmente."""
    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()
    return cfg.anio_lectivo_activo or 2026


class AsignacionDocenteSerializer(drf_s.ModelSerializer):
    docente_nombre = drf_s.SerializerMethodField(read_only=True)
    seccion_nombre = drf_s.SerializerMethodField(read_only=True)

    class Meta:
        model = AsignacionDocente
        fields = ["id", "docente", "docente_nombre", "seccion", "seccion_nombre",
                  "area", "num_competencias"]

    def get_docente_nombre(self, obj):
        return obj.docente.get_full_name() or obj.docente.username

    def get_seccion_nombre(self, obj):
        return str(obj.seccion)


class AsignacionDocenteViewSet(viewsets.ModelViewSet):
    serializer_class = AsignacionDocenteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # siempre devolver todas — escuela ≤ 200 asignaciones

    def get_queryset(self):
        user = self.request.user
        qs = AsignacionDocente.objects.select_related("docente", "seccion")
        anio_param = self.request.GET.get("anio")
        anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()
        qs = qs.filter(anio_lectivo=anio)
        if user.rol in ("director", "subdirector", "secretaria", "admin_tic"):
            docente_id = self.request.GET.get("docente")
            seccion_id = self.request.GET.get("seccion")
            if docente_id:
                qs = qs.filter(docente_id=docente_id)
            if seccion_id:
                qs = qs.filter(seccion_id=seccion_id)
            return qs
        if user.rol == "docente" or getattr(user, "es_docente", False):
            return qs.filter(docente=user)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if request.user.rol not in ("director", "subdirector"):
            raise PermissionDenied()
        # Auto-calcular num_competencias del CNEB si no viene en el request
        if "num_competencias" not in request.data:
            from apps.curricula.models import Competencia
            seccion_id = request.data.get("seccion")
            area = request.data.get("area", "")
            try:
                seccion = Seccion.objects.get(pk=seccion_id)
                n = Competencia.objects.filter(
                    area__nombre__iexact=area,
                    area__nivel=seccion.nivel,
                ).count()
                request.data["num_competencias"] = n or 1
            except Exception:
                request.data["num_competencias"] = 1
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # Docente puede actualizar solo num_competencias de sus propias asignaciones
        if _es_docente_activo(request.user):
            obj = self.get_object()
            if obj.docente_id != request.user.pk:
                raise PermissionDenied()
            num = request.data.get("num_competencias")
            if num is None or set(request.data.keys()) - {"num_competencias"}:
                raise PermissionDenied("Solo puedes modificar num_competencias.")
            obj.num_competencias = int(num)
            obj.save(update_fields=["num_competencias"])
            return Response(AsignacionDocenteSerializer(obj).data)
        if request.user.rol not in ("director", "subdirector"):
            raise PermissionDenied()
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.rol not in ("director", "subdirector"):
            raise PermissionDenied()
        return super().destroy(request, *args, **kwargs)


class NotaSerializer(drf_s.ModelSerializer):
    estudiante_nombre = drf_s.SerializerMethodField(read_only=True)
    estudiante_codigo = drf_s.SerializerMethodField(read_only=True)
    calificacion_label = drf_s.CharField(source="get_calificacion_display", read_only=True)
    bimestre_label = drf_s.CharField(source="get_bimestre_display", read_only=True)

    class Meta:
        model = NotaBimestre
        fields = ["id", "estudiante", "estudiante_nombre", "estudiante_codigo", "area",
                  "bimestre", "bimestre_label", "competencia",
                  "calificacion", "calificacion_label", "calificacion_numerica",
                  "conclusion_descriptiva", "observaciones",
                  "creado_en", "actualizado_en"]
        read_only_fields = ["id", "creado_en", "actualizado_en", "estudiante_nombre",
                             "estudiante_codigo", "calificacion_label", "bimestre_label"]

    def get_estudiante_nombre(self, obj):
        return obj.estudiante.usuario.get_full_name()

    def get_estudiante_codigo(self, obj):
        return obj.estudiante.codigo_matricula or obj.estudiante.usuario.dni or ""


class NotaViewSet(viewsets.ModelViewSet):
    serializer_class = NotaSerializer
    pagination_class = None
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = NotaBimestre.objects.select_related("estudiante__usuario")

        # Filtro de año: parámetro ?anio= o año lectivo activo
        anio_param = self.request.GET.get("anio")
        anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

        if user.rol == Rol.ESTUDIANTE:
            est = Estudiante.objects.filter(usuario=user).first()
            return qs.filter(estudiante=est, anio_lectivo=anio) if est else qs.none()

        if user.rol == Rol.PADRE:
            padre = Padre.objects.filter(usuario=user).first()
            return qs.filter(estudiante__in=padre.hijos.all(), anio_lectivo=anio) if padre else qs.none()

        if user.rol in ROLES_PUEDEN_CARGAR:
            qs = qs.filter(anio_lectivo=anio)
            estudiante = self.request.GET.get("estudiante")
            bimestre = self.request.GET.get("bimestre")
            area = self.request.GET.get("area")
            seccion = self.request.GET.get("seccion")
            competencia = self.request.GET.get("competencia")
            if estudiante:
                qs = qs.filter(estudiante_id=estudiante)
            if bimestre:
                qs = qs.filter(bimestre=bimestre)
            if area:
                qs = qs.filter(area__iexact=area)
            if seccion:
                qs = qs.filter(estudiante__seccion_obj_id=seccion)
            if competencia:
                qs = qs.filter(competencia=competencia)
            # Docente: limitar a sus secciones del año activo
            if _es_docente_activo(user):
                secciones_ids = AsignacionDocente.objects.filter(
                    docente=user, anio_lectivo=anio
                ).values_list("seccion_id", flat=True)
                qs = qs.filter(estudiante__seccion_obj_id__in=secciones_ids)
            # Excluir estudiantes trasladados/retirados de las grillas activas
            qs = qs.exclude(estudiante__situacion_matricula__in=["trasladado", "retirado"])
            return qs

        return qs.none()

    def _validar_conclusion_rvm_048(self, request, seccion_nivel: str):
        """RVM 048-2024. Si NL requiere conclusión, exigirla."""
        from .models import conclusion_obligatoria
        nl = request.data.get("calificacion", "")
        concl = (request.data.get("conclusion_descriptiva") or "").strip()
        if not conclusion_obligatoria(seccion_nivel, nl):
            return None
        # Aceptar conclusión que no sea la plantilla por defecto tampoco vacía
        if not concl or len(concl) < 20:
            from rest_framework.response import Response
            return Response(
                {
                    "error": "conclusion_requerida",
                    "detalle": (
                        f"RVM 048-2024-MINEDU: en {seccion_nivel} la conclusión "
                        f"descriptiva es obligatoria si NL={nl}. "
                        f"Escribí al menos 20 caracteres explicando el avance del estudiante."
                    ),
                },
                status=400,
            )
        return None

    def create(self, request, *args, **kwargs):
        if request.user.rol not in ROLES_PUEDEN_CARGAR:
            raise PermissionDenied()
        # Buscar el nivel de la sección desde el estudiante para validar RVM 048
        try:
            from apps.usuarios.models import Estudiante
            est_id = request.data.get("estudiante")
            if est_id:
                est = Estudiante.objects.select_related("seccion_obj").filter(pk=est_id).first()
                if est and est.seccion_obj:
                    err = self._validar_conclusion_rvm_048(request, est.seccion_obj.nivel or "primaria")
                    if err is not None:
                        return err
        except Exception:
            pass  # no bloquear por errores de lookup
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.rol not in ROLES_PUEDEN_CARGAR:
            raise PermissionDenied()
        # Validar conclusión (RVM 048-2024) para NotaBimestre existente
        try:
            nota = self.get_object()
            if nota.estudiante.seccion_obj:
                err = self._validar_conclusion_rvm_048(request, nota.estudiante.seccion_obj.nivel or "primaria")
                if err is not None:
                    return err
        except Exception:
            pass
        # Registrar en auditoría cuando el director modifica una nota
        if request.user.rol in ("director", "subdirector"):
            nota = self.get_object()
            calif_anterior = nota.calificacion
            resp = super().update(request, *args, **kwargs)
            nota.refresh_from_db()
            if calif_anterior != nota.calificacion:
                try:
                    from apps.auditoria.models import Auditoria, TipoAccion
                    Auditoria.objects.create(
                        usuario=request.user,
                        usuario_username=request.user.username,
                        tipo=TipoAccion.ACTUALIZAR,
                        modelo="NotaBimestre",
                        objeto_id=str(nota.pk),
                        descripcion=(
                            f"Director cambió nota de {nota.estudiante.usuario.get_full_name()} "
                            f"· {nota.area} B{nota.bimestre} C{nota.competencia}: "
                            f"{calif_anterior} → {nota.calificacion}"
                        ),
                        cambios={"calificacion_anterior": calif_anterior, "calificacion_nueva": nota.calificacion},
                    )
                except Exception:
                    pass  # auditoría es best-effort, no bloquea el guardado
            return resp
        return super().update(request, *args, **kwargs)


# ═════════════════════════════════════════════════════════════════════════════
# IMPORT / TEMPLATE
# ═════════════════════════════════════════════════════════════════════════════

def _borde_celda():
    lado = Side(style="thin", color="CBD5E1")
    return Border(left=lado, right=lado, top=lado, bottom=lado)


def _generar_hoja_siagie(ws, area, num_competencias, estudiantes, bimestre, cfg, anio=None):
    """Genera una hoja con formato exacto SIAGIE: ID | Cód. Estudiante | Nombres | 01 NL | 01 Conclusión ..."""
    borde = _borde_celda()
    fill_header = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
    fill_sub = PatternFill(start_color="2D5A8E", end_color="2D5A8E", fill_type="solid")
    fill_alt = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    # Metadatos arriba
    ws["A1"] = cfg.nombre_institucion.upper() if cfg.nombre_institucion else "I.E."
    ws["A1"].font = Font(bold=True, size=11, color="1E3A5F")
    ws["A2"] = f"Código modular: {cfg.codigo_modular}  ·  UGEL: {cfg.ugel}  ·  {cfg.dre}"
    ws["A3"] = f"Área: {area}  ·  Bimestre: B{bimestre}  ·  Año: {anio or 2026}"
    ws["A4"] = "Escala de calificación: AD = Logro destacado | A = Logro esperado | B = En proceso | C = En inicio"
    ws["A4"].font = Font(italic=True, size=9, color="64748B")

    # Fila 1 de cabecera — nombres de competencias
    fila1 = ["ID", "Cód. Estudiante", "Nombres"]
    fila2 = ["", "", ""]
    for c in range(1, num_competencias + 1):
        fila1 += [f"{c:02d}", None]
        fila2 += ["NL", "Conclusión descriptiva de la competencia"]

    for col_idx, val in enumerate(fila1, 1):
        cel = ws.cell(row=6, column=col_idx, value=val)
        cel.font = Font(bold=True, color="FFFFFF")
        cel.fill = fill_header
        cel.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cel.border = borde
    # Merge para cada competencia par de columnas
    for c in range(num_competencias):
        col_start = 4 + c * 2
        ws.merge_cells(start_row=6, start_column=col_start, end_row=6, end_column=col_start + 1)

    for col_idx, val in enumerate(fila2, 1):
        cel = ws.cell(row=7, column=col_idx, value=val)
        cel.font = Font(bold=True, color="FFFFFF", size=9)
        cel.fill = fill_sub
        cel.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cel.border = borde
    ws.row_dimensions[6].height = 24
    ws.row_dimensions[7].height = 28

    # Anchos
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 32
    for c in range(num_competencias):
        col_nl = 4 + c * 2
        col_conc = col_nl + 1
        ws.column_dimensions[ws.cell(row=1, column=col_nl).column_letter].width = 6
        ws.column_dimensions[ws.cell(row=1, column=col_conc).column_letter].width = 50

    # Buscar notas existentes indexadas por (codigo_matricula, competencia)
    notas_idx = {}
    if estudiantes:
        codigos = [e.codigo_matricula for e in estudiantes if e.codigo_matricula]
        notas_qs = NotaBimestre.objects.filter(
            estudiante__in=estudiantes, area__iexact=area,
            bimestre=str(bimestre), anio_lectivo=anio or _anio_lectivo_activo()
        )
        for n in notas_qs:
            key = (n.estudiante_id, n.competencia)
            notas_idx[key] = n

    # Filas de estudiantes
    for idx, est in enumerate(estudiantes):
        fila_num = 8 + idx
        fill = fill_alt if idx % 2 == 1 else None
        valores_base = [
            est.usuario.dni or "",
            est.codigo_matricula or "",
            f"{est.usuario.last_name}, {est.usuario.first_name}".upper(),
        ]
        for col_idx, v in enumerate(valores_base, 1):
            cel = ws.cell(row=fila_num, column=col_idx, value=v)
            cel.border = borde
            if fill:
                cel.fill = fill

        tiene_conclusion = False
        for c in range(1, num_competencias + 1):
            nota = notas_idx.get((est.pk, c))
            col_nl = 4 + (c - 1) * 2 - 1 + 1
            col_conc = col_nl + 1
            nl_val = nota.calificacion if nota else ""
            conc_val = nota.conclusion_descriptiva if nota else ""
            if conc_val:
                tiene_conclusion = True
            for col_idx, v in [(col_nl, nl_val), (col_conc, conc_val)]:
                cel = ws.cell(row=fila_num, column=col_idx, value=v)
                cel.border = borde
                if fill:
                    cel.fill = fill
                if col_idx == col_nl:
                    cel.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    cel.alignment = Alignment(
                        horizontal="left", vertical="top", wrap_text=True
                    )
        if tiene_conclusion:
            ws.row_dimensions[fila_num].height = 60


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def template_notas(request):
    """Genera plantilla SIAGIE para un docente según su asignación.
    Params: ?seccion_id=X&area=Y&bimestre=Z (todos opcionales para director)."""
    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()

    seccion_id = request.GET.get("seccion_id")
    area_param = request.GET.get("area", "").strip()
    bimestre = request.GET.get("bimestre", "1")
    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    # Para docente: usar sus asignaciones del año activo
    if _es_docente_activo(request.user):
        asignaciones = AsignacionDocente.objects.filter(
            docente=request.user, anio_lectivo=anio
        ).select_related("seccion")
        if seccion_id:
            asignaciones = asignaciones.filter(seccion_id=seccion_id)
        if area_param:
            asignaciones = asignaciones.filter(area__iexact=area_param)
    else:
        # Director/otros: necesita especificar sección + área o genera todo del año activo
        if seccion_id and area_param:
            try:
                asig = AsignacionDocente.objects.filter(
                    seccion_id=seccion_id, area__iexact=area_param, anio_lectivo=anio
                )
                asignaciones = asig if asig.exists() else [
                    type("A", (), {"seccion": Seccion.objects.get(pk=seccion_id), "area": area_param, "num_competencias": 1})()
                ]
            except Seccion.DoesNotExist:
                return Response({"error": "Sección no encontrada."}, status=400)
        else:
            asignaciones = AsignacionDocente.objects.filter(
                anio_lectivo=anio
            ).select_related("seccion")

    wb = Workbook()
    wb.remove(wb.active)  # quitar hoja vacía

    for asig in asignaciones:
        seccion = asig.seccion
        area = asig.area
        num_comp = getattr(asig, "num_competencias", 1)
        estudiantes = list(
            Estudiante.objects.filter(seccion_obj=seccion, usuario__activo=True)
            .select_related("usuario")
            .order_by("usuario__last_name", "usuario__first_name")
        )
        titulo = f"{area[:20]} {seccion.grado}{seccion.letra}"
        ws = wb.create_sheet(title=titulo[:31])
        _generar_hoja_siagie(ws, area, num_comp, estudiantes, bimestre, cfg, anio=anio)

    if not wb.worksheets:
        # Plantilla genérica si no hay asignaciones
        ws = wb.create_sheet(title="Notas")
        ws["A1"] = "Sin asignaciones configuradas. El director debe asignarte secciones y áreas."
        ws["A1"].font = Font(color="FF0000", bold=True)

    out = io.BytesIO()
    wb.save(out)
    resp = HttpResponse(
        out.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    filename = f"registro_notas_B{bimestre}.xlsx"
    resp["Content-Disposition"] = f'attachment; filename="{filename}"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def exportar_siagie(request):
    """Exporta notas al formato SIAGIE (una hoja por área, columnas NL+Conclusión por competencia).
    Query: ?bimestre=1&seccion=5 (opcional). Sin filtros → todas las secciones y bimestres."""
    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    bimestre = request.GET.get("bimestre", "")
    seccion_id = request.GET.get("seccion", "")

    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()

    # Obtener asignaciones para determinar num_competencias por área
    asig_qs = AsignacionDocente.objects.select_related("seccion").all()
    if seccion_id:
        asig_qs = asig_qs.filter(seccion_id=seccion_id)

    # Para docente: solo sus asignaciones
    if _es_docente_activo(request.user):
        asig_qs = asig_qs.filter(docente=request.user)

    wb = Workbook()
    wb.remove(wb.active)

    vistas = set()
    for asig in asig_qs.order_by("area", "seccion__grado", "seccion__letra"):
        clave = (asig.area, asig.seccion_id)
        if clave in vistas:
            continue
        vistas.add(clave)

        estudiantes = list(
            Estudiante.objects.filter(seccion_obj=asig.seccion, usuario__activo=True)
            .select_related("usuario")
            .order_by("usuario__last_name", "usuario__first_name")
        )
        titulo = f"{asig.area[:20]} {asig.seccion.grado}{asig.seccion.letra}"
        ws_hoja = wb.create_sheet(title=titulo[:31])
        _generar_hoja_siagie(ws_hoja, asig.area, asig.num_competencias,
                             estudiantes, bimestre or "1", cfg)

    if not wb.worksheets:
        ws_hoja = wb.create_sheet(title="Sin datos")
        ws_hoja["A1"] = "No hay asignaciones para exportar con los filtros indicados."

    out = io.BytesIO()
    wb.save(out)
    sufijo = f"_B{bimestre}" if bimestre else ""
    resp = HttpResponse(
        out.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = f'attachment; filename="notas_siagie{sufijo}.xlsx"'
    return resp


# ══════════════════════════════════════════════════════════════════════════════
# SIAGIE — flujo template oficial: analizar → preview → rellenar
# ══════════════════════════════════════════════════════════════════════════════

# Rate limit: máx N análisis-con-IA por usuario/día para no reventar cuota BYOK
SIAGIE_IA_MAX_POR_DIA = 30


def _rate_limit_ia(usuario) -> tuple[bool, int]:
    """Devuelve (ok, usados_hoy). ok=False si superó el límite diario."""
    from django.utils import timezone
    from datetime import timedelta
    from .models import SiagieRellenoLog

    desde = timezone.now() - timedelta(hours=24)
    usados = SiagieRellenoLog.objects.filter(
        usuario=usuario, accion="analizar", metodo_usado="ia", creado_en__gte=desde,
    ).count()
    return (usados < SIAGIE_IA_MAX_POR_DIA), usados


def _notas_por_dni(bimestre: str, seccion_id: str):
    """
    Agrupa notas del sistema por DNI del estudiante.
    Usa Usuario.dni (con fallback a codigo_matricula y username).
    """
    from apps.usuarios.models import Estudiante  # noqa: F401

    qs = NotaBimestre.objects.select_related(
        "estudiante__usuario", "estudiante__seccion_obj",
    ).filter(bimestre=bimestre)
    if seccion_id:
        qs = qs.filter(estudiante__seccion_obj_id=seccion_id)

    notas_por_dni: dict = {}
    contador_comp: dict = {}  # (dni, area) → n° competencia

    for nota in qs.order_by("estudiante__usuario__last_name", "area", "competencia"):
        est = nota.estudiante
        u = est.usuario
        # Prioridad: DNI real → código matrícula → username
        dni = (u.dni or "").strip() or (est.codigo_matricula or "").strip() or (u.username or "").strip()
        if not dni:
            continue

        key = (dni, nota.area)
        idx = contador_comp.get(key, 0) + 1
        contador_comp[key] = idx

        if dni not in notas_por_dni:
            notas_por_dni[dni] = {
                "apellidos": u.last_name or "",
                "nombres": u.first_name or "",
            }
        notas_por_dni[dni][f"nota_nl_{idx}"] = nota.calificacion or ""
        if nota.conclusion_descriptiva:
            notas_por_dni[dni][f"conclusion_{idx}"] = nota.conclusion_descriptiva

    return notas_por_dni


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def siagie_analizar(request):
    """
    Paso 1: Analiza estructura de todas las hojas del template SIAGIE.
    Rate-limited: máx 30 llamadas con IA por usuario/día.
    """
    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el Excel en 'archivo'."}, status=400)

    from .models import SiagieRellenoLog
    from .siagie_reader import analizar_template

    try:
        contenido = archivo.read()
        import io as _io
        hojas = analizar_template(_io.BytesIO(contenido), usuario=request.user)
    except Exception as e:
        SiagieRellenoLog.objects.create(
            usuario=request.user, accion="analizar",
            nombre_archivo=archivo.name[:200], error=str(e)[:500],
        )
        return Response({"error": f"No se pudo analizar el archivo: {str(e)[:300]}"}, status=400)

    # Rate-limit: si TODAS las hojas usaron IA, contar como 1 llamada
    if any(h.get("metodo") == "ia" for h in hojas):
        ok, usados = _rate_limit_ia(request.user)
        if not ok:
            return Response({
                "error": f"Superaste el límite de {SIAGIE_IA_MAX_POR_DIA} análisis con IA por día."
            }, status=429)

    SiagieRellenoLog.objects.create(
        usuario=request.user, accion="analizar",
        nombre_archivo=archivo.name[:200],
        hash_headers=",".join(h.get("hash", "")[:12] for h in hojas if h.get("hash"))[:500],
        n_hojas=len(hojas),
        metodo_usado=",".join(sorted(set(h.get("metodo", "") for h in hojas if h.get("metodo"))))[:20],
    )

    return Response({
        "ok": True,
        "n_hojas": len(hojas),
        "hojas": [
            {
                "hoja": h.get("hoja", ""),
                "hash": h.get("hash", ""),
                "nivel": h.get("nivel") or "desconocido",
                "tiene_conclusiones": h.get("tiene_conclusiones", False),
                "fila_datos": h.get("fila_datos", 0),
                "metodo": h.get("metodo", ""),
                "muestra_header": h.get("muestra_header", ""),
                "columnas_detectadas": {str(k): v for k, v in h.get("mapeo", {}).items()},
                "n_columnas_mapeadas": len([v for v in h.get("mapeo", {}).values() if v != "ignorar"]),
                "error": h.get("error", ""),
            }
            for h in hojas
        ],
    })


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def siagie_preview(request):
    """
    Paso 2 (dry-run): simula el relleno sin descargar.
    Devuelve cuántos DNIs se van a rellenar y cuáles del template no tienen notas.
    """
    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el Excel en 'archivo'."}, status=400)

    bimestre = request.POST.get("bimestre", "1")
    seccion_id = request.POST.get("seccion_id", "")

    try:
        from .siagie_reader import analizar_template, preview_relleno
        import io as _io
        contenido = archivo.read()
        hojas = analizar_template(_io.BytesIO(contenido), usuario=request.user)
        notas = _notas_por_dni(bimestre, seccion_id)
        prev = preview_relleno(_io.BytesIO(contenido), notas, hojas)
    except Exception as e:
        return Response({"error": f"Error en preview: {str(e)[:300]}"}, status=400)

    from .models import SiagieRellenoLog
    SiagieRellenoLog.objects.create(
        usuario=request.user, accion="preview", bimestre=bimestre,
        seccion_id=int(seccion_id) if seccion_id.isdigit() else None,
        nombre_archivo=archivo.name[:200], n_hojas=len(hojas),
    )

    return Response({
        "ok": True,
        "total_filas": prev["total_filas"],
        "se_rellenaran": prev["se_rellenaran"],
        "sin_notas": prev["sin_notas"],
        "dnis_sin_notas": prev["dnis_sin_notas"],
        "notas_disponibles": len(notas),
    })


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def siagie_rellenar(request):
    """
    Paso 3: rellena el template y descarga.
    """
    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el Excel en 'archivo'."}, status=400)

    bimestre = request.POST.get("bimestre", "1")
    seccion_id = request.POST.get("seccion_id", "")

    from .models import SiagieRellenoLog
    try:
        from .siagie_reader import analizar_template, rellenar_template
        import io as _io
        contenido = archivo.read()
        hojas = analizar_template(_io.BytesIO(contenido), usuario=request.user)
        notas = _notas_por_dni(bimestre, seccion_id)
        excel_out, n_rellenadas = rellenar_template(_io.BytesIO(contenido), notas, hojas)
    except Exception as e:
        SiagieRellenoLog.objects.create(
            usuario=request.user, accion="rellenar", bimestre=bimestre,
            nombre_archivo=archivo.name[:200], error=str(e)[:500],
        )
        return Response({"error": f"Error al rellenar: {str(e)[:300]}"}, status=400)

    SiagieRellenoLog.objects.create(
        usuario=request.user, accion="rellenar", bimestre=bimestre,
        seccion_id=int(seccion_id) if seccion_id.isdigit() else None,
        nombre_archivo=archivo.name[:200], n_hojas=len(hojas),
        n_filas_rellenadas=n_rellenadas,
    )

    nivel = next((h.get("nivel") for h in hojas if h.get("nivel")), "siagie")
    resp = HttpResponse(
        excel_out.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = f'attachment; filename="siagie_relleno_{nivel}_B{bimestre}.xlsx"'
    resp["X-Filas-Rellenadas"] = str(n_rellenadas)
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def siagie_mapeos_listar(request):
    """Listar todos los mapeos guardados (para revisión y edición)."""
    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    from .models import SiagieMapeo
    mapeos = SiagieMapeo.objects.all().order_by("-creado_en")[:50]
    return Response({
        "mapeos": [
            {
                "hash": m.hash_header,
                "nivel": m.nivel,
                "metodo": m.metodo_deteccion,
                "tiene_conclusiones": m.tiene_conclusiones,
                "fila_datos": m.fila_datos,
                "muestra_header": m.muestra_header,
                "columnas": m.mapeo_json,
                "creado_en": m.creado_en.isoformat(),
            }
            for m in mapeos
        ],
    })


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def siagie_mapeo_editar(request, hash_header):
    """
    PATCH: edita manualmente el mapeo (columnas → campos).
    DELETE: borra el mapeo → próxima subida re-analiza con IA/heurística.
    Solo director/subdirector/admin_tic.
    """
    if request.user.rol not in ("director", "subdirector", "admin_tic"):
        raise PermissionDenied()

    from .models import SiagieMapeo
    try:
        m = SiagieMapeo.objects.get(hash_header=hash_header)
    except SiagieMapeo.DoesNotExist:
        return Response({"error": "Mapeo no encontrado."}, status=404)

    if request.method == "DELETE":
        m.delete()
        return Response({"ok": True, "mensaje": "Mapeo borrado. Próxima subida re-analizará."})

    # PATCH
    nuevo_mapeo = request.data.get("columnas")
    if not isinstance(nuevo_mapeo, dict):
        return Response({"error": "Enviá 'columnas' como dict {idx: campo}."}, status=400)

    m.mapeo_json = nuevo_mapeo
    m.metodo_deteccion = "manual"
    if "fila_datos" in request.data:
        m.fila_datos = int(request.data["fila_datos"])
    if "tiene_conclusiones" in request.data:
        m.tiene_conclusiones = bool(request.data["tiene_conclusiones"])
    m.save()

    return Response({"ok": True, "columnas": m.mapeo_json})


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def importar_notas(request):
    """Importa notas desde formato SIAGIE (multi-hoja) o formato simple.
    Formato SIAGIE: fila 6 = cabeceras (ID | Cód.Est | Nombres | 01 | | 02 | ...)
                    fila 7 = sub-cabeceras (NL | Conclusión | NL | Conclusión | ...)
                    fila 8+ = datos estudiantes
    """
    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()
    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el Excel en 'archivo'."}, status=400)

    try:
        wb = load_workbook(archivo, data_only=True)
    except Exception as e:
        return Response({"error": f"Excel inválido: {str(e)[:200]}"}, status=400)

    creadas, actualizadas, errores = 0, 0, []
    bimestre_param = request.data.get("bimestre", "1")

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(min_row=1, max_row=min(ws.max_row, 10), values_only=True))
        if not rows:
            continue

        # Detectar si es formato SIAGIE (fila 6 tiene "ID" en A6) o formato simple (fila 4 tiene "DNI")
        es_siagie = False
        fila_inicio = 5
        area_hoja = sheet_name

        for r_idx, row in enumerate(rows):
            if row and str(row[0] or "").strip().upper() == "ID":
                es_siagie = True
                fila_inicio = r_idx + 2  # datos en fila siguiente a sub-cabeceras
                break
            if row and "DNI" in str(row[0] or "").upper():
                fila_inicio = r_idx + 2
                break

        if es_siagie:
            # Detectar número de competencias por las cabeceras
            cabecera_row = rows[fila_inicio - 2] if fila_inicio >= 2 else rows[0]
            competencias_cols = []  # lista de (idx_columna_0based, num_competencia)
            for col_i, val in enumerate(cabecera_row or []):
                s = str(val or "").strip()
                if s.isdigit() and 1 <= int(s) <= 20:
                    competencias_cols.append((col_i, int(s)))

            # Inferir área del nombre de la hoja (ej "0005-COMU" → "Comunicación") o usar directo
            area_map = {
                "COMU": "Comunicación", "MATE": "Matemática", "CIENC": "Ciencia y Tecnología",
                "PSICO": "Tutoría", "PPSS": "Personal Social", "ING": "Inglés",
                "HIST": "Historia, Geografía y Economía", "EDUFIS": "Educación Física",
                "ARTE": "Arte y Cultura", "RELI": "Educación Religiosa",
            }
            area_hoja_upper = area_hoja.upper()
            area_detectada = area_hoja
            for cod, nombre in area_map.items():
                if cod in area_hoja_upper:
                    area_detectada = nombre
                    break

            # Procesar filas de estudiantes
            all_rows = list(ws.iter_rows(min_row=fila_inicio + 1, values_only=True))
            for r_num, fila in enumerate(all_rows, start=fila_inicio + 1):
                if not fila or not any(fila):
                    continue
                # Columnas: 0=ID(DNI), 1=Cód.Estudiante, 2=Nombres
                id_val = str(fila[0] or "").strip()
                cod_est = str(fila[1] or "").strip()
                if not id_val and not cod_est:
                    continue

                # Buscar estudiante por DNI (col A) o código matrícula (col B)
                est = None
                if id_val and id_val.isdigit():
                    est = Estudiante.objects.filter(usuario__dni=id_val).first()
                if not est and cod_est:
                    est = Estudiante.objects.filter(codigo_matricula=cod_est).first()
                if not est:
                    errores.append({"hoja": sheet_name, "fila": r_num, "error": f"Estudiante no encontrado (DNI={id_val}, Cód={cod_est})"})
                    continue

                for col_i, num_comp in competencias_cols:
                    try:
                        nl_val = str(fila[col_i] or "").strip().upper() if len(fila) > col_i else ""
                        conc_val = str(fila[col_i + 1] or "").strip() if len(fila) > col_i + 1 else ""
                        if not nl_val:
                            continue
                        if nl_val not in ("AD", "A", "B", "C"):
                            errores.append({"hoja": sheet_name, "fila": r_num, "error": f"NL inválido: {nl_val!r}"})
                            continue
                        if not conc_val:
                            conc_val = CONCLUSIONES_NL.get(nl_val, "")
                        nota, creada = NotaBimestre.objects.update_or_create(
                            estudiante=est, area=area_detectada,
                            bimestre=str(bimestre_param), competencia=num_comp,
                            defaults={
                                "calificacion": nl_val,
                                "conclusion_descriptiva": conc_val,
                            },
                        )
                        if creada:
                            creadas += 1
                        else:
                            actualizadas += 1
                    except Exception as e:
                        errores.append({"hoja": sheet_name, "fila": r_num, "comp": num_comp, "error": str(e)})
        else:
            # Formato simple heredado: DNI | Nombre | Área | Bimestre | NL | Nota numérica
            for i, fila in enumerate(ws.iter_rows(min_row=fila_inicio, values_only=True), start=fila_inicio):
                if not fila or not any(fila):
                    continue
                dni, nombre_ref, area, bimestre_fila, calif, num = (list(fila) + [None] * 6)[:6]
                try:
                    dni = str(dni or "").strip()
                    if not dni:
                        continue
                    est = Estudiante.objects.filter(usuario__dni=dni).first()
                    if not est:
                        raise ValueError(f"No hay estudiante con DNI {dni}")
                    area = str(area or "").strip()
                    bim = str(int(bimestre_fila or bimestre_param))
                    calif_final = str(calif or "").strip().upper() if calif else ""
                    num_final = float(num) if num not in (None, "") else None
                    conc = CONCLUSIONES_NL.get(calif_final, "")
                    nota, creada = NotaBimestre.objects.update_or_create(
                        estudiante=est, area=area, bimestre=bim, competencia=1,
                        defaults={
                            "calificacion": calif_final if calif_final in ("AD", "A", "B", "C") else "",
                            "calificacion_numerica": num_final,
                            "conclusion_descriptiva": conc,
                        },
                    )
                    if creada:
                        creadas += 1
                    else:
                        actualizadas += 1
                except Exception as e:
                    errores.append({"hoja": sheet_name, "fila": i, "error": str(e)})

    return Response({"creadas": creadas, "actualizadas": actualizadas, "errores": errores})


# ═════════════════════════════════════════════════════════════════════════════
# Boletas de notas PDF
# ═════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def conclusiones_nl(request):
    """Devuelve el diccionario de conclusiones descriptivas estándar por NL."""
    return Response(CONCLUSIONES_NL)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mis_asignaciones(request):
    """Para docentes: devuelve sus asignaciones del año lectivo activo."""
    if request.user.rol not in ("docente", "director", "subdirector"):
        return Response([])
    anio = _anio_lectivo_activo()
    qs = AsignacionDocente.objects.filter(
        docente=request.user, anio_lectivo=anio
    ).select_related("seccion")
    data = [
        {
            "id": a.pk,
            "seccion_id": a.seccion_id,
            "seccion_nombre": str(a.seccion),
            "seccion_grado": a.seccion.grado,
            "seccion_letra": a.seccion.letra,
            "seccion_nivel": a.seccion.nivel or "primaria",
            "area": a.area,
            "num_competencias": a.num_competencias,
            "anio_lectivo": a.anio_lectivo,
        }
        for a in qs
    ]
    return Response(data)


AREAS_PROFESOR_AULA = {
    "Comunicación": 3,
    "Matemática": 2,
    "Personal Social": 2,
    "Ciencia y Tecnología": 1,
    "Arte y Cultura": 1,
    "Educación Física": 1,
    "Educación Religiosa": 1,
}


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def asignar_profesor_aula(request):
    """Asigna un docente como profesor de aula de una sección inicial/primaria.
    Crea AsignacionDocente para todas las áreas estándar en un solo paso.
    Body: {seccion_id, docente_id}  — enviar docente_id=null para quitar."""
    if request.user.rol not in ("director", "subdirector", "admin_tic"):
        raise PermissionDenied()

    seccion_id = request.data.get("seccion_id")
    docente_id = request.data.get("docente_id")  # None = quitar profesor de aula

    try:
        seccion = Seccion.objects.get(pk=seccion_id)
    except Seccion.DoesNotExist:
        return Response({"error": "Sección no encontrada."}, status=400)

    if seccion.nivel not in ("inicial", "primaria"):
        return Response({"error": "Solo secciones de inicial y primaria usan profesor de aula."}, status=400)

    anio = _anio_lectivo_activo()
    # Eliminar asignaciones del año activo para esta sección (evita duplicados al reasignar)
    AsignacionDocente.objects.filter(seccion=seccion, anio_lectivo=anio).delete()

    if docente_id:
        try:
            docente = Usuario.objects.get(pk=docente_id, rol="docente")
        except Usuario.DoesNotExist:
            return Response({"error": "Docente no encontrado."}, status=400)

        creadas = []
        for area, num_comp in AREAS_PROFESOR_AULA.items():
            asig, _ = AsignacionDocente.objects.get_or_create(
                docente=docente, seccion=seccion, area=area, anio_lectivo=anio,
                defaults={"num_competencias": num_comp},
            )
            creadas.append({
                "id": asig.pk, "area": area, "num_competencias": asig.num_competencias,
                "docente_nombre": docente.get_full_name() or docente.username,
            })
        return Response({"asignaciones": creadas, "total": len(creadas)}, status=201)

    return Response({"asignaciones": [], "total": 0})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sugerencias_notas(request):
    """Sugiere calificaciones para el bimestre actual basándose en el historial previo.

    Query: ?seccion_id=X&area=Y&bimestre=Z&anio=2026

    Lógica:
    - Para cada estudiante busca sus notas en el mismo área, bimestres anteriores.
    - Sugiere la nota del bimestre más reciente disponible.
    - Si hay tendencia (mejorando/empeorando), la reporta.
    - Devuelve sugerencias SOLO para competencias sin nota registrada aún.
    """
    seccion_id = request.GET.get("seccion_id")
    area = request.GET.get("area", "")
    bimestre = request.GET.get("bimestre", "1")
    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    if not seccion_id or not area:
        return Response({"error": "seccion_id y area son requeridos."}, status=400)

    # Competencias con nota ya registrada en este bimestre (no sugerir sobre las que ya tienen nota)
    ya_registradas = set(
        NotaBimestre.objects.filter(
            estudiante__seccion_obj_id=seccion_id,
            area=area, bimestre=bimestre, anio_lectivo=anio,
        ).exclude(calificacion="").values_list("estudiante_id", "competencia")
    )

    # Historial: todas las notas del área en bimestres anteriores (mismo año + año anterior)
    ORDEN = {"1": 1, "2": 2, "3": 3, "4": 4}
    bimestre_actual_num = ORDEN.get(bimestre, 1)

    from django.db.models import Q
    historico = NotaBimestre.objects.filter(
        estudiante__seccion_obj_id=seccion_id,
        area=area,
    ).exclude(calificacion="").filter(
        # Mismo año, año anterior, o sin año (datos legacy)
        Q(anio_lectivo__in=[anio - 1, anio]) | Q(anio_lectivo__isnull=True)
    ).values("estudiante_id", "competencia", "bimestre", "anio_lectivo", "calificacion")

    # Agrupar por (estudiante, competencia)
    from collections import defaultdict
    historial: dict = defaultdict(list)
    for h in historico:
        # Solo incluir bimestres realmente previos al actual
        es_anio_anterior = h["anio_lectivo"] == anio - 1
        es_bimestre_previo = h["anio_lectivo"] == anio and ORDEN.get(h["bimestre"], 0) < bimestre_actual_num
        if es_anio_anterior or es_bimestre_previo:
            historial[(h["estudiante_id"], h["competencia"])].append(h)

    PESO = {"AD": 4, "A": 3, "B": 2, "C": 1}
    TENDENCIA_LABEL = {1: "mejorando", -1: "bajando", 0: "estable"}

    sugerencias = []
    for (est_id, comp), entradas in historial.items():
        if (est_id, comp) in ya_registradas:
            continue  # ya tiene nota, no sugerir

        # Ordenar cronológicamente (año + bimestre)
        entradas_ord = sorted(entradas, key=lambda e: (e["anio_lectivo"], ORDEN.get(e["bimestre"], 0)))
        ultima = entradas_ord[-1]["calificacion"]

        tendencia = 0
        if len(entradas_ord) >= 2:
            pen = PESO.get(entradas_ord[-2]["calificacion"], 0)
            ult = PESO.get(ultima, 0)
            tendencia = 1 if ult > pen else (-1 if ult < pen else 0)

        sugerencias.append({
            "estudiante_id": est_id,
            "competencia": comp,
            "sugerencia": ultima,
            "tendencia": TENDENCIA_LABEL[tendencia],
            "base": f"B{entradas_ord[-1]['bimestre']} {entradas_ord[-1]['anio_lectivo']}",
            "historial": [{"bimestre": e["bimestre"], "anio": e["anio_lectivo"], "nota": e["calificacion"]} for e in entradas_ord[-3:]],
        })

    return Response({"sugerencias": sugerencias, "total": len(sugerencias)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def normativa_rvm_048(request):
    """Devuelve las reglas RVM 048-2024 aplicables al frontend:
    - En qué nivel + NL la conclusión es obligatoria
    - Conversión oficial letra → puntos
    - Fórmula de calificativo de área
    """
    from .models import CONCLUSION_OBLIGATORIA_POR_NIVEL, LETRA_A_PUNTOS_OFICIAL
    return Response({
        "conclusion_obligatoria_por_nivel": {
            n: sorted(list(s)) for n, s in CONCLUSION_OBLIGATORIA_POR_NIVEL.items()
        },
        "letra_a_puntos": LETRA_A_PUNTOS_OFICIAL,
        "formula_calificativo_area": "(Σ puntos_competencias / (n × 4)) × 10",
        "rango_calificativo_area": [2.5, 10.0],
        "norma": "RVM 048-2024-MINEDU",
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def c_consecutiva(request):
    """RVM 048-2024. Detecta estudiantes con C en 2+ periodos consecutivos
    (mismo área/competencia). El docente debe sustentar en la conclusión.

    Query: ?seccion_id=X&area=Y[&anio=2026]
    """
    from collections import defaultdict
    seccion_id = request.GET.get("seccion_id")
    area = request.GET.get("area", "")
    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    if not seccion_id or not area:
        return Response({"error": "seccion_id y area son requeridos."}, status=400)

    notas = NotaBimestre.objects.filter(
        estudiante__seccion_obj_id=seccion_id, area=area, anio_lectivo=anio,
        calificacion="C",
    ).values("estudiante_id", "competencia", "bimestre", "conclusion_descriptiva")

    ORDEN = {"1": 1, "2": 2, "3": 3, "4": 4}
    grupos = defaultdict(list)
    for n in notas:
        grupos[(n["estudiante_id"], n["competencia"])].append(n)

    alertas = []
    for (est_id, comp), items in grupos.items():
        items_ord = sorted(items, key=lambda x: ORDEN.get(x["bimestre"], 0))
        # Buscar rachas de 2+ bimestres consecutivos con C
        for i in range(len(items_ord) - 1):
            a = items_ord[i]
            b = items_ord[i + 1]
            if ORDEN.get(b["bimestre"], 0) - ORDEN.get(a["bimestre"], 0) == 1:
                # Chequear si tiene conclusión sustentada
                concl_a = (a["conclusion_descriptiva"] or "").strip()
                concl_b = (b["conclusion_descriptiva"] or "").strip()
                sustentado = len(concl_a) >= 40 and len(concl_b) >= 40
                alertas.append({
                    "estudiante_id": est_id,
                    "competencia": comp,
                    "bimestres_consecutivos": [a["bimestre"], b["bimestre"]],
                    "sustentado": sustentado,
                    "conclusion_a": concl_a[:100],
                    "conclusion_b": concl_b[:100],
                })

    return Response({
        "alertas": alertas,
        "total": len(alertas),
        "norma": "RVM 048-2024-MINEDU · Si C en 2+ periodos consecutivos, el docente debe sustentar en la conclusión por qué no hay avance.",
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sugerencias_capacidad(request):
    """Sugiere calificación por capacidad basada en el historial del mismo estudiante
    en esa misma capacidad en bimestres/años anteriores."""
    import json as _json
    from collections import defaultdict, Counter

    seccion_id = request.GET.get("seccion_id")
    area = request.GET.get("area", "")
    bimestre = request.GET.get("bimestre", "1")
    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    if not seccion_id or not area:
        return Response({"error": "seccion_id y area son requeridos."}, status=400)

    ORDEN = {"1": 1, "2": 2, "3": 3, "4": 4}
    bim_num = ORDEN.get(bimestre, 1)

    from django.db.models import Q
    hist = NotaBimestre.objects.filter(
        estudiante__seccion_obj_id=seccion_id, area=area,
    ).filter(
        Q(anio_lectivo__in=[anio - 1, anio]) | Q(anio_lectivo__isnull=True)
    ).exclude(observaciones="").values(
        "estudiante_id", "bimestre", "anio_lectivo", "observaciones"
    )

    votos = defaultdict(list)  # (est_id, cap_id) → [grado, ...]
    for n in hist:
        anterior = (
            n["anio_lectivo"] == anio - 1 or
            (n["anio_lectivo"] == anio and ORDEN.get(n["bimestre"], 0) < bim_num)
        )
        if not anterior:
            continue
        try:
            obs = _json.loads(n["observaciones"])
        except (ValueError, TypeError):
            continue
        for cap_id, grado in (obs.get("capacidades") or {}).items():
            if grado in ("AD", "A", "B", "C"):
                votos[(n["estudiante_id"], int(cap_id))].append(grado)

    def moda(vals):
        if not vals:
            return None
        c = Counter(vals)
        orden = {"AD": 4, "A": 3, "B": 2, "C": 1}
        return max(c.items(), key=lambda x: (x[1], orden.get(x[0], 0)))[0]

    resultado = []
    for (est_id, cap_id), vals in votos.items():
        m = moda(vals)
        if m:
            resultado.append({
                "estudiante_id": est_id,
                "capacidad_id": cap_id,
                "sugerencia": m,
                "muestras": len(vals),
            })

    return Response({"sugerencias": resultado, "total": len(resultado)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sugerencias_desempeno(request):
    """Sugiere calificación por desempeño individual, basado en el historial
    del estudiante en ESE mismo desempeño en bimestres/años anteriores.

    Query: ?seccion_id=X&area=Y&bimestre=Z&anio=2026

    Lee `observaciones` JSON de cada nota histórica y extrae los desempeños
    calificados. Devuelve la moda por (estudiante, desempeno_id).
    """
    import json as _json
    from collections import defaultdict, Counter

    seccion_id = request.GET.get("seccion_id")
    area = request.GET.get("area", "")
    bimestre = request.GET.get("bimestre", "1")
    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    if not seccion_id or not area:
        return Response({"error": "seccion_id y area son requeridos."}, status=400)

    ORDEN = {"1": 1, "2": 2, "3": 3, "4": 4}
    bim_num = ORDEN.get(bimestre, 1)

    # Notas históricas del área en el mismo año o anterior
    from django.db.models import Q
    hist = NotaBimestre.objects.filter(
        estudiante__seccion_obj_id=seccion_id, area=area,
    ).filter(
        Q(anio_lectivo__in=[anio - 1, anio]) | Q(anio_lectivo__isnull=True)
    ).exclude(observaciones="").values(
        "estudiante_id", "bimestre", "anio_lectivo", "observaciones"
    )

    # Agrupar grados por (estudiante, desempeno_id)
    votos = defaultdict(list)  # (est_id, des_id) → [grado, grado, ...]
    for n in hist:
        anterior = (
            n["anio_lectivo"] == anio - 1 or
            (n["anio_lectivo"] == anio and ORDEN.get(n["bimestre"], 0) < bim_num)
        )
        if not anterior:
            continue
        try:
            obs = _json.loads(n["observaciones"])
        except (ValueError, TypeError):
            continue
        for des_id, grado in (obs.get("desempenos") or {}).items():
            if grado in ("AD", "A", "B", "C"):
                votos[(n["estudiante_id"], int(des_id))].append(grado)

    def moda(vals):
        if not vals:
            return None
        c = Counter(vals)
        # En empate, prefiere el más alto
        orden = {"AD": 4, "A": 3, "B": 2, "C": 1}
        return max(c.items(), key=lambda x: (x[1], orden.get(x[0], 0)))[0]

    resultado = []
    for (est_id, des_id), vals in votos.items():
        m = moda(vals)
        if m:
            resultado.append({
                "estudiante_id": est_id,
                "desempeno_id": des_id,
                "sugerencia": m,
                "muestras": len(vals),
            })

    return Response({"sugerencias": resultado, "total": len(resultado)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def informe_notas(request):
    """Genera un informe pedagógico con IA para una sección y período.
    Query: ?seccion_id=X&bimestre=1        → bimestral
           ?seccion_id=X&bimestre=1,2      → semestral / multi-bimestre
           ?seccion_id=X                   → anual (todos los bimestres)"""
    if request.user.rol not in ("director", "subdirector", "docente", "admin_tic", "secretaria"):
        raise PermissionDenied()

    seccion_id = request.GET.get("seccion_id")
    bimestre_raw = request.GET.get("bimestre", "")
    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    # Soporte multi-bimestre: "1,2" → ["1","2"]
    bimestres = [b.strip() for b in bimestre_raw.split(",") if b.strip() in ("1", "2", "3", "4")]

    if not seccion_id:
        return Response({"error": "Parámetro seccion_id requerido."}, status=400)

    try:
        from apps.usuarios.models import Seccion
        seccion = Seccion.objects.get(pk=seccion_id)
    except Seccion.DoesNotExist:
        return Response({"error": "Sección no encontrada."}, status=404)

    # Docente solo puede ver informes de sus secciones asignadas (del año activo)
    if _es_docente_activo(request.user):
        tiene_asignacion = AsignacionDocente.objects.filter(
            docente=request.user, seccion_id=seccion_id, anio_lectivo=anio
        ).exists()
        if not tiene_asignacion:
            raise PermissionDenied("Solo puedes generar informes de tus secciones asignadas.")

    # Si es docente, limitar a sus áreas asignadas en esta sección
    areas_docente = None
    if _es_docente_activo(request.user):
        areas_docente = set(
            AsignacionDocente.objects.filter(
                docente=request.user, seccion_id=seccion_id, anio_lectivo=anio
            ).values_list("area", flat=True)
        )

    qs = NotaBimestre.objects.filter(
        estudiante__seccion_obj_id=seccion_id, anio_lectivo=anio
    ).select_related("estudiante__usuario")
    if bimestres:
        qs = qs.filter(bimestre__in=bimestres)
    if areas_docente is not None:
        qs = qs.filter(area__in=areas_docente)

    # Construir distribución por área
    from collections import defaultdict
    dist_area: dict = defaultdict(lambda: {"AD": 0, "A": 0, "B": 0, "C": 0})
    for nota in qs:
        if nota.calificacion in ("AD", "A", "B", "C"):
            dist_area[nota.area][nota.calificacion] += 1

    total_estudiantes = (
        Estudiante.objects.filter(seccion_obj_id=seccion_id, usuario__activo=True).count()
    )

    areas_stats = [
        {"area": area, "distribucion": dict(dist)}
        for area, dist in sorted(dist_area.items())
    ]

    periodo_label = ",".join(bimestres) if bimestres else "todos"

    datos = {
        "seccion_nombre": str(seccion),
        "bimestre": periodo_label,
        "total_estudiantes": total_estudiantes,
        "areas": areas_stats,
    }

    from apps.ia.servicios import generar_informe_notas
    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()
    narrative = generar_informe_notas(datos, usuario=request.user, plantilla=cfg.plantilla_informe or None)

    return Response({
        "seccion": str(seccion),
        "bimestre": periodo_label,
        "total_estudiantes": total_estudiantes,
        "areas": areas_stats,
        "narrativa": narrative,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def exportar_informe(request):
    """Exporta el informe de notas como xlsx, pdf o docx.
    Query: ?seccion_id=X&bimestre=1&anio=2026&formato=xlsx"""
    if request.user.rol not in ("director", "subdirector", "docente", "admin_tic", "secretaria"):
        raise PermissionDenied()

    seccion_id = request.GET.get("seccion_id")
    bimestre_raw = request.GET.get("bimestre", "")
    anio_param = request.GET.get("anio")
    formato = request.GET.get("formato", "xlsx").lower()
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()
    bimestres = [b.strip() for b in bimestre_raw.split(",") if b.strip() in ("1", "2", "3", "4")]

    if not seccion_id:
        return Response({"error": "Parámetro seccion_id requerido."}, status=400)
    if formato not in ("xlsx", "pdf", "docx"):
        return Response({"error": "Formato inválido. Usa xlsx, pdf o docx."}, status=400)

    try:
        seccion = Seccion.objects.get(pk=seccion_id)
    except Seccion.DoesNotExist:
        return Response({"error": "Sección no encontrada."}, status=404)

    if _es_docente_activo(request.user):
        tiene_asignacion = AsignacionDocente.objects.filter(
            docente=request.user, seccion_id=seccion_id, anio_lectivo=anio
        ).exists()
        if not tiene_asignacion:
            raise PermissionDenied("Solo puedes exportar informes de tus secciones asignadas.")

    areas_docente = None
    if _es_docente_activo(request.user):
        areas_docente = set(
            AsignacionDocente.objects.filter(
                docente=request.user, seccion_id=seccion_id, anio_lectivo=anio
            ).values_list("area", flat=True)
        )

    qs = NotaBimestre.objects.filter(
        estudiante__seccion_obj_id=seccion_id, anio_lectivo=anio
    )
    if bimestres:
        qs = qs.filter(bimestre__in=bimestres)
    if areas_docente is not None:
        qs = qs.filter(area__in=areas_docente)

    from collections import defaultdict
    dist_area: dict = defaultdict(lambda: {"AD": 0, "A": 0, "B": 0, "C": 0})
    for nota in qs:
        if nota.calificacion in ("AD", "A", "B", "C"):
            dist_area[nota.area][nota.calificacion] += 1

    total_estudiantes = Estudiante.objects.filter(seccion_obj_id=seccion_id, usuario__activo=True).count()
    areas_stats = [
        {"area": area, "distribucion": dict(dist)}
        for area, dist in sorted(dist_area.items())
    ]
    periodo_label = ",".join(bimestres) if bimestres else "todos"
    periodo_str = (
        "Informe anual" if periodo_label == "todos"
        else f"Semestre 1 (B1+B2)" if periodo_label == "1,2"
        else f"Semestre 2 (B3+B4)" if periodo_label == "3,4"
        else f"Bimestre {periodo_label}"
    )

    from apps.ia.servicios import generar_informe_notas
    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()
    narrativa = generar_informe_notas(
        {"seccion_nombre": str(seccion), "bimestre": periodo_label,
         "total_estudiantes": total_estudiantes, "areas": areas_stats},
        usuario=request.user, plantilla=cfg.plantilla_informe or None
    )
    institucion_nombre = cfg.nombre_institucion or "Mi Institución Educativa"
    seccion_nombre = str(seccion)

    nombre_base = f"informe_{seccion_nombre.replace(' ', '_')}_{periodo_label}"

    if formato == "xlsx":
        buf = _exportar_informe_xlsx(
            seccion_nombre, periodo_str, anio, total_estudiantes,
            areas_stats, narrativa, institucion_nombre
        )
        resp = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="{nombre_base}.xlsx"'
        return resp

    elif formato == "pdf":
        buf = _exportar_informe_pdf(
            seccion_nombre, periodo_str, anio, total_estudiantes,
            areas_stats, narrativa, institucion_nombre
        )
        resp = HttpResponse(buf.read(), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{nombre_base}.pdf"'
        return resp

    else:  # docx
        buf = _exportar_informe_docx(
            seccion_nombre, periodo_str, anio, total_estudiantes,
            areas_stats, narrativa, institucion_nombre
        )
        resp = HttpResponse(buf.read(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        resp["Content-Disposition"] = f'attachment; filename="{nombre_base}.docx"'
        return resp


def _exportar_informe_xlsx(seccion, periodo, anio, total, areas, narrativa, institucion):
    from openpyxl.utils import get_column_letter
    wb = Workbook()
    ws = wb.active
    ws.title = "Informe"

    # Estilos
    azul = "1E3A5F"
    verde = "1E6B2E"
    rojo = "DC2626"
    naranja = "D97706"
    azul_claro = "2563EB"
    gris = "F3F4F6"

    def cell(row, col, value, bold=False, bg=None, fg="000000", size=11, align="left", wrap=False):
        c = ws.cell(row=row, column=col, value=value)
        c.font = Font(bold=bold, color=fg, size=size)
        if bg:
            c.fill = PatternFill("solid", fgColor=bg)
        c.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
        return c

    # Encabezado
    ws.merge_cells("A1:G1")
    cell(1, 1, institucion, bold=True, bg=azul, fg="FFFFFF", size=13, align="center")
    ws.row_dimensions[1].height = 26

    ws.merge_cells("A2:G2")
    cell(2, 1, f"Informe de aprendizaje — {seccion} · {periodo} · {anio}", bold=True, bg="2563EB", fg="FFFFFF", size=11, align="center")
    ws.row_dimensions[2].height = 22

    ws.merge_cells("A3:G3")
    cell(3, 1, f"Total estudiantes: {total}", bg=gris, size=10, align="center")

    # Fila vacía
    ws.row_dimensions[4].height = 8

    # Headers tabla
    headers = ["Área curricular", "AD", "A", "B", "C", "Total", "% Logro (AD+A)"]
    header_bgs = [azul, verde, azul_claro, naranja, rojo, "6B7280", "047857"]
    for ci, (h, bg) in enumerate(zip(headers, header_bgs), 1):
        cell(5, ci, h, bold=True, bg=bg, fg="FFFFFF", size=10, align="center")
    ws.row_dimensions[5].height = 20

    # Datos
    row = 6
    for a in areas:
        d = a["distribucion"]
        ad, a_, b, c = d.get("AD", 0), d.get("A", 0), d.get("B", 0), d.get("C", 0)
        tot = ad + a_ + b + c
        pct_logro = round((ad + a_) / tot * 100) if tot else 0
        bg_row = "FFFFFF" if row % 2 == 0 else gris
        cell(row, 1, a["area"], bg=bg_row, size=10)
        for ci, v in enumerate([ad, a_, b, c, tot], 2):
            cell(row, ci, v, bg=bg_row, size=10, align="center")
        cell(row, 7, f"{pct_logro}%", bg=bg_row, size=10, align="center",
             bold=pct_logro >= 70)
        ws.row_dimensions[row].height = 18
        row += 1

    # Anchos de columna
    ws.column_dimensions["A"].width = 32
    for col in "BCDEFG":
        ws.column_dimensions[col].width = 12

    # Narrativa en segunda hoja
    if narrativa:
        ws2 = wb.create_sheet("Análisis IA")
        ws2.column_dimensions["A"].width = 80
        ws2.merge_cells("A1:A1")
        c = ws2.cell(row=1, column=1, value="Análisis pedagógico (generado con IA)")
        c.font = Font(bold=True, size=13, color=azul)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        ws2.row_dimensions[1].height = 22

        for i, linea in enumerate(narrativa.splitlines(), 2):
            c2 = ws2.cell(row=i, column=1, value=linea.strip("# "))
            c2.font = Font(bold=linea.startswith("##"), size=10)
            c2.alignment = Alignment(wrap_text=True, vertical="top")
            ws2.row_dimensions[i].height = 15 if linea.strip() else 8

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _exportar_informe_pdf(seccion, periodo, anio, total, areas, narrativa, institucion):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    azul = colors.HexColor("#1E3A5F")
    azul_cl = colors.HexColor("#2563EB")
    gris = colors.HexColor("#F3F4F6")

    titulo_s = ParagraphStyle("titulo", parent=styles["Normal"],
                               fontSize=14, fontName="Helvetica-Bold",
                               textColor=colors.white, backColor=azul,
                               spaceAfter=0, spaceBefore=0,
                               leftIndent=8, rightIndent=8, leading=22)
    sub_s = ParagraphStyle("sub", parent=styles["Normal"],
                            fontSize=11, fontName="Helvetica-Bold",
                            textColor=colors.white, backColor=azul_cl,
                            spaceAfter=0, spaceBefore=0,
                            leftIndent=8, rightIndent=8, leading=20)
    body_s = ParagraphStyle("body", parent=styles["Normal"],
                             fontSize=10, leading=14,
                             spaceAfter=6)
    h2_s = ParagraphStyle("h2", parent=styles["Normal"],
                           fontSize=11, fontName="Helvetica-Bold",
                           textColor=azul, spaceBefore=10, spaceAfter=4)

    story = [
        Paragraph(institucion, titulo_s),
        Paragraph(f"Informe de aprendizaje — {seccion} · {periodo} · {anio}", sub_s),
        Spacer(1, 8),
        Paragraph(f"Total estudiantes: <b>{total}</b>", body_s),
        Spacer(1, 8),
    ]

    # Tabla de distribución
    col_widths = [7*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.8*cm, 2.2*cm]
    data = [["Área curricular", "AD", "A", "B", "C", "Total", "% Logro"]]
    for a in areas:
        d = a["distribucion"]
        ad, a_, b, c = d.get("AD",0), d.get("A",0), d.get("B",0), d.get("C",0)
        tot = ad + a_ + b + c
        pct = f"{round((ad+a_)/tot*100)}%" if tot else "—"
        data.append([a["area"], str(ad), str(a_), str(b), str(c), str(tot), pct])

    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), azul),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("ALIGN", (1,0), (-1,-1), "CENTER"),
        ("ALIGN", (0,0), (0,-1), "LEFT"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, gris]),
        ("GRID", (0,0), (-1,-1), 0.5, colors.HexColor("#D1D5DB")),
        ("LEFTPADDING", (0,0), (-1,-1), 4),
        ("RIGHTPADDING", (0,0), (-1,-1), 4),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(tbl)

    if narrativa:
        story.append(Spacer(1, 16))
        story.append(Paragraph("Análisis pedagógico (IA)", h2_s))
        for linea in narrativa.splitlines():
            if linea.startswith("## "):
                story.append(Paragraph(linea[3:], h2_s))
            elif linea.strip():
                story.append(Paragraph(linea, body_s))

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Generado automáticamente con IA. Revisa antes de compartir.",
        ParagraphStyle("nota", parent=body_s, fontSize=8, textColor=colors.gray)
    ))

    doc.build(story)
    buf.seek(0)
    return buf


def _exportar_informe_docx(seccion, periodo, anio, total, areas, narrativa, institucion):
    from docx import Document
    from docx.shared import Pt, RGBColor, Cm
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    doc = Document()
    # Márgenes
    for section in doc.sections:
        section.top_margin = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    def add_heading(text, level=1, color=(30, 58, 95)):
        p = doc.add_heading(text, level=level)
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        for run in p.runs:
            run.font.color.rgb = RGBColor(*color)
        return p

    def add_para(text, bold=False, size=10):
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.bold = bold
        run.font.size = Pt(size)
        return p

    add_heading(institucion, level=1)
    add_heading(f"Informe de aprendizaje — {seccion}", level=2, color=(37,99,235))
    add_para(f"{periodo} · Año {anio} · Total estudiantes: {total}", bold=False, size=10)
    doc.add_paragraph()

    # Tabla de distribución
    headers = ["Área curricular", "AD", "A", "B", "C", "Total", "% Logro"]
    tbl = doc.add_table(rows=1 + len(areas), cols=len(headers))
    tbl.style = "Table Grid"

    # Header row
    hdr = tbl.rows[0]
    for ci, h in enumerate(headers):
        cell = hdr.cells[ci]
        cell.text = h
        run = cell.paragraphs[0].runs[0]
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(255, 255, 255)
        # Fondo azul
        tc_pr = cell._tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), "1E3A5F")
        tc_pr.append(shd)

    for ri, a in enumerate(areas, 1):
        d = a["distribucion"]
        ad, a_, b, c = d.get("AD",0), d.get("A",0), d.get("B",0), d.get("C",0)
        tot = ad + a_ + b + c
        pct = f"{round((ad+a_)/tot*100)}%" if tot else "—"
        valores = [a["area"], str(ad), str(a_), str(b), str(c), str(tot), pct]
        row = tbl.rows[ri]
        for ci, v in enumerate(valores):
            cell = row.cells[ci]
            cell.text = v
            cell.paragraphs[0].runs[0].font.size = Pt(9)

    doc.add_paragraph()

    if narrativa:
        add_heading("Análisis pedagógico (IA)", level=2, color=(30, 58, 95))
        for linea in narrativa.splitlines():
            if linea.startswith("## "):
                add_heading(linea[3:], level=3, color=(37, 99, 235))
            elif linea.strip():
                add_para(linea)

        doc.add_paragraph()
        p = doc.add_paragraph()
        run = p.add_run("Generado automáticamente con IA. Revisa antes de compartir.")
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(107, 114, 128)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def boleta_estudiante(request, estudiante_id):
    """Genera y devuelve el PDF de la boleta de UN estudiante.

    Query params:
      bimestre = 1 | 2 | 3 | 4 (default: 1)
      anio     = año lectivo (default: año actual)

    Permisos:
      - Director/Subdirector/Admin_TIC/Secretaria/Docente → cualquier estudiante
      - Padre → solo hijos vinculados
      - Estudiante → solo su propia boleta
    """
    from apps.usuarios.models import Estudiante
    from apps.notas.boletas import generar_boleta_pdf

    est = Estudiante.objects.filter(pk=estudiante_id).select_related("usuario", "seccion_obj__tutor").first()
    if not est:
        return Response({"error": "Estudiante no encontrado."}, status=404)

    user = request.user
    autorizado = False
    if user.rol in ("director", "subdirector", "admin_tic", "secretaria", "docente", "auxiliar"):
        autorizado = True
    elif user.rol == "padre":
        try:
            autorizado = user.perfil_padre.hijos.filter(pk=est.pk).exists()
        except AttributeError:
            autorizado = False
    elif user.rol == "estudiante":
        autorizado = (getattr(user, "perfil_estudiante", None) and user.perfil_estudiante.pk == est.pk)

    if not autorizado:
        raise PermissionDenied("No podés ver esta boleta.")

    bimestre = str(request.GET.get("bimestre", "1"))
    if bimestre not in ("1", "2", "3", "4"):
        return Response({"error": "Bimestre inválido (1-4)."}, status=400)
    try:
        anio = int(request.GET.get("anio", 0)) or None
    except ValueError:
        anio = None

    pdf = generar_boleta_pdf(est, bimestre, anio)
    resp = HttpResponse(pdf, content_type="application/pdf")
    nombre = f"boleta_{est.codigo_matricula or est.usuario.dni or est.pk}_B{bimestre}.pdf"
    resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def boletas_seccion_zip(request, seccion_id):
    """Genera un ZIP con las boletas de TODOS los estudiantes de una sección.

    Query params:
      bimestre = 1 | 2 | 3 | 4 (default: 1)
    """
    from apps.usuarios.models import Estudiante, Seccion
    from apps.notas.boletas import generar_boletas_zip

    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    # Docente: solo puede generar boletas de sus secciones asignadas
    if _es_docente_activo(request.user):
        tiene_asig = AsignacionDocente.objects.filter(
            docente=request.user, seccion_id=seccion_id,
            anio_lectivo=_anio_lectivo_activo()
        ).exists()
        if not tiene_asig:
            raise PermissionDenied("Solo podés generar boletas de tus secciones asignadas.")

    if not Seccion.objects.filter(pk=seccion_id).exists():
        return Response({"error": "Sección no encontrada."}, status=404)

    bimestre = str(request.GET.get("bimestre", "1"))
    if bimestre not in ("1", "2", "3", "4"):
        return Response({"error": "Bimestre inválido (1-4)."}, status=400)

    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    estudiantes = Estudiante.objects.filter(seccion_obj_id=seccion_id, usuario__activo=True)
    if not estudiantes.exists():
        return Response({"error": "La sección no tiene estudiantes."}, status=400)

    zip_bytes = generar_boletas_zip(estudiantes, bimestre, anio)
    seccion = Seccion.objects.get(pk=seccion_id)
    nombre = f"boletas_{seccion.grado}_{seccion.letra}_B{bimestre}.zip"
    resp = HttpResponse(zip_bytes, content_type="application/zip")
    resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def libreta_anual_seccion_zip(request, seccion_id):
    """ZIP con la libreta anual de todos los estudiantes de una sección.
    Query params: anio (default: año lectivo activo)
    """
    from apps.usuarios.models import Estudiante, Seccion
    from apps.notas.boletas import generar_libretas_anuales_zip

    if request.user.rol not in ROLES_PUEDEN_CARGAR:
        raise PermissionDenied()

    if _es_docente_activo(request.user):
        tiene_asig = AsignacionDocente.objects.filter(
            docente=request.user, seccion_id=seccion_id,
            anio_lectivo=_anio_lectivo_activo()
        ).exists()
        if not tiene_asig:
            raise PermissionDenied("Solo podés generar libretas de tus secciones asignadas.")

    if not Seccion.objects.filter(pk=seccion_id).exists():
        return Response({"error": "Sección no encontrada."}, status=404)

    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    estudiantes = Estudiante.objects.filter(seccion_obj_id=seccion_id, usuario__activo=True)
    if not estudiantes.exists():
        return Response({"error": "La sección no tiene estudiantes."}, status=400)

    zip_bytes = generar_libretas_anuales_zip(estudiantes, anio)
    seccion = Seccion.objects.get(pk=seccion_id)
    nombre = f"libretas_anuales_{seccion.grado}_{seccion.letra}_{anio}.zip"
    resp = HttpResponse(zip_bytes, content_type="application/zip")
    resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def boletas_grado_zip(request):
    """Genera un ZIP con las boletas de TODOS los estudiantes de un grado completo.
    Solo director/subdirector/admin_tic.
    Query params: grado (ej: '1ro'), nivel (ej: 'secundaria'), bimestre (1-4)
    """
    from apps.usuarios.models import Estudiante, Seccion
    from apps.notas.boletas import generar_boletas_zip
    import io, zipfile

    if request.user.rol not in ("director", "subdirector", "admin_tic"):
        raise PermissionDenied()

    grado = request.GET.get("grado", "").strip()
    nivel = request.GET.get("nivel", "").strip()
    bimestre = str(request.GET.get("bimestre", "1"))
    anio_param = request.GET.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else _anio_lectivo_activo()

    if bimestre not in ("1", "2", "3", "4"):
        return Response({"error": "Bimestre inválido."}, status=400)
    if not grado and not nivel:
        return Response({"error": "Indica grado o nivel."}, status=400)

    secciones_qs = Seccion.objects.all()
    if grado:
        secciones_qs = secciones_qs.filter(grado__iexact=grado)
    if nivel:
        secciones_qs = secciones_qs.filter(nivel__iexact=nivel)

    # Un ZIP que contiene sub-ZIPs por sección, o un ZIP plano con todos los PDFs
    buf_final = io.BytesIO()
    with zipfile.ZipFile(buf_final, "w", zipfile.ZIP_DEFLATED) as zf_final:
        for seccion in secciones_qs.order_by("grado", "letra"):
            estudiantes = Estudiante.objects.filter(seccion_obj=seccion, usuario__activo=True)
            if not estudiantes.exists():
                continue
            zip_sec = generar_boletas_zip(estudiantes, bimestre, anio)
            nombre_sec = f"boletas_{seccion.grado}_{seccion.letra}_B{bimestre}.zip"
            zf_final.writestr(nombre_sec, zip_sec)

    prefijo = grado or nivel or "todas"
    nombre_final = f"boletas_{prefijo}_B{bimestre}.zip"
    resp = HttpResponse(buf_final.getvalue(), content_type="application/zip")
    resp["Content-Disposition"] = f'attachment; filename="{nombre_final}"'
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generar_conclusiones_ia(request):
    """Genera y guarda conclusiones descriptivas personalizadas con IA para todos los
    estudiantes de una sección en un bimestre.

    Body: { seccion_id, bimestre, anio (opcional) }
    Permisos: director, subdirector, docente de la sección.
    """
    from apps.usuarios.models import Estudiante, Seccion
    from apps.ia.servicios import generar_conclusiones_personalizadas

    if request.user.rol not in ("director", "subdirector", "docente", "admin_tic"):
        raise PermissionDenied()

    seccion_id = request.data.get("seccion_id")
    bimestre = str(request.data.get("bimestre", "1"))
    anio_param = request.data.get("anio")
    anio = int(anio_param) if anio_param else _anio_lectivo_activo()
    estudiante_id = request.data.get("estudiante_id")  # opcional: genera para un solo estudiante
    comp_nombres = request.data.get("comp_nombres", [])  # opcional: nombres de competencias C1/C2/...

    if not seccion_id:
        return Response({"error": "seccion_id requerido."}, status=400)

    try:
        seccion = Seccion.objects.get(pk=seccion_id)
    except Seccion.DoesNotExist:
        return Response({"error": "Sección no encontrada."}, status=404)

    # Docente: solo su sección
    if _es_docente_activo(request.user):
        tiene_asig = AsignacionDocente.objects.filter(
            docente=request.user, seccion=seccion, anio_lectivo=anio
        ).exists()
        if not tiene_asig:
            raise PermissionDenied("No tenés asignación en esta sección.")

    est_qs = Estudiante.objects.filter(seccion_obj=seccion, usuario__activo=True)
    if estudiante_id:
        est_qs = est_qs.filter(pk=estudiante_id)
    estudiantes = list(
        est_qs.select_related("usuario")
        .order_by("usuario__last_name", "usuario__first_name")
    )

    if not estudiantes:
        return Response({"error": "Sin estudiantes en esta sección."}, status=400)

    procesados = 0
    errores = 0
    total_conclusiones = 0

    for est in estudiantes:
        nombre = f"{est.usuario.first_name} {est.usuario.last_name}".strip() or est.usuario.username

        # Agrupar notas por área
        notas_qs = NotaBimestre.objects.filter(
            estudiante=est, bimestre=bimestre, anio_lectivo=anio
        ).order_by("area", "competencia")

        if not notas_qs.exists():
            continue

        notas_por_area: dict = {}
        for nota in notas_qs:
            notas_por_area.setdefault(nota.area, []).append(nota.calificacion or "—")

        # Llamar a la IA
        conclusiones = generar_conclusiones_personalizadas(
            estudiante_nombre=nombre,
            notas_por_area=notas_por_area,
            bimestre=bimestre,
            usuario=request.user,
            comp_nombres=comp_nombres or [],
        )

        if not conclusiones:
            errores += 1
            continue

        # Guardar conclusiones en la primera competencia de cada área
        for area, conclusion_texto in conclusiones.items():
            updated = NotaBimestre.objects.filter(
                estudiante=est, area__iexact=area,
                bimestre=bimestre, anio_lectivo=anio,
                competencia=1,
            ).update(conclusion_descriptiva=str(conclusion_texto)[:600])
            total_conclusiones += updated

        procesados += 1

    resp = {
        "ok": True,
        "procesados": procesados,
        "errores": errores,
        "total_conclusiones_actualizadas": total_conclusiones,
        "mensaje": f"IA generó conclusiones para {procesados} estudiantes ({total_conclusiones} notas actualizadas).",
    }
    # Para generación individual: devolver el texto de la conclusión directamente
    if estudiante_id and procesados == 1 and estudiantes:
        nota_updated = NotaBimestre.objects.filter(
            estudiante=estudiantes[0], bimestre=bimestre, anio_lectivo=anio, competencia=1,
        ).values_list("conclusion_descriptiva", flat=True).first()
        resp["conclusion"] = nota_updated or ""
    return Response(resp)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def certificado_estudios(request, estudiante_id):
    """Genera el PDF del Certificado de Estudios para un alumno.

    Query params:
      desde_anio = año inicial (default: primer_anio_lectivo de config)
      hasta_anio = año final (default: anio_lectivo_activo de config)

    Permisos: director, subdirector, admin_tic, secretaria.
    """
    from apps.usuarios.models import Estudiante
    from apps.notas.certificados import generar_certificado_pdf
    from apps.core.models import ConfiguracionInstitucional

    if request.user.rol not in ("director", "subdirector", "admin_tic", "secretaria"):
        raise PermissionDenied("Solo el director o secretaría puede generar certificados.")

    est = Estudiante.objects.filter(pk=estudiante_id).select_related("usuario", "seccion_obj").first()
    if not est:
        return Response({"error": "Estudiante no encontrado."}, status=404)

    cfg = ConfiguracionInstitucional.get_solo()
    anio_activo = cfg.anio_lectivo_activo or _anio_lectivo_activo()
    primer_anio = cfg.primer_anio_lectivo or anio_activo

    try:
        desde = int(request.GET.get("desde_anio", primer_anio))
        hasta = int(request.GET.get("hasta_anio", anio_activo))
    except ValueError:
        return Response({"error": "Años inválidos."}, status=400)

    if desde > hasta:
        return Response({"error": "desde_anio debe ser ≤ hasta_anio."}, status=400)

    pdf = generar_certificado_pdf(est, desde, hasta)
    nombre_file = f"certificado_{est.usuario.last_name}_{est.usuario.first_name}_{desde}-{hasta}.pdf"
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="{nombre_file}"'
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def importar_notas_historicas(request):
    """Importa notas históricas desde un Excel en formato SIAGIE para un año anterior.

    Form data:
      archivo: File (.xlsx en formato SIAGIE — una hoja por área)
      anio: int — año lectivo al que pertenecen estos datos
      seccion_id: int — sección a la que corresponden

    El Excel debe tener el mismo formato que exporta el sistema:
      columnas: DNI | Código | Nombres | C1-NL | C1-Conclusión | C2-NL | ...

    Permisos: director, subdirector, admin_tic, secretaria.
    """
    from apps.usuarios.models import Estudiante
    import openpyxl

    if request.user.rol not in ("director", "subdirector", "admin_tic", "secretaria"):
        raise PermissionDenied()

    archivo = request.FILES.get("archivo")
    anio_str = request.data.get("anio")
    seccion_id = request.data.get("seccion_id")

    if not archivo or not anio_str:
        return Response({"error": "Se requiere archivo y anio."}, status=400)

    try:
        anio = int(anio_str)
    except ValueError:
        return Response({"error": "anio debe ser un número."}, status=400)

    try:
        wb = openpyxl.load_workbook(archivo, read_only=True, data_only=True)
    except Exception as e:
        return Response({"error": f"No se pudo leer el Excel: {e}"}, status=400)

    creadas = 0
    actualizadas = 0
    errores = []

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        area = sheet_name.strip()

        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 7:  # Las primeras 7 filas son cabecera en nuestro formato SIAGIE
            continue

        # Detectar fila de datos: buscar fila donde col[0] parece DNI (numérico)
        data_start = 7
        for i, row in enumerate(rows):
            if row and row[0] and str(row[0]).isdigit():
                data_start = i
                break

        # Detectar cuántas competencias hay (pares NL/Conclusión a partir de col 3)
        header_row = rows[data_start - 1] if data_start > 0 else rows[0]
        num_comp = 0
        for col_idx in range(3, len(header_row or []), 2):
            num_comp += 1

        for row in rows[data_start:]:
            if not row or not row[0]:
                continue
            dni = str(row[0]).strip()
            codigo = str(row[1]).strip() if row[1] else ""

            # Buscar estudiante por código o DNI
            est = None
            if codigo:
                est = Estudiante.objects.filter(codigo_matricula=codigo).first()
            if not est and dni:
                est = Estudiante.objects.filter(usuario__dni=dni).first()
            if not est:
                errores.append(f"No encontrado: DNI={dni} Código={codigo}")
                continue

            # Leer NL por competencia
            for comp in range(1, num_comp + 1):
                col_nl = 3 + (comp - 1) * 2  # Columna del NL de esta competencia
                nl = str(row[col_nl]).strip().upper() if col_nl < len(row) and row[col_nl] else ""
                if nl not in ("AD", "A", "B", "C"):
                    continue

                col_conc = col_nl + 1
                conclusion = str(row[col_conc]).strip() if col_conc < len(row) and row[col_conc] else ""

                # Crear/actualizar para todos los bimestres disponibles
                # Al importar histórico, solo creamos B4 (nota final del año)
                nota, created = NotaBimestre.objects.update_or_create(
                    estudiante=est,
                    anio_lectivo=anio,
                    area=area,
                    bimestre="4",
                    competencia=comp,
                    defaults={
                        "calificacion": nl,
                        "conclusion_descriptiva": conclusion,
                    },
                )
                if created:
                    creadas += 1
                else:
                    actualizadas += 1

    return Response({
        "ok": True,
        "anio": anio,
        "hojas_procesadas": len(wb.sheetnames),
        "creadas": creadas,
        "actualizadas": actualizadas,
        "errores": errores[:20],  # máximo 20 errores
        "mensaje": f"Importación año {anio}: {creadas} notas creadas, {actualizadas} actualizadas.",
    })


# ── Horario semanal ─────────────────────────────────────────────────────────

class HorarioSerializer(drf_s.ModelSerializer):
    area = drf_s.CharField(source="asignacion.area", read_only=True)
    seccion_id = drf_s.IntegerField(source="asignacion.seccion_id", read_only=True)
    seccion_nombre = drf_s.SerializerMethodField(read_only=True)
    seccion_grado = drf_s.CharField(source="asignacion.seccion.grado", read_only=True)
    seccion_nivel = drf_s.CharField(source="asignacion.seccion.nivel", read_only=True)
    docente_nombre = drf_s.SerializerMethodField(read_only=True)

    class Meta:
        model = HorarioClase
        fields = [
            "id", "asignacion", "area", "seccion_id", "seccion_nombre",
            "seccion_grado", "seccion_nivel",
            "docente_nombre", "dia_semana", "hora_inicio", "hora_fin", "aula",
        ]
        read_only_fields = ["id", "area", "seccion_id", "seccion_nombre", "seccion_grado", "seccion_nivel", "docente_nombre"]

    def get_seccion_nombre(self, obj):
        return str(obj.asignacion.seccion)

    def get_docente_nombre(self, obj):
        return obj.asignacion.docente.get_full_name() or obj.asignacion.docente.username

    def validate_asignacion(self, value):
        user = self.context["request"].user
        if _es_docente_activo(user) and value.docente_id != user.pk:
            raise drf_s.ValidationError("No puedes crear horarios para asignaciones de otro docente.")
        return value

    def validate(self, attrs):
        asignacion = attrs.get("asignacion") or (self.instance.asignacion if self.instance else None)
        dia = attrs.get("dia_semana") or (self.instance.dia_semana if self.instance else None)
        hora_inicio = attrs.get("hora_inicio") or (self.instance.hora_inicio if self.instance else None)
        hora_fin = attrs.get("hora_fin") or (self.instance.hora_fin if self.instance else None)

        if hora_inicio and hora_fin and hora_inicio >= hora_fin:
            raise drf_s.ValidationError("La hora de fin debe ser posterior a la hora de inicio.")

        if asignacion and dia and hora_inicio and hora_fin:
            seccion_id = asignacion.seccion_id
            qs = HorarioClase.objects.filter(
                asignacion__seccion_id=seccion_id,
                dia_semana=dia,
                hora_inicio__lt=hora_fin,
                hora_fin__gt=hora_inicio,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                conflicto = qs.first()
                raise drf_s.ValidationError(
                    f"Solapamiento con '{conflicto.asignacion.area}' "
                    f"({conflicto.hora_inicio.strftime('%H:%M')}–{conflicto.hora_fin.strftime('%H:%M')}) "
                    f"en la misma sección."
                )

            docente_id = asignacion.docente_id
            qs2 = HorarioClase.objects.filter(
                asignacion__docente_id=docente_id,
                dia_semana=dia,
                hora_inicio__lt=hora_fin,
                hora_fin__gt=hora_inicio,
            )
            if self.instance:
                qs2 = qs2.exclude(pk=self.instance.pk)
            if qs2.exists():
                conflicto2 = qs2.first()
                raise drf_s.ValidationError(
                    f"El docente ya tiene '{conflicto2.asignacion.area}' en {conflicto2.asignacion.seccion} "
                    f"({conflicto2.hora_inicio.strftime('%H:%M')}–{conflicto2.hora_fin.strftime('%H:%M')}) ese día."
                )

        return attrs


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def horario_list_create(request):
    user = request.user

    if request.method == "GET":
        qs = HorarioClase.objects.select_related(
            "asignacion__docente", "asignacion__seccion"
        )
        seccion_param = request.GET.get("seccion_id")

        if _es_docente_activo(user):
            qs = qs.filter(asignacion__docente=user)
            if seccion_param:
                qs = qs.filter(asignacion__seccion_id=seccion_param)
        elif user.rol == "estudiante":
            try:
                seccion_id = user.estudiante_profile.seccion_id
            except Exception:
                return Response([])
            qs = qs.filter(asignacion__seccion_id=seccion_id)
        elif user.rol == "padre":
            try:
                hijo = user.padre_profile.hijos.select_related("seccion").first()
                if not hijo:
                    return Response([])
                seccion_id = hijo.seccion_id
            except Exception:
                return Response([])
            hijo_id = request.GET.get("hijo_id")
            if hijo_id:
                try:
                    hijo = user.padre_profile.hijos.select_related("seccion").get(pk=hijo_id)
                    seccion_id = hijo.seccion_id
                except Exception:
                    return Response([])
            qs = qs.filter(asignacion__seccion_id=seccion_id)
        else:
            # director / admin ven todo; pueden filtrar por sección
            if seccion_param:
                qs = qs.filter(asignacion__seccion_id=seccion_param)

        return Response(HorarioSerializer(qs.order_by("dia_semana", "hora_inicio"), many=True).data)

    # POST — solo docente / director / subdirector
    if user.rol not in ("docente", "director", "subdirector"):
        raise PermissionDenied()
    serializer = HorarioSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def horario_detail(request, pk):
    try:
        horario = HorarioClase.objects.select_related(
            "asignacion__docente", "asignacion__seccion"
        ).get(pk=pk)
    except HorarioClase.DoesNotExist:
        return Response({"detail": "No encontrado."}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    es_docente_duenio = _es_docente_activo(user) and horario.asignacion.docente_id == user.pk
    es_director = user.rol in ("director", "subdirector")
    if not (es_docente_duenio or es_director):
        raise PermissionDenied()

    if request.method == "DELETE":
        horario.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = HorarioSerializer(horario, data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def alertas_riesgo(request):
    """Estudiantes en riesgo: C en algún área y/o 3+ faltas este mes.
    Docente: solo sus secciones. Director/subdirector: toda la IE (filtrable por seccion_id)."""
    from django.utils import timezone
    from django.db.models import Count

    rol = request.user.rol
    if rol not in ("director", "subdirector", "docente", "auxiliar", "psicologa"):
        raise PermissionDenied()

    from apps.asistencia.models import RegistroAsistencia

    anio = request.GET.get("anio") or timezone.now().year
    seccion_id = request.GET.get("seccion_id")
    umbral_faltas = int(request.GET.get("umbral_faltas", 3))
    hoy = timezone.localdate()
    inicio_mes = hoy.replace(day=1)

    # Determinar secciones visibles
    if rol == "docente":
        secciones_ids = list(
            AsignacionDocente.objects.filter(docente=request.user, anio_lectivo=anio)
            .values_list("seccion_id", flat=True).distinct()
        )
    else:
        secciones_ids = list(Seccion.objects.values_list("id", flat=True))

    if seccion_id:
        secciones_ids = [int(seccion_id)] if int(seccion_id) in secciones_ids else []

    # Estudiantes en esas secciones
    estudiantes = (
        Estudiante.objects
        .filter(seccion_obj_id__in=secciones_ids, situacion_matricula="matriculado")
        .select_related("usuario", "seccion_obj")
    )

    # Notas en C por estudiante
    notas_c = (
        NotaBimestre.objects
        .filter(estudiante__in=estudiantes, calificacion="C", anio_lectivo=anio)
        .order_by()
        .values("estudiante_id", "area")
        .distinct()
    )
    areas_c_por_est: dict = {}
    for n in notas_c:
        areas_c_por_est.setdefault(n["estudiante_id"], []).append(n["area"])

    # Faltas del mes por estudiante
    faltas_mes = (
        RegistroAsistencia.objects
        .filter(estudiante__in=estudiantes, fecha__gte=inicio_mes, estado="ausente")
        .values("estudiante_id")
        .annotate(total=Count("id"))
    )
    faltas_por_est = {r["estudiante_id"]: r["total"] for r in faltas_mes}

    resultados = []
    for e in estudiantes:
        areas_c = areas_c_por_est.get(e.id, [])
        faltas = faltas_por_est.get(e.id, 0)
        tiene_riesgo_notas = bool(areas_c)
        tiene_riesgo_asistencia = faltas >= umbral_faltas

        if not (tiene_riesgo_notas or tiene_riesgo_asistencia):
            continue

        nivel = "alto" if (tiene_riesgo_notas and tiene_riesgo_asistencia) else "medio"
        resultados.append({
            "id": e.id,
            "nombre": f"{e.usuario.last_name}, {e.usuario.first_name}".strip(", "),
            "seccion": str(e.seccion_obj) if e.seccion_obj else "—",
            "seccion_id": e.seccion_obj_id,
            "areas_c": areas_c,
            "faltas_mes": faltas,
            "nivel_riesgo": nivel,
        })

    # Ordenar: alto primero, luego por faltas desc
    resultados.sort(key=lambda x: (0 if x["nivel_riesgo"] == "alto" else 1, -x["faltas_mes"]))
    return Response(resultados)
