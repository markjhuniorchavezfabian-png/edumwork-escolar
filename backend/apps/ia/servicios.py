"""Servicios de negocio que usan el LLM. Centraliza los prompts.
Cada función devuelve un dict listo para consumir por las views."""
from typing import Optional

from .client import get_client


def _nombre_ie() -> str:
    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()
    return cfg.nombre_institucion or "la Institución Educativa"


# ── Servicio 1: Clasificación de incidencia desde texto libre ────────────────
_SISTEMA_CLASIFICAR = """Eres el asistente de mesa de ayuda TI de {nombre_ie}.
Un docente reporta un problema TIC en lenguaje natural, sin categorías.
Tu trabajo es extraer los campos estructurados que necesita el sistema.

Categorías de tipo (elige exactamente una):
- proyector, pc, red, pizarra, impresora, otro

Prioridad (elige exactamente una):
- alta (interrumpe una clase en curso o afecta a varios ambientes)
- media (afecta un ambiente pero no impide seguir dictando)
- baja (mejora menor, no interrumpe)

Ubicación: extrae el aula/ambiente tal como lo menciona el docente (ej: "Aula 5A", "AIP", "Sala de docentes", "Dirección"). Si no lo menciona, devuelve "Sin especificar".

Título: una frase corta y clara (máx 100 caracteres), como la escribiría un técnico.
Descripción: reescribe el problema en 1-2 oraciones claras, manteniendo detalles útiles.

Responde SIEMPRE en JSON con estas llaves exactas:
{"titulo": str, "descripcion": str, "ubicacion": str, "tipo": str, "prioridad": str}
"""


def clasificar_incidencia(texto: str, usuario=None) -> Optional[dict]:
    """Convierte texto libre del docente en campos estructurados.
    Devuelve None si no hay IA configurada."""
    cli = get_client(endpoint="clasificar_incidencia", usuario=usuario)
    if not cli:
        return None

    resultado = cli.completar_json(
        prompt=f"Reporte del docente:\n\n{texto.strip()}",
        sistema=_SISTEMA_CLASIFICAR.format(nombre_ie=_nombre_ie()),
        max_tokens=400,
        timeout=30,
    )

    # Sanitizar / defensivo: si el modelo devuelve algo raro, arreglar
    tipos_validos = ["proyector", "pc", "red", "pizarra", "impresora", "otro"]
    prioridades_validas = ["alta", "media", "baja"]

    if resultado.get("tipo") not in tipos_validos:
        resultado["tipo"] = "otro"
    if resultado.get("prioridad") not in prioridades_validas:
        resultado["prioridad"] = "media"
    resultado["titulo"] = str(resultado.get("titulo", ""))[:140]
    resultado["descripcion"] = str(resultado.get("descripcion", ""))
    resultado["ubicacion"] = str(resultado.get("ubicacion", "Sin especificar"))[:100]

    return resultado


# ── Servicio 2: Sugerencia de solución para admin TIC ────────────────────────
_SISTEMA_SUGERIR = """Eres un técnico senior de soporte TIC con 10 años de experiencia en I.E. peruanas.
El administrador TIC de {nombre_ie} abre una incidencia y necesita orientación rápida
para diagnosticarla y resolverla.

Sugiere pasos de diagnóstico y solución concretos, ordenados de lo más probable/rápido a lo menos.
Sé práctico: piensa en herramientas y checks que puede hacer sin comprar nada.
Máximo 6 pasos, cada uno en 1-2 líneas.

Responde en JSON:
{"pasos": [str, str, ...], "posibles_causas": [str, ...], "requiere_repuestos": bool, "notas": str}
"""


def sugerir_solucion(incidencia_dict: dict, historial_similar: list = None, usuario=None) -> Optional[dict]:
    """Sugiere pasos de resolución. `incidencia_dict` debe tener titulo, descripcion, tipo, ubicacion."""
    cli = get_client(endpoint="sugerir_solucion", usuario=usuario)
    if not cli:
        return None

    contexto = f"""INCIDENCIA ACTUAL:
Título: {incidencia_dict.get('titulo', '')}
Tipo: {incidencia_dict.get('tipo', 'otro')}
Ubicación: {incidencia_dict.get('ubicacion', 'Sin especificar')}
Descripción: {incidencia_dict.get('descripcion', '')}
"""

    if historial_similar:
        contexto += "\n\nHISTORIAL DE INCIDENCIAS SIMILARES RESUELTAS (para contexto):\n"
        for i, prev in enumerate(historial_similar[:3], 1):
            contexto += f"{i}. [{prev.get('tipo')}] {prev.get('titulo')} → Solución: {prev.get('solucion', 'no registrada')[:200]}\n"

    resultado = cli.completar_json(
        prompt=contexto,
        sistema=_SISTEMA_SUGERIR.format(nombre_ie=_nombre_ie()),
        max_tokens=800,
        timeout=45,
    )

    resultado.setdefault("pasos", [])
    resultado.setdefault("posibles_causas", [])
    resultado.setdefault("requiere_repuestos", False)
    resultado.setdefault("notas", "")
    return resultado


