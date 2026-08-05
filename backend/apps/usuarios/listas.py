"""Listas imprimibles de estudiantes por sección — PDF y Excel oficiales."""
import io
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from apps.core.models import ConfiguracionInstitucional
from apps.usuarios.models import Estudiante, Seccion


MES_ES = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _datos(seccion_id: int):
    seccion = Seccion.objects.filter(pk=seccion_id).select_related("tutor").first()
    if not seccion:
        raise ValueError("Sección no encontrada.")

    estudiantes = list(
        Estudiante.objects.por_seccion(seccion.pk)
        .select_related("usuario")
        .order_by("usuario__last_name", "usuario__first_name")
    )
    filas = []
    for i, e in enumerate(estudiantes, start=1):
        nombre = f"{e.usuario.last_name}, {e.usuario.first_name}".strip(", ")
        filas.append({
            "n": i,
            "nombre": nombre,
            "dni": e.usuario.dni or "",
            "codigo": e.codigo_matricula or "",
            "sexo": e.sexo or "",
        })

    cfg = ConfiguracionInstitucional.objects.first()
    return {"seccion": seccion, "filas": filas, "cfg": cfg}


# ═════════════════════════════════════════════════════════════════════════════
# EXCEL — lista simple para editar / marcar manualmente
# ═════════════════════════════════════════════════════════════════════════════
def excel_lista_seccion(seccion_id: int) -> bytes:
    d = _datos(seccion_id)
    seccion = d["seccion"]; cfg = d["cfg"]; filas = d["filas"]

    wb = Workbook()
    ws = wb.active
    ws.title = f"{seccion.nombre}"[:31]

    borde = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    ws["A1"] = (cfg.nombre_institucion if cfg else "Institución").upper()
    ws["A1"].font = Font(size=14, bold=True, color="1E3A5F")
    ws.merge_cells("A1:F1")

    linea2 = f"Código modular: {cfg.codigo_modular if cfg else ''}   ·   {cfg.ugel if cfg else ''}   ·   {cfg.dre if cfg else ''}"
    ws["A2"] = linea2
    ws["A2"].font = Font(size=10, color="475569")
    ws.merge_cells("A2:F2")

    tutor_nombre = ""
    if seccion.tutor_id:
        tutor_nombre = f"{seccion.tutor.first_name} {seccion.tutor.last_name}".strip()

    ws["A3"] = (
        f"LISTA DE ESTUDIANTES — Sección {seccion.nombre}"
        + (f"   ·   Tutor(a): {tutor_nombre}" if tutor_nombre else "")
    )
    ws["A3"].font = Font(size=12, bold=True)
    ws.merge_cells("A3:F3")

    ws["A4"] = f"Total: {len(filas)} estudiante(s)   ·   Generado: {date.today().strftime('%d/%m/%Y')}"
    ws["A4"].font = Font(size=10, italic=True, color="64748B")
    ws.merge_cells("A4:F4")

    # Cabecera de tabla
    headers = ["N°", "Apellidos y Nombres", "DNI", "Código matrícula", "Sexo", "Firma"]
    header_row = 6
    for i, h in enumerate(headers, start=1):
        cel = ws.cell(row=header_row, column=i, value=h)
        cel.font = Font(bold=True, color="FFFFFF", size=10)
        cel.fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        cel.alignment = Alignment(horizontal="center", vertical="center")
        cel.border = borde

    ws.row_dimensions[header_row].height = 24
    anchos = [5, 34, 12, 14, 8, 28]
    for i, w in enumerate(anchos, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    for row_idx, f in enumerate(filas, start=header_row + 1):
        ws.cell(row=row_idx, column=1, value=f["n"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=2, value=f["nombre"])
        ws.cell(row=row_idx, column=3, value=f["dni"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=4, value=f["codigo"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=5, value=f["sexo"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=6, value="")  # firma vacía
        for c in range(1, 7):
            ws.cell(row=row_idx, column=c).border = borde
        ws.row_dimensions[row_idx].height = 22

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ═════════════════════════════════════════════════════════════════════════════
# PDF — versión oficial imprimible
# ═════════════════════════════════════════════════════════════════════════════
def pdf_lista_seccion(seccion_id: int) -> bytes:
    d = _datos(seccion_id)
    seccion = d["seccion"]; cfg = d["cfg"]; filas = d["filas"]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5 * cm, leftMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    elementos = []

    nombre = (cfg.nombre_institucion if cfg else "Institución").upper()
    linea2 = f"Código modular: {cfg.codigo_modular if cfg else ''} · {cfg.ugel if cfg else ''} · {cfg.dre if cfg else ''}"
    elementos.append(Paragraph(f"<b>{nombre}</b>", styles["Title"]))
    elementos.append(Paragraph(linea2, styles["Normal"]))
    elementos.append(Spacer(1, 8))

    tutor_nombre = ""
    if seccion.tutor_id:
        tutor_nombre = f"{seccion.tutor.first_name} {seccion.tutor.last_name}".strip()

    subtitulo = f"<b>LISTA DE ESTUDIANTES — Sección {seccion.nombre}</b>"
    if tutor_nombre:
        subtitulo += f" · Tutor(a): {tutor_nombre}"
    elementos.append(Paragraph(subtitulo, styles["Heading3"]))
    elementos.append(Paragraph(
        f"Total: {len(filas)} estudiante(s) · Generado: {date.today().strftime('%d/%m/%Y')}",
        styles["Normal"]
    ))
    elementos.append(Spacer(1, 10))

    header = ["N°", "Apellidos y Nombres", "DNI", "Cód. matrícula", "Sexo", "Firma"]
    data = [header]
    for f in filas:
        data.append([str(f["n"]), f["nombre"], f["dni"], f["codigo"], f["sexo"], ""])

    col_widths = [1.0 * cm, 7.0 * cm, 2.3 * cm, 2.5 * cm, 1.2 * cm, 4.0 * cm]
    tabla = Table(data, colWidths=col_widths, repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CBD5E1")),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (5, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    elementos.append(tabla)

    # Firmas al pie
    elementos.append(Spacer(1, 30))
    firmas_data = [[
        Paragraph("_" * 30 + "<br/>Tutor(a) de sección", styles["Normal"]),
        Paragraph("_" * 30 + "<br/>Auxiliar", styles["Normal"]),
        Paragraph("_" * 30 + "<br/>Dirección", styles["Normal"]),
    ]]
    firmas_tabla = Table(firmas_data, colWidths=[6 * cm, 6 * cm, 6 * cm])
    firmas_tabla.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    elementos.append(firmas_tabla)

    doc.build(elementos)
    return buffer.getvalue()
