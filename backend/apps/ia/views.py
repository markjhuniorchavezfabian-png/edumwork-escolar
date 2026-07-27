from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.permissions import EsDirector, EsDirectorOAdminTIC
from .models import LLMConfig, LLMUsage
from .serializers import (
    LLMConfigSerializer,
    LLMUsageSerializer,
    catalogo_proveedores,
)
from .client import get_client


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalogo(request):
    """Devuelve el catálogo de proveedores soportados."""
    return Response(catalogo_proveedores())


@api_view(["GET", "POST", "PUT", "DELETE"])
@permission_classes([EsDirector])
def config(request):
    """CRUD de la configuración global de IA (singleton)."""
    cfg = LLMConfig.objects.filter(usuario=None).first()  # incluye inactivas para que director pueda reactivar

    if request.method == "GET":
        if not cfg:
            return Response({"configurado": False})
        data = LLMConfigSerializer(cfg).data
        data["configurado"] = True
        return Response(data)

    if request.method == "POST":
        ser = LLMConfigSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cfg = ser.save(usuario=None)  # explícito: institucional
        return Response(LLMConfigSerializer(cfg).data, status=status.HTTP_201_CREATED)

    if request.method == "PUT":
        # Buscar la config institucional incluso si está inactiva (para poder reactivarla)
        cfg_put = cfg or LLMConfig.objects.filter(usuario=None).first()
        if not cfg_put:
            return Response({"error": "No hay configuración previa"}, status=404)
        ser = LLMConfigSerializer(cfg_put, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        cfg = ser.save()
        return Response(LLMConfigSerializer(cfg).data)

    if request.method == "DELETE":
        # Buscar incluso si está inactiva para poder eliminarla
        cfg = cfg or LLMConfig.objects.filter(usuario=None).first()
        if cfg:
            cfg.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def probar(request):
    """Prueba la IA usando la config del usuario (BYOK) o la institucional como fallback."""
    cli = get_client(endpoint="probar", usuario=request.user)
    if not cli:
        return Response({"ok": False, "error": "No hay configuración de IA activa"}, status=400)

    cfg = cli.config
    try:
        respuesta = cli.completar(
            prompt="Responde solo con la palabra 'OK'.",
            max_tokens=10,
            timeout=15,
        )
        cfg.ultima_prueba_ok = True
        cfg.ultima_prueba_en = timezone.now()
        cfg.save(update_fields=["ultima_prueba_ok", "ultima_prueba_en"])
        return Response({
            "ok": True,
            "respuesta": respuesta.strip(),
            "config_usada": "propia" if cli.con_config_propia else "institucional",
        })
    except Exception as e:  # noqa: BLE001
        cfg.ultima_prueba_ok = False
        cfg.ultima_prueba_en = timezone.now()
        cfg.save(update_fields=["ultima_prueba_ok", "ultima_prueba_en"])
        return Response({"ok": False, "error": str(e)[:400]}, status=400)


@api_view(["GET", "POST", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def mi_config(request):
    """Config personal (BYOK) del usuario autenticado.
    Cada docente/personal puede configurar su propia API key para no cargar
    a la institución. La institucional (usuario=NULL) se usa como fallback."""
    # Solo staff (no padres/estudiantes) puede tener BYOK
    if request.user.rol not in (
        "director", "subdirector", "docente", "admin_tic",
        "secretaria", "auxiliar", "psicologa"
    ):
        return Response({"error": "Este rol no puede configurar IA propia."}, status=403)

    cfg = LLMConfig.objects.filter(usuario=request.user, activo=True).first()

    if request.method == "GET":
        institucional = LLMConfig.get_activa()
        if not cfg:
            return Response({
                "configurado": False,
                "tiene_institucional": institucional is not None,
                "fallback_institucional_provider": institucional.provider if institucional else None,
            })
        data = LLMConfigSerializer(cfg).data
        data["configurado"] = True
        data["tiene_institucional"] = institucional is not None
        return Response(data)

    if request.method in ("POST", "PUT"):
        if cfg and request.method == "POST":
            return Response({"error": "Ya tienes una configuración. Usa PUT para editar."}, status=400)
        if not cfg and request.method == "PUT":
            return Response({"error": "No hay configuración previa"}, status=404)

        ser = LLMConfigSerializer(cfg, data=request.data, partial=(request.method == "PUT"))
        ser.is_valid(raise_exception=True)
        cfg = ser.save(usuario=request.user)
        return Response(LLMConfigSerializer(cfg).data)

    if request.method == "DELETE":
        if cfg:
            cfg.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([EsDirectorOAdminTIC])
def uso(request):
    """Últimos N registros de uso."""
    limite = int(request.GET.get("limite", 50))
    qs = LLMUsage.objects.order_by("-creado_en")[:limite]
    return Response(LLMUsageSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([EsDirectorOAdminTIC])
def costos(request):
    """KPIs de gasto en IA. Director/admin_tic pueden verlo.
    Devuelve totales del mes, del día, últimos 30 días por día, y top endpoints."""
    from datetime import timedelta
    from django.db.models import Count, Sum
    from django.utils import timezone

    ahora = timezone.now()
    inicio_mes = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    inicio_dia = ahora.replace(hour=0, minute=0, second=0, microsecond=0)
    hace_30 = ahora - timedelta(days=30)

    def agg(qs):
        r = qs.aggregate(
            requests=Count("id"),
            tokens_in=Sum("tokens_in"),
            tokens_out=Sum("tokens_out"),
            costo=Sum("costo_usd"),
        )
        return {
            "requests": r["requests"] or 0,
            "tokens_in": r["tokens_in"] or 0,
            "tokens_out": r["tokens_out"] or 0,
            "costo_usd": float(r["costo"] or 0),
        }

    # Director/admin_tic: ven todos los costos. Otros roles: solo los suyos.
    es_admin = request.user.rol in ("director", "subdirector", "admin_tic")
    base_qs = LLMUsage.objects.all() if es_admin else LLMUsage.objects.filter(usuario=request.user)

    hoy = agg(base_qs.filter(creado_en__gte=inicio_dia))
    mes = agg(base_qs.filter(creado_en__gte=inicio_mes))
    total = agg(base_qs)

    # Serie por día (últimos 30 días)
    serie = []
    for i in range(29, -1, -1):
        dia_inicio = (ahora - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        dia_fin = dia_inicio + timedelta(days=1)
        r = base_qs.filter(creado_en__gte=dia_inicio, creado_en__lt=dia_fin).aggregate(
            c=Count("id"), t=Sum("costo_usd")
        )
        serie.append({
            "fecha": dia_inicio.date().isoformat(),
            "requests": r["c"] or 0,
            "costo_usd": float(r["t"] or 0),
        })

    # Top endpoints últimos 30 días
    top_endpoints = list(
        base_qs.filter(creado_en__gte=hace_30)
        .values("endpoint")
        .annotate(requests=Count("id"), costo=Sum("costo_usd"))
        .order_by("-requests")[:10]
    )
    top_endpoints = [
        {"endpoint": r["endpoint"], "requests": r["requests"], "costo_usd": float(r["costo"] or 0)}
        for r in top_endpoints
    ]

    # Errores últimos 30 días
    errores_30 = base_qs.filter(creado_en__gte=hace_30, ok=False).count()
    total_30 = base_qs.filter(creado_en__gte=hace_30).count()
    tasa_error = round(errores_30 / total_30 * 100, 1) if total_30 else 0.0

    # Reparto de gasto: propia (BYOK) vs institucional (30d)
    reparto_qs = base_qs.filter(creado_en__gte=hace_30).values("con_config_propia").annotate(
        requests=Count("id"), costo=Sum("costo_usd")
    )
    reparto_byok = {"propia": {"requests": 0, "costo_usd": 0.0},
                    "institucional": {"requests": 0, "costo_usd": 0.0}}
    for r in reparto_qs:
        k = "propia" if r["con_config_propia"] else "institucional"
        reparto_byok[k] = {"requests": r["requests"], "costo_usd": float(r["costo"] or 0)}

    # Top usuarios por gasto institucional (30d) — solo para admins
    top_usuarios = []
    if es_admin:
        top_usuarios_qs = list(
            LLMUsage.objects.filter(creado_en__gte=hace_30, con_config_propia=False, usuario__isnull=False)
            .values("usuario__username", "usuario__first_name", "usuario__last_name")
            .annotate(requests=Count("id"), costo=Sum("costo_usd"))
            .order_by("-costo")[:5]
        )
        top_usuarios = [{
            "username": u["usuario__username"],
            "nombre": f"{u['usuario__first_name']} {u['usuario__last_name']}".strip() or u["usuario__username"],
            "requests": u["requests"],
            "costo_usd": float(u["costo"] or 0),
        } for u in top_usuarios_qs]

    return Response({
        "hoy": hoy,
        "mes": mes,
        "total_historico": total,
        "serie_30d": serie,
        "top_endpoints_30d": top_endpoints,
        "errores_30d": errores_30,
        "tasa_error_30d": tasa_error,
        "reparto_byok_30d": reparto_byok,
        "top_usuarios_institucional_30d": top_usuarios,
    })


# ── Asistente IA por rol ──────────────────────────────────────────────────────
_REGLAS_COMUNES = (
    " Responde SOLO lo que se te pregunta. "
    "Sin saludos, sin presentarte, sin listar temas sugeridos. "
    "Directo al punto."
)

SISTEMA_POR_ROL = {
    "director": (
        "Eres un asistente de gestión escolar para el director de {nombre_ie}. "
        "Ayudás con análisis institucional, normativa MINEDU, toma de decisiones, "
        "gestión de personal y planificación estratégica. "
        "Respuestas concisas y formales en español peruano." + _REGLAS_COMUNES
    ),
    "subdirector": (
        "Eres un asistente de gestión escolar para el subdirector de {nombre_ie}. "
        "Ayudás con supervisión pedagógica, coordinación docente y normativa MINEDU. "
        "Respuestas concisas en español peruano." + _REGLAS_COMUNES
    ),
    "docente": (
        "Eres un asistente pedagógico para el docente de {nombre_ie}. "
        "Ayudás con estrategias de enseñanza, planificación curricular por competencias (CNEB), "
        "evaluación formativa, retroalimentación y recursos didácticos. "
        "Solo tenés acceso a datos de tus propias secciones y asignaciones. "
        "Si el docente pregunta por datos institucionales globales (total de alumnos de la IE, estadísticas generales, etc.), "
        "indicá que esa información la maneja la dirección y que puede consultarla con el director o el administrador TIC. "
        "No menciones sistemas externos como SIAGIE. "
        "Respuestas prácticas en español peruano." + _REGLAS_COMUNES
    ),
    "admin_tic": (
        "Eres un asistente de soporte TIC para {nombre_ie}. "
        "Ayudás con diagnóstico de problemas técnicos, mantenimiento de equipos, "
        "seguridad informática y gestión de inventario tecnológico. "
        "Respuestas técnicas pero claras en español." + _REGLAS_COMUNES
    ),
    "padre": (
        "Eres un asistente para el padre de familia de {nombre_ie}. "
        "Respondés preguntas sobre el progreso académico de sus hijos, "
        "justificaciones de inasistencias, trámites escolares y comunicación con docentes. "
        "Respuestas amables y simples en español peruano." + _REGLAS_COMUNES
    ),
    "estudiante": (
        "Eres un tutor educativo para el estudiante de {nombre_ie}. "
        "Ayudás con dudas académicas de las materias del currículo peruano, "
        "técnicas de estudio, organización del tiempo y motivación. "
        "Respuestas claras y alentadoras." + _REGLAS_COMUNES
    ),
}

_FALLBACK_SISTEMA = (
    "Eres un asistente escolar para {nombre_ie}. "
    "Respondés preguntas relacionadas con la institución educativa. "
    "Respuestas concisas en español peruano." + _REGLAS_COMUNES
)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat_asistente(request):
    """Chat multi-turno del asistente IA por rol con datos reales del colegio en contexto.
    Body: { historial: [{role, content}, ...], mensaje: str }"""
    from apps.core.models import ConfiguracionInstitucional

    cfg = ConfiguracionInstitucional.get_solo()
    nombre_ie = cfg.nombre_institucion or "la Institución Educativa"
    anio = cfg.anio_lectivo_activo or 2026

    config_ia = LLMConfig.get_para(request.user)
    if not config_ia or not config_ia.activo:
        return Response({"sin_config": True}, status=200)

    historial = request.data.get("historial", [])
    mensaje_nuevo = (request.data.get("mensaje") or "").strip()
    if not mensaje_nuevo:
        return Response({"error": "Mensaje vacío."}, status=400)

    rol = getattr(request.user, "rol", "docente")
    sistema_template = SISTEMA_POR_ROL.get(rol, _FALLBACK_SISTEMA)
    sistema_base = sistema_template.format(nombre_ie=nombre_ie)

    # ── Enriquecer con datos reales del colegio ───────────────────────────────
    datos_contexto = _contexto_datos_reales(request.user, nombre_ie, anio)
    sistema = sistema_base + datos_contexto

    # Construir lista de mensajes: system + historial + nuevo mensaje del usuario
    mensajes = [{"role": "system", "content": sistema}]
    for m in historial[-10:]:
        if m.get("role") in ("user", "assistant") and m.get("content"):
            mensajes.append({"role": m["role"], "content": m["content"]})
    mensajes.append({"role": "user", "content": mensaje_nuevo})

    from .client import LLMClient
    cli = LLMClient(config_ia, endpoint="asistente", usuario=request.user)
    try:
        respuesta = cli.completar_chat(mensajes, max_tokens=700, timeout=45)
        return Response({"respuesta": respuesta})
    except Exception as e:
        return Response({"error": str(e)[:300]}, status=500)


def _contexto_datos_reales(user, nombre_ie: str, anio: int) -> str:
    """Construye un bloque de contexto con datos reales del colegio para el asistente."""
    from django.utils import timezone
    from datetime import timedelta
    ctx = f"\n\n[DATOS REALES DE {nombre_ie.upper()} — Año {anio}]\n"

    try:
        hoy = timezone.localdate()
        inicio_mes = hoy.replace(day=1)

        if user.rol in ("director", "subdirector", "admin_tic"):
            # Incidencias recientes
            from apps.incidencias.models import Incidencia
            hace_30 = timezone.now() - timedelta(days=30)
            total_inc = Incidencia.objects.filter(creado_en__gte=hace_30).count()
            abiertas = Incidencia.objects.filter(estado="nueva").count()
            ctx += f"- Incidencias TI (últimos 30 días): {total_inc} total, {abiertas} pendientes\n"

            # Asistencia del día
            from apps.asistencia.models import RegistroAsistencia
            hoy_presentes = RegistroAsistencia.objects.filter(fecha=hoy, estado="presente").count()
            hoy_ausentes = RegistroAsistencia.objects.filter(fecha=hoy, estado="ausente").count()
            ctx += f"- Asistencia hoy ({hoy}): {hoy_presentes} presentes, {hoy_ausentes} ausentes\n"

            # D3: Top 5 estudiantes con más faltas en lo que va del mes (toda la IE)
            from django.db.models import Count
            from apps.asistencia.models import RegistroAsistencia
            top_faltas = (
                RegistroAsistencia.objects
                .filter(fecha__gte=inicio_mes, estado="ausente")
                .values("estudiante__usuario__first_name", "estudiante__usuario__last_name", "estudiante__seccion_obj__nombre")
                .annotate(faltas=Count("id"))
                .order_by("-faltas")[:5]
            )
            if top_faltas:
                ctx += f"- Top estudiantes con más faltas (desde {inicio_mes}):\n"
                for r in top_faltas:
                    nombre = f"{r['estudiante__usuario__first_name']} {r['estudiante__usuario__last_name']}".strip()
                    seccion = r["estudiante__seccion_obj__nombre"] or "—"
                    ctx += f"  · {nombre} ({seccion}): {r['faltas']} falta(s)\n"

            # D4: Notas por sección (distribución)
            from apps.notas.models import NotaBimestre
            from apps.usuarios.models import Seccion
            notas_anio = NotaBimestre.objects.filter(anio_lectivo=anio)
            total_notas = notas_anio.count()
            dist_global = {nl: notas_anio.filter(calificacion=nl).count() for nl in ("AD", "A", "B", "C")}
            ctx += f"- Notas año {anio}: {total_notas} registros · AD:{dist_global['AD']} A:{dist_global['A']} B:{dist_global['B']} C:{dist_global['C']}\n"

            secciones = Seccion.objects.all().order_by("grado", "letra")[:10]
            if secciones:
                ctx += "- Notas por sección:\n"
                for sec in secciones:
                    ns = notas_anio.filter(estudiante__seccion_obj=sec)
                    if ns.exists():
                        d = {nl: ns.filter(calificacion=nl).count() for nl in ("AD", "A", "B", "C")}
                        ctx += f"  · {sec.nombre}: AD:{d['AD']} A:{d['A']} B:{d['B']} C:{d['C']}\n"

            # Estudiantes
            from apps.usuarios.models import Estudiante
            total_est = Estudiante.objects.filter(situacion_matricula="matriculado").count()
            ctx += f"- Estudiantes matriculados: {total_est}\n"

        elif user.rol == "docente":
            from apps.notas.models import AsignacionDocente, NotaBimestre
            from apps.asistencia.models import RegistroAsistencia
            from django.db.models import Count

            asigs = AsignacionDocente.objects.filter(docente=user, anio_lectivo=anio).select_related("seccion")
            if asigs.exists():
                secs_str = ", ".join(f"{a.seccion.nombre} ({a.area})" for a in asigs[:6])
                ctx += f"- Tus asignaciones {anio}: {secs_str}\n"

                for asig in asigs:
                    seccion = asig.seccion
                    area = asig.area

                    # D1: Notas individuales por estudiante y competencia de esta asignación
                    notas_asig = (
                        NotaBimestre.objects
                        .filter(estudiante__seccion_obj=seccion, area=area, anio_lectivo=anio)
                        .select_related("estudiante__usuario")
                        .order_by("estudiante__usuario__last_name", "bimestre", "competencia")
                    )
                    if notas_asig.exists():
                        ctx += f"\nNotas {seccion.nombre} — {area}:\n"
                        # Agrupar por estudiante
                        est_notas: dict = {}
                        for n in notas_asig:
                            nombre = f"{n.estudiante.usuario.last_name}, {n.estudiante.usuario.first_name}".strip(", ")
                            key = (n.estudiante_id, nombre)
                            est_notas.setdefault(key, []).append(n)
                        for (_, nombre), notas_est in est_notas.items():
                            partes = [f"B{n.bimestre}C{n.competencia}:{n.calificacion or '—'}" for n in notas_est]
                            ctx += f"  {nombre}: {' '.join(partes)}\n"

                    # D2: Asistencia mensual por estudiante de esta sección
                    from apps.usuarios.models import Estudiante as Est
                    estudiantes_sec = Est.objects.filter(
                        seccion_obj=seccion, situacion_matricula="matriculado"
                    ).select_related("usuario").order_by("usuario__last_name")

                    faltas_mes = (
                        RegistroAsistencia.objects
                        .filter(estudiante__seccion_obj=seccion, fecha__gte=inicio_mes, estado="ausente")
                        .values("estudiante_id")
                        .annotate(faltas=Count("id"))
                    )
                    faltas_map = {r["estudiante_id"]: r["faltas"] for r in faltas_mes}

                    con_faltas = [(e, faltas_map.get(e.id, 0)) for e in estudiantes_sec if faltas_map.get(e.id, 0) > 0]
                    if con_faltas:
                        ctx += f"\nAsistencia {seccion.nombre} (faltas desde {inicio_mes}):\n"
                        for e, f in sorted(con_faltas, key=lambda x: -x[1]):
                            nombre = f"{e.usuario.last_name}, {e.usuario.first_name}".strip(", ")
                            ctx += f"  {nombre}: {f} falta(s)\n"

        ctx += f"\n- Fecha actual: {hoy}\n"
        ctx += "[FIN DE DATOS]\nUsá estos datos para responder preguntas específicas del usuario.\n"
    except Exception:
        ctx += "[No se pudieron obtener datos en tiempo real]\n"

    return ctx


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resumen_semanal(request):
    """F1: Resumen semanal institucional para director/subdirector."""
    from datetime import timedelta
    from django.utils import timezone
    from django.db.models import Count

    if request.user.rol not in ("director", "subdirector"):
        raise PermissionDenied()

    config_ia = LLMConfig.get_para(request.user)
    if not config_ia or not config_ia.activo:
        return Response({"sin_config": True}, status=200)

    anio = request.data.get("anio") or timezone.now().year
    hoy = timezone.localdate()
    inicio_semana = hoy - timedelta(days=hoy.weekday())
    fin_semana = inicio_semana + timedelta(days=6)
    inicio_mes = hoy.replace(day=1)
    hace_7 = timezone.now() - timedelta(days=7)

    from apps.asistencia.models import RegistroAsistencia
    from apps.incidencias.models import Incidencia
    from apps.notas.models import NotaBimestre
    from apps.usuarios.models import Estudiante, Seccion

    # Asistencia
    presentes_hoy = RegistroAsistencia.objects.filter(fecha=hoy, estado="presente").count()
    ausentes_hoy = RegistroAsistencia.objects.filter(fecha=hoy, estado="ausente").count()
    ausencias_semana = RegistroAsistencia.objects.filter(fecha__gte=inicio_semana, fecha__lte=fin_semana, estado="ausente").count()
    top_faltas_qs = (
        RegistroAsistencia.objects.filter(fecha__gte=inicio_mes, estado="ausente")
        .values("estudiante__usuario__first_name", "estudiante__usuario__last_name", "estudiante__seccion_obj__nombre")
        .annotate(f=Count("id")).order_by("-f")[:5]
    )
    top_faltas = [f"{r['estudiante__usuario__last_name']} {r['estudiante__usuario__first_name']} ({r['estudiante__seccion_obj__nombre']}): {r['f']}" for r in top_faltas_qs]

    # Incidencias
    inc_qs = Incidencia.objects.filter(creado_en__gte=hace_7)
    inc_total = inc_qs.count()
    inc_pendientes = Incidencia.objects.filter(estado="nueva").count()
    inc_por_tipo = dict(inc_qs.values_list("tipo").annotate(c=Count("id")))

    # Notas
    notas = NotaBimestre.objects.filter(anio_lectivo=anio)
    notas_total = notas.count()
    notas_ad = notas.filter(calificacion="AD").count()
    notas_a = notas.filter(calificacion="A").count()
    notas_b = notas.filter(calificacion="B").count()
    notas_c = notas.filter(calificacion="C").count()
    secciones = Seccion.objects.all().order_by("grado", "letra")[:8]
    notas_por_seccion = []
    for s in secciones:
        ns = notas.filter(estudiante__seccion_obj=s)
        if ns.exists():
            d = {nl: ns.filter(calificacion=nl).count() for nl in ("AD","A","B","C")}
            notas_por_seccion.append(f"{s.nombre}: AD:{d['AD']} A:{d['A']} B:{d['B']} C:{d['C']}")

    # Alertas riesgo
    estudiantes = Estudiante.objects.filter(situacion_matricula="matriculado")
    est_con_c = notas.filter(calificacion="C").values("estudiante_id").distinct().count()
    faltas_mes_qs = (
        RegistroAsistencia.objects.filter(fecha__gte=inicio_mes, estado="ausente")
        .values("estudiante_id").annotate(f=Count("id")).filter(f__gte=3)
    )
    est_con_faltas = faltas_mes_qs.count()
    ids_c = set(notas.filter(calificacion="C").values_list("estudiante_id", flat=True))
    ids_faltas = set(faltas_mes_qs.values_list("estudiante_id", flat=True))
    est_riesgo_alto = len(ids_c & ids_faltas)

    datos = {
        "fecha_inicio": str(inicio_semana), "fecha_fin": str(fin_semana), "anio": anio,
        "presentes_hoy": presentes_hoy, "ausentes_hoy": ausentes_hoy,
        "ausencias_semana": ausencias_semana, "top_faltas": top_faltas,
        "inc_total": inc_total, "inc_pendientes": inc_pendientes, "inc_por_tipo": inc_por_tipo,
        "notas_total": notas_total, "notas_ad": notas_ad, "notas_a": notas_a,
        "notas_b": notas_b, "notas_c": notas_c, "notas_por_seccion": notas_por_seccion,
        "est_con_c": est_con_c, "est_con_faltas": est_con_faltas, "est_riesgo_alto": est_riesgo_alto,
    }

    from .servicios import generar_resumen_semanal
    resultado = generar_resumen_semanal(datos, usuario=request.user)
    if not resultado:
        return Response({"error": "No se pudo generar el resumen."}, status=500)
    return Response({"resumen": resultado, "datos": datos})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reporte_riesgo_ia(request):
    """F2: Reporte narrativo de estudiantes en riesgo para docente/director."""
    from django.utils import timezone
    from django.db.models import Count

    if request.user.rol not in ("director", "subdirector", "docente", "psicologa", "auxiliar"):
        raise PermissionDenied()

    config_ia = LLMConfig.get_para(request.user)
    if not config_ia or not config_ia.activo:
        return Response({"sin_config": True}, status=200)

    estudiantes_riesgo = request.data.get("estudiantes", [])
    seccion_nombre = request.data.get("seccion_nombre", "la sección")

    from .servicios import generar_reporte_riesgo
    resultado = generar_reporte_riesgo(seccion_nombre, estudiantes_riesgo, usuario=request.user)
    if not resultado:
        return Response({"error": "No se pudo generar el reporte."}, status=500)
    return Response({"reporte": resultado})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cierre_bimestre_ia(request):
    """F3: Resumen de cierre de bimestre con análisis y plan de acción."""
    if request.user.rol not in ("director", "subdirector", "docente", "secretaria"):
        raise PermissionDenied()

    config_ia = LLMConfig.get_para(request.user)
    if not config_ia or not config_ia.activo:
        return Response({"sin_config": True}, status=200)

    seccion_id = request.data.get("seccion_id")
    bimestre = request.data.get("bimestre")
    anio = request.data.get("anio") or __import__("django.utils.timezone", fromlist=["timezone"]).now().year

    if not seccion_id or not bimestre:
        return Response({"error": "seccion_id y bimestre son obligatorios."}, status=400)

    from apps.notas.models import NotaBimestre
    from apps.usuarios.models import Seccion, Estudiante

    try:
        seccion = Seccion.objects.get(pk=seccion_id)
    except Seccion.DoesNotExist:
        return Response({"error": "Sección no encontrada."}, status=404)

    total_est = Estudiante.objects.filter(seccion_obj=seccion, situacion_matricula="matriculado").count()

    def _areas(bim):
        notas = NotaBimestre.objects.filter(estudiante__seccion_obj=seccion, bimestre=bim, anio_lectivo=anio)
        areas_dict: dict = {}
        for n in notas:
            areas_dict.setdefault(n.area, {"AD": 0, "A": 0, "B": 0, "C": 0})
            if n.calificacion in areas_dict[n.area]:
                areas_dict[n.area][n.calificacion] += 1
        return [{"area": k, "distribucion": v} for k, v in areas_dict.items()]

    areas_actuales = _areas(str(bimestre))
    bimestre_anterior = None
    if int(bimestre) > 1:
        bim_ant = str(int(bimestre) - 1)
        areas_ant = _areas(bim_ant)
        if areas_ant:
            bimestre_anterior = {"bimestre": bim_ant, "areas": areas_ant}

    datos = {
        "seccion_nombre": str(seccion),
        "bimestre": bimestre,
        "anio": anio,
        "total_estudiantes": total_est,
        "areas": areas_actuales,
        "bimestre_anterior": bimestre_anterior,
    }

    from .servicios import generar_cierre_bimestre
    resultado = generar_cierre_bimestre(datos, usuario=request.user)
    if not resultado:
        return Response({"error": "No se pudo generar el cierre."}, status=500)
    return Response({"cierre": resultado})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sugerir_temas(request):
    """Sugiere 4 temas para una sesión de aprendizaje.
    Body: { area, grado, competencia, capacidad }"""
    if request.user.rol not in ("director", "subdirector", "docente", "admin_tic"):
        raise PermissionDenied()

    area = (request.data.get("area") or "").strip()
    grado = (request.data.get("grado") or "").strip()
    competencia = (request.data.get("competencia") or "").strip()
    capacidad = (request.data.get("capacidad") or "").strip()

    if not all([area, grado, competencia]):
        return Response({"error": "area, grado y competencia son obligatorios."}, status=400)

    config_ia = LLMConfig.get_para(request.user)
    if not config_ia or not config_ia.activo:
        return Response({"sin_config": True}, status=200)

    client = get_client(endpoint="sugerir-temas", usuario=request.user)
    if not client:
        return Response({"sin_config": True}, status=200)

    prompt = (
        f"Eres un experto en currículo CNEB peruano. "
        f"Sugiere exactamente 4 temas concretos para una sesión de aprendizaje de {area}, "
        f"{grado}, competencia '{competencia}'"
        + (f", capacidad '{capacidad}'" if capacidad else "") + ". "
        f"Responde SOLO con una lista JSON de 4 strings, sin explicación. "
        f'Ejemplo: ["Tema 1", "Tema 2", "Tema 3", "Tema 4"]'
    )
    try:
        respuesta = client.completar(prompt=prompt)
        import json, re
        match = re.search(r'\[.*?\]', respuesta, re.DOTALL)
        temas = json.loads(match.group()) if match else []
        temas = [t.strip() for t in temas if isinstance(t, str)][:4]
        return Response({"temas": temas})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def completar_campo(request):
    """Completa o mejora un campo individual de la sesión.
    Body: { prompt, campo }"""
    if request.user.rol not in ("director", "subdirector", "docente", "admin_tic"):
        raise PermissionDenied()
    prompt = (request.data.get("prompt") or "").strip()
    if not prompt:
        return Response({"error": "prompt requerido."}, status=400)
    config_ia = LLMConfig.get_para(request.user)
    if not config_ia or not config_ia.activo:
        return Response({"sin_config": True}, status=200)
    client = get_client(endpoint="completar-campo", usuario=request.user)
    if not client:
        return Response({"sin_config": True}, status=200)
    try:
        resultado = client.completar(prompt=prompt, max_tokens=600, timeout=45)
        return Response({"resultado": resultado})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generar_sesion(request):
    """Genera una sesión de aprendizaje completa con IA.
    Body: { area, grado, competencia, capacidad, tema, duracion_minutos }"""
    from .servicios import generar_sesion_aprendizaje

    if request.user.rol not in ("director", "subdirector", "docente", "admin_tic"):
        raise PermissionDenied()

    area = (request.data.get("area") or "").strip()
    grado = (request.data.get("grado") or "").strip()
    competencia = (request.data.get("competencia") or "").strip()
    capacidad = (request.data.get("capacidad") or "").strip()
    tema = (request.data.get("tema") or "").strip()
    duracion = int(request.data.get("duracion_minutos") or 90)

    if not all([area, grado, competencia, tema]):
        return Response({"error": "area, grado, competencia y tema son obligatorios."}, status=400)

    config_ia = LLMConfig.get_para(request.user)
    if not config_ia or not config_ia.activo:
        return Response({"sin_config": True}, status=200)

    sesion = generar_sesion_aprendizaje(
        area=area, grado=grado, competencia=competencia,
        capacidad=capacidad, tema=tema, duracion_minutos=duracion,
        usuario=request.user,
    )

    if not sesion:
        return Response({"error": "No se pudo generar la sesión."}, status=500)

    return Response({"campos": sesion})