# ── Servicio 3: Resumen ejecutivo semanal para el director ───────────────────
_SISTEMA_RESUMEN = """Eres el analista de gestión de {nombre_ie}.
El director quiere un resumen breve, ejecutivo y en español formal peruano
del estado del servicio TIC de la semana.

Incluye:
1. Titular de una línea con lo más relevante.
2. Datos clave (cantidad de incidencias, tipos predominantes, tiempo promedio).
3. Un patrón o alerta si lo identificas.
4. Una recomendación accionable para la siguiente semana.

Formato de salida en Markdown limpio, máximo 200 palabras. No uses emojis."""


def resumen_ejecutivo(kpis: dict, ejemplos_recientes: list = None, usuario=None) -> Optional[str]:
    """Genera un resumen ejecutivo para el director. Devuelve markdown."""
    cli = get_client(endpoint="resumen_ejecutivo", usuario=usuario)
    if not cli:
        return None

    contexto = f"""KPIS DE LA SEMANA:
- Total incidencias: {kpis.get('total', 0)}
- Por estado: {kpis.get('por_estado', {})}
- Por tipo: {kpis.get('por_tipo', {})}
- Por prioridad: {kpis.get('por_prioridad', {})}
- Tiempo promedio resolución (horas): {kpis.get('tiempo_promedio_resolucion_horas', 0)}
- Top ubicaciones: {kpis.get('por_ubicacion_top5', [])}
"""

    if ejemplos_recientes:
        contexto += "\nEJEMPLOS RECIENTES:\n"
        for i, inc in enumerate(ejemplos_recientes[:5], 1):
            contexto += f"{i}. [{inc.get('estado')}] {inc.get('titulo')} ({inc.get('ubicacion')})\n"

    return cli.completar(
        prompt=contexto,
        sistema=_SISTEMA_RESUMEN.format(nombre_ie=_nombre_ie()),
        max_tokens=600,
        timeout=45,
    )


# ── Servicio 4: Informe pedagógico de notas por sección/bimestre ─────────────
_SISTEMA_INFORME_NOTAS = """Eres un especialista pedagógico del MINEDU con experiencia en análisis de resultados
de aprendizaje en instituciones educativas públicas peruanas del nivel secundaria.

Tu tarea es redactar un informe pedagógico breve, claro y práctico a partir de datos de calificaciones
por niveles de logro (AD/A/B/C) según la escala RVM 094-2020-MINEDU.

El informe debe:
1. Describir brevemente el panorama general de logros de la sección.
2. Identificar fortalezas por área (qué áreas tienen más AD/A).
3. Señalar áreas o competencias con mayor porcentaje en B/C (requieren atención).
4. Dar 2-3 recomendaciones pedagógicas concretas y accionables para el docente.
5. Usar lenguaje formal, directo, sin jerga ni relleno.

Estructura de salida en Markdown limpio con estos encabezados exactos:
## Panorama general
## Fortalezas
## Áreas de mejora
## Recomendaciones

Máximo 350 palabras. No uses emojis. Lenguaje español formal peruano."""


