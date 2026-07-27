"""Exportadores institucionales para incidencias TIC.
Excel: listado operativo (para el TIC).
Word: reporte mensual con IA (para UGEL / Dirección)."""
import io
from datetime import date, timedelta

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side

from .models import (
    EstadoIncidencia,
    Incidencia,
    PrioridadIncidencia,
    TipoIncidencia,
)


ESTADO_ES = dict(EstadoIncidencia.choices)
TIPO_ES = dict(TipoIncidencia.choices)
PRIORIDAD_ES = dict(PrioridadIncidencia.choices)

AZUL_HEX = "1E3A5F"
GRIS_HEX = "F1F5F9"

_borde_fino = Border(
    left=Side(style="thin", color="CBD5E1"),
    right=Side(style="thin", color="CBD5E1"),
    top=Side(style="thin", color="CBD5E1"),
    bottom=Side(style="thin", color="CBD5E1"),
)


def exportar_incidencias_excel(queryset) -> bytes:
    """Devuelve un xlsx con la lista de incidencias.
    Diseño simple y limpio: encabezado azul institucional + zebra + borde fino."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Incidencias TIC"

    # ── Encabezado institucional ─────────────────────────────────────────────
    ws["A1"] = "I.E. C.N. CÉSAR VALLEJO DE PAUCARBAMBA"
    ws["A2"] = "Reporte de Incidencias TIC"
    ws["A3"] = f"Generado: {timezone.now().strftime('%d/%m/%Y %H:%M')}  ·  Registros: {queryset.count()}"

    for fila_ref, tam, negrita in ((1, 14, True), (2, 12, True), (3, 10, False)):
        celda = ws[f"A{fila_ref}"]
        celda.font = Font(size=tam, bold=negrita, color=AZUL_HEX)
    ws.merge_cells("A1:J1")
    ws.merge_cells("A2:J2")
    ws.merge_cells("A3:J3")

    # ── Cabecera de tabla ────────────────────────────────────────────────────
    columnas = [
        ("N°", 6),
        ("Título", 40),
        ("Ubicación", 20),
        ("Tipo", 14),
        ("Prioridad", 12),
        ("Estado", 14),
        ("Reportado por", 20),
        ("Asignado a", 20),
        ("Reportado el", 18),
        ("Resuelto el", 18),
    ]
    fila_cabecera = 5
    for i, (titulo, ancho) in enumerate(columnas, 1):
        c = ws.cell(row=fila_cabecera, column=i, value=titulo)
        c.font = Font(bold=True, color="FFFFFF", size=11)
        c.fill = PatternFill(start_color=AZUL_HEX, end_color=AZUL_HEX, fill_type="solid")
        c.alignment = Alignment(horizontal="center", vertical="center")
        c.border = _borde_fino
        ws.column_dimensions[c.column_letter].width = ancho
    ws.row_dimensions[fila_cabecera].height = 24

    # ── Filas ────────────────────────────────────────────────────────────────
    for idx, inc in enumerate(queryset.select_related("reportado_por", "asignado_a"), 1):
        fila = fila_cabecera + idx
        valores = [
            inc.id,
            inc.titulo,
            inc.ubicacion,
            TIPO_ES.get(inc.tipo, inc.tipo),
            PRIORIDAD_ES.get(inc.prioridad, inc.prioridad),
            ESTADO_ES.get(inc.estado, inc.estado),
            _nombre_usuario(inc.reportado_por),
            _nombre_usuario(inc.asignado_a),
            inc.creado_en.strftime("%d/%m/%Y %H:%M") if inc.creado_en else "",
            inc.fecha_resolucion.strftime("%d/%m/%Y %H:%M") if inc.fecha_resolucion else "",
        ]
        for col, valor in enumerate(valores, 1):
            c = ws.cell(row=fila, column=col, value=valor)
            c.border = _borde_fino
            c.alignment = Alignment(vertical="center", wrap_text=True)
            if idx % 2 == 0:
                c.fill = PatternFill(start_color=GRIS_HEX, end_color=GRIS_HEX, fill_type="solid")

    # Congelar encabezado
    ws.freeze_panes = f"A{fila_cabecera + 1}"

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def _nombre_usuario(u):
    if not u:
        return ""
    nombre = u.get_full_name()
    return nombre or u.username


# ═════════════════════════════════════════════════════════════════════════════
# Word — reporte mensual con IA
# ═════════════════════════════════════════════════════════════════════════════
def exportar_reporte_mensual_word(kpis: dict, texto_ia: str, mes: date) -> bytes:
    """Genera un docx con formato oficial simple (institucional peruano) usando
    los KPIs calculados y el texto narrativo generado por la IA."""
    from docx import Document
    from docx.shared import Pt, RGBColor, Cm
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    from apps.core.models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()
    nombre_ie = (cfg.nombre_institucion or "Institución Educativa").upper()
    codigo_ugel = f"Código modular: {cfg.codigo_modular}" if cfg.codigo_modular else ""
    if cfg.ugel:
        codigo_ugel += f"  ·  {cfg.ugel}"
    direccion_ie = cfg.direccion or ""

    doc = Document()

    # Márgenes
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    # ── Encabezado institucional ─────────────────────────────────────────────
    cabecera_rows = [(nombre_ie, 12, True)]
    if codigo_ugel:
        cabecera_rows.append((codigo_ugel, 9, False))
    if direccion_ie:
        cabecera_rows.append((direccion_ie, 9, False))
    for texto, tam, bold in cabecera_rows:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(texto)
        r.font.size = Pt(tam)
        r.bold = bold
        if bold:
            r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)

    doc.add_paragraph()

    # ── Título ───────────────────────────────────────────────────────────────
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(f"REPORTE MENSUAL DE INCIDENCIAS TIC — {mes.strftime('%B %Y').upper()}")
    r.bold = True
    r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)

    doc.add_paragraph()

    # ── Sección 1: Resumen ejecutivo por IA ──────────────────────────────────
    _agregar_titulo_seccion(doc, "1. RESUMEN EJECUTIVO")
    for parrafo in (texto_ia or "").split("\n"):
        parrafo = parrafo.strip()
        if not parrafo:
            continue
        if parrafo.startswith("**") and parrafo.endswith("**"):
            r = doc.add_paragraph().add_run(parrafo.strip("*"))
            r.bold = True
        elif parrafo.startswith(("- ", "* ")):
            doc.add_paragraph(parrafo[2:], style="List Bullet")
        else:
            doc.add_paragraph(parrafo)

    doc.add_paragraph()

    # ── Sección 2: Indicadores ───────────────────────────────────────────────
    _agregar_titulo_seccion(doc, "2. INDICADORES DEL PERIODO")

    _tabla_kpi(doc, "Total de incidencias registradas", kpis.get("total", 0))
    _tabla_kpi(doc, "Tiempo promedio de resolución (horas)", kpis.get("tiempo_promedio_resolucion_horas", 0))

    doc.add_paragraph()
    _sub(doc, "2.1 Distribución por estado")
    _tabla_dict(doc, kpis.get("por_estado", {}), ESTADO_ES)

    _sub(doc, "2.2 Distribución por tipo de equipo")
    _tabla_dict(doc, kpis.get("por_tipo", {}), TIPO_ES)

    _sub(doc, "2.3 Distribución por prioridad")
    _tabla_dict(doc, kpis.get("por_prioridad", {}), PRIORIDAD_ES)

    if kpis.get("por_ubicacion_top5"):
        _sub(doc, "2.4 Ambientes con mayor incidencia")
        tabla = doc.add_table(rows=1, cols=2)
        tabla.style = "Light Grid Accent 1"
        hdr = tabla.rows[0].cells
        hdr[0].text = "Ambiente"
        hdr[1].text = "Cantidad"
        for row in kpis["por_ubicacion_top5"]:
            fila = tabla.add_row().cells
            fila[0].text = str(row.get("ubicacion", ""))
            fila[1].text = str(row.get("count", 0))

    doc.add_paragraph()

    # ── Sección 3: Firmas ────────────────────────────────────────────────────
    _agregar_titulo_seccion(doc, "3. RESPONSABLES")
    doc.add_paragraph()
    doc.add_paragraph()

    tabla_firmas = doc.add_table(rows=2, cols=2)
    firmas = [
        ("Elaborado por", "Administrador TIC"),
        ("Aprobado por", "Dirección"),
    ]
    for i, (rol, titulo) in enumerate(firmas):
        col = i
        tabla_firmas.cell(0, col).text = "_" * 30
        p = tabla_firmas.cell(1, col).paragraphs[0]
        r = p.add_run(f"{rol}\n")
        r.bold = True
        p.add_run(titulo)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.add_run(
        f"\n\n{cfg.direccion.split(',')[0] if cfg.direccion else 'Lima'}, {timezone.now().strftime('%d de %B de %Y')}"
    ).italic = True

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(
        "\nDocumento generado con asistencia de IA. Revisar antes de uso oficial."
    )
    r.italic = True
    r.font.size = Pt(8)
    r.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def _agregar_titulo_seccion(doc, texto):
    from docx.shared import Pt, RGBColor
    p = doc.add_paragraph()
    r = p.add_run(texto)
    r.bold = True
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)


def _sub(doc, texto):
    from docx.shared import Pt
    p = doc.add_paragraph()
    r = p.add_run(texto)
    r.bold = True
    r.font.size = Pt(11)


def _tabla_kpi(doc, etiqueta, valor):
    tabla = doc.add_table(rows=1, cols=2)
    tabla.style = "Light Grid Accent 1"
    tabla.rows[0].cells[0].text = etiqueta
    tabla.rows[0].cells[1].text = str(valor)


def _tabla_dict(doc, valores: dict, labels: dict):
    tabla = doc.add_table(rows=1, cols=2)
    tabla.style = "Light Grid Accent 1"
    hdr = tabla.rows[0].cells
    hdr[0].text = "Categoría"
    hdr[1].text = "Cantidad"
    for clave, cantidad in valores.items():
        if cantidad == 0:
            continue
        fila = tabla.add_row().cells
        fila[0].text = labels.get(clave, clave)
        fila[1].text = str(cantidad)