def generar_informe_notas(datos: dict, usuario=None, plantilla: Optional[str] = None) -> Optional[str]:
    """Genera informe pedagógico narrativo a partir de distribución de NL por área.
    `datos` debe tener: seccion_nombre, bimestre, total_estudiantes, areas (lista con stats)."""
    cli = get_client(endpoint="informe_notas", usuario=usuario)
    if not cli:
        return None

    seccion = datos.get("seccion_nombre", "")
    bimestre = datos.get("bimestre", "")
    total = datos.get("total_estudiantes", 0)
    areas = datos.get("areas", [])

    resumen_areas = ""
    for area in areas:
        nombre_area = area.get("area", "")
        dist = area.get("distribucion", {})
        total_area = sum(dist.values()) or 1
        pcts = {k: round(v / total_area * 100) for k, v in dist.items()}
        resumen_areas += (
            f"\n**{nombre_area}** (total notas: {sum(dist.values())})\n"
            f"  AD: {dist.get('AD', 0)} ({pcts.get('AD', 0)}%) | "
            f"A: {dist.get('A', 0)} ({pcts.get('A', 0)}%) | "
            f"B: {dist.get('B', 0)} ({pcts.get('B', 0)}%) | "
            f"C: {dist.get('C', 0)} ({pcts.get('C', 0)}%)\n"
        )

    contexto = f"""DATOS DE LA SECCIÓN:
Sección: {seccion}
Bimestre: B{bimestre}
Total estudiantes: {total}

DISTRIBUCIÓN DE NIVELES DE LOGRO POR ÁREA:
{resumen_areas}
"""
    sistema = plantilla.strip() if plantilla and plantilla.strip() else _SISTEMA_INFORME_NOTAS
    return cli.completar(
        prompt=contexto,
        sistema=sistema,
        max_tokens=700,
        timeout=60,
    )


# ── Servicio 5: Conclusiones descriptivas personalizadas por estudiante ──────
_SISTEMA_CONCLUSIONES = """Eres un especialista pedagógico del MINEDU Perú experto en redacción de boletas de notas.

Tu tarea es generar conclusiones descriptivas PERSONALIZADAS para un estudiante, una por cada área curricular.

Las conclusiones deben:
1. Ser específicas al desempeño real del estudiante en esa área (no genéricas).
2. Mencionar qué logró bien y, si aplica, qué necesita mejorar.
3. Tener tono positivo, alentador y formal (español peruano).
4. Tener máximo 2 oraciones por área.
5. NO repetir literalmente la escala (AD/A/B/C) — interpretarla en palabras.
6. NO usar el nombre del estudiante dentro de las conclusiones (ya aparece en la cabecera).

Responde SIEMPRE en JSON con exactamente este formato:
{"NombreDelArea": "conclusión descriptiva", ...}
"""


def generar_conclusiones_personalizadas(
    estudiante_nombre: str,
    notas_por_area: dict,
    bimestre: str,
    usuario=None,
    comp_nombres: list = None,
) -> Optional[dict]:
    """Genera conclusiones descriptivas personalizadas para un estudiante.

    `notas_por_area` = {"Matemática": ["AD", "B"], "Comunicación": ["A", "A", "AD"], ...}
    Retorna dict {"Matemática": "conclusión...", ...} o None si no hay IA.
    """
    cli = get_client(endpoint="conclusiones_personalizadas", usuario=usuario)
    if not cli:
        return None

    ESCALAS_TEXTO = {"AD": "logro destacado", "A": "logro esperado", "B": "en proceso", "C": "en inicio"}

    resumen_notas = ""
    nombres = comp_nombres or []
    for area, notas in notas_por_area.items():
        desc_notas = ", ".join(
            f"C{i+1}" + (f" ({nombres[i]})" if i < len(nombres) and nombres[i] else "") + f": {n} ({ESCALAS_TEXTO.get(n, n)})"
            for i, n in enumerate(notas)
        )
        resumen_notas += f"\n- {area}: {desc_notas}"

    contexto = f"""ESTUDIANTE: {estudiante_nombre}
BIMESTRE: {bimestre}er bimestre
NOTAS POR ÁREA:{resumen_notas}
"""

    resultado = cli.completar_json(
        prompt=contexto,
        sistema=_SISTEMA_CONCLUSIONES,
        max_tokens=800,
        timeout=45,
    )
    return resultado if isinstance(resultado, dict) else None


# ── Servicio 6: Generación de sesión de aprendizaje ──────────────────────────
_SISTEMA_SESION = """Eres un especialista pedagógico del MINEDU Perú con experiencia en el Currículo Nacional (CNEB 2016).
Genera sesiones de aprendizaje alineadas al CNEB con enfoque por competencias.

Responde ÚNICAMENTE con un objeto JSON válido con estas claves exactas:
{
  "titulo": "Título descriptivo de la sesión",
  "desempeno": "Desempeño preciso del CNEB para esta competencia y grado",
  "preparacion": "¿Qué necesitamos hacer antes de la sesión? Lista de acciones previas: materiales a preparar, espacios a organizar, instrumentos de evaluación a alistar, lecturas o actividades previas que el docente debe hacer.",
  "proposito": "Qué aprenderán los estudiantes y cómo se evaluará (2-3 oraciones)",
  "inicio": "Actividades de inicio: activación de saberes previos y conflicto cognitivo. Sé específico con preguntas y acciones concretas.",
  "desarrollo": "Actividades de desarrollo: estrategias, actividades y recursos paso a paso. Detallado y práctico.",
  "cierre": "Actividades de cierre: reflexión metacognitiva y evaluación formativa.",
  "materiales": "Lista de recursos y materiales necesarios",
  "evaluacion": "Criterios de evaluación: lista de verificación o rúbrica simplificada"
}

Idioma: español peruano formal. Sin emojis. Sé específico y práctico. Solo el JSON, sin texto adicional."""


def generar_sesion_aprendizaje(
    area: str,
    grado: str,
    competencia: str,
    capacidad: str,
    tema: str,
    duracion_minutos: int = 90,
    usuario=None
) -> Optional[dict]:
    """Genera una sesión de aprendizaje completa alineada al CNEB. Devuelve dict con campos."""
    cli = get_client(endpoint="sesion_aprendizaje", usuario=usuario)
    if not cli:
        return None

    t_inicio = max(10, int(duracion_minutos * 0.18))
    t_desarrollo = max(20, int(duracion_minutos * 0.64))
    t_cierre = duracion_minutos - t_inicio - t_desarrollo

    contexto = f"""DATOS PARA LA SESIÓN:
Área: {area}
Grado: {grado}
Competencia: {competencia}
Capacidad/Indicador: {capacidad or "no especificada"}
Tema / Título: {tema}
Duración total: {duracion_minutos} minutos (Inicio: {t_inicio}min, Desarrollo: {t_desarrollo}min, Cierre: {t_cierre}min)
"""

    import json, re
    try:
        texto = cli.completar(prompt=contexto, sistema=_SISTEMA_SESION, max_tokens=2000, timeout=90)
        match = re.search(r'\{.*\}', texto, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return None


# ── Servicio 7: Resumen semanal institucional (F1) ────────────────────────────
_SISTEMA_RESUMEN_SEMANAL = """Eres el analista institucional de {nombre_ie}.
El director necesita un resumen ejecutivo semanal completo de la institución.

Redacta un informe breve, claro y en español formal peruano que cubra:
1. **Titular**: una línea con lo más relevante de la semana.
2. **Asistencia**: análisis de presencia/ausencia de estudiantes.
3. **Incidencias TIC**: estado del soporte técnico.
4. **Notas y aprendizaje**: panorama de niveles de logro por sección.
5. **Alertas**: estudiantes en riesgo académico o de asistencia.
6. **Recomendación**: una acción concreta para la próxima semana.

Formato Markdown con esos encabezados. Máximo 400 palabras. Sin emojis. Español formal peruano."""


def generar_resumen_semanal(datos: dict, usuario=None) -> Optional[str]:
    """Genera resumen semanal institucional para el director."""
    cli = get_client(endpoint="resumen_semanal", usuario=usuario)
    if not cli:
        return None

    ctx = f"""DATOS INSTITUCIONALES — Semana del {datos.get('fecha_inicio')} al {datos.get('fecha_fin')}:

ASISTENCIA:
- Hoy: {datos.get('presentes_hoy', 0)} presentes / {datos.get('ausentes_hoy', 0)} ausentes
- Semana: {datos.get('ausencias_semana', 0)} ausencias registradas
- Top faltas del mes: {datos.get('top_faltas', [])}

INCIDENCIAS TIC (últimos 7 días):
- Total: {datos.get('inc_total', 0)} · Pendientes: {datos.get('inc_pendientes', 0)}
- Por tipo: {datos.get('inc_por_tipo', {})}

NOTAS ({datos.get('anio')}):
- Registros totales: {datos.get('notas_total', 0)}
- Distribución: AD:{datos.get('notas_ad', 0)} A:{datos.get('notas_a', 0)} B:{datos.get('notas_b', 0)} C:{datos.get('notas_c', 0)}
- Por sección: {datos.get('notas_por_seccion', [])}

ALERTAS:
- Estudiantes con C en algún área: {datos.get('est_con_c', 0)}
- Estudiantes con 3+ faltas este mes: {datos.get('est_con_faltas', 0)}
- En riesgo alto (ambos): {datos.get('est_riesgo_alto', 0)}
"""
    return cli.completar(
        prompt=ctx,
        sistema=_SISTEMA_RESUMEN_SEMANAL.format(nombre_ie=_nombre_ie()),
        max_tokens=800,
        timeout=60,
    )


# ── Servicio 8: Reporte de riesgo narrativo por sección (F2) ─────────────────
_SISTEMA_REPORTE_RIESGO = """Eres un especialista pedagógico del MINEDU Perú con enfoque en intervención temprana.

El docente necesita un reporte narrativo de los estudiantes en riesgo de su sección.

Redacta un análisis breve, empático y profesional que:
1. Describa el panorama general de riesgo de la sección.
2. Mencione a cada estudiante en riesgo por nombre, indicando si es por notas (áreas con C), asistencia (faltas) o ambas.
3. Proponga 2-3 acciones concretas de intervención pedagógica y/o comunicación con la familia.

Formato Markdown. Máximo 300 palabras. Tono profesional, no alarmista. Español formal peruano."""


def generar_reporte_riesgo(seccion_nombre: str, estudiantes_riesgo: list, usuario=None) -> Optional[str]:
    """Genera reporte narrativo de estudiantes en riesgo para el docente."""
    cli = get_client(endpoint="reporte_riesgo", usuario=usuario)
    if not cli:
        return None

    if not estudiantes_riesgo:
        return "Sin estudiantes en situación de riesgo en esta sección."

    detalle = ""
    for e in estudiantes_riesgo:
        partes = []
        if e.get("areas_c"):
            partes.append(f"C en: {', '.join(e['areas_c'])}")
        if e.get("faltas_mes", 0) > 0:
            partes.append(f"{e['faltas_mes']} falta(s) este mes")
        detalle += f"- {e['nombre']} ({e['nivel_riesgo']}): {'; '.join(partes)}\n"

    ctx = f"""SECCIÓN: {seccion_nombre}
TOTAL EN RIESGO: {len(estudiantes_riesgo)}
DETALLE:
{detalle}"""

    return cli.completar(
        prompt=ctx,
        sistema=_SISTEMA_REPORTE_RIESGO,
        max_tokens=600,
        timeout=45,
    )


# ── Servicio 9: Resumen de cierre de bimestre (F3) ───────────────────────────
_SISTEMA_CIERRE_BIMESTRE = """Eres un especialista pedagógico del MINEDU Perú experto en evaluación formativa.

El docente cierra un bimestre y necesita un resumen analítico completo que incluya:
1. **Balance general**: cómo le fue a la sección en general.
2. **Logros destacados**: áreas y estudiantes con mejor desempeño.
3. **Áreas críticas**: qué áreas o competencias tuvieron más dificultades.
4. **Tendencia**: si hubo mejora o retroceso respecto al bimestre anterior (si hay datos).
5. **Plan de acción**: 3 recomendaciones concretas para el siguiente bimestre.

Formato Markdown con esos encabezados. Máximo 400 palabras. Español formal peruano. Sin emojis."""


def generar_cierre_bimestre(datos: dict, usuario=None) -> Optional[str]:
    """Genera resumen de cierre de bimestre con análisis y plan de acción."""
    cli = get_client(endpoint="cierre_bimestre", usuario=usuario)
    if not cli:
        return None

    areas_str = ""
    for a in datos.get("areas", []):
        d = a.get("distribucion", {})
        areas_str += f"- {a['area']}: AD:{d.get('AD',0)} A:{d.get('A',0)} B:{d.get('B',0)} C:{d.get('C',0)}\n"

    anterior_str = ""
    if datos.get("bimestre_anterior"):
        ba = datos["bimestre_anterior"]
        anterior_str = f"\nBIMESTRE ANTERIOR (B{ba.get('bimestre')}) — para comparar:\n"
        for a in ba.get("areas", []):
            d = a.get("distribucion", {})
            anterior_str += f"- {a['area']}: AD:{d.get('AD',0)} A:{d.get('A',0)} B:{d.get('B',0)} C:{d.get('C',0)}\n"

    ctx = f"""SECCIÓN: {datos.get('seccion_nombre')}
BIMESTRE: B{datos.get('bimestre')} — Año {datos.get('anio')}
TOTAL ESTUDIANTES: {datos.get('total_estudiantes', 0)}

DISTRIBUCIÓN POR ÁREA:
{areas_str}{anterior_str}"""

    return cli.completar(
        prompt=ctx,
        sistema=_SISTEMA_CIERRE_BIMESTRE,
        max_tokens=800,
        timeout=60,
    )
