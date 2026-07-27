"""Export mensual de asistencia — Excel + PDF con membrete institucional."""
import calendar
import io
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from apps.asistencia.models import RegistroAsistencia
from apps.core.models import ConfiguracionInstitucional
from apps.usuarios.models import Estudiante, Seccion


ESTADO_CHAR = {
    "presente": "P",
    "tardanza": "T",
    "ausente": "A",
    "justificado": "J",
}

ESTADO_COLOR_HEX = {  # para Excel
    "P": "10B981",   # verde
    "T": "F59E0B",   # ámbar
    "A": "EF4444",   # rojo
    "J": "6B7280",   # gris
}

MES_ES = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _datos(seccion_id: int, anio: int, mes: int):
    """Prepara la matriz estudiante × días con estados. Devuelve dict con todo."""
    seccion = Seccion.objects.filter(pk=seccion_id).first()
    if not seccion:
        raise ValueError("Sección no encontrada.")

    dias_mes = calendar.monthrange(anio, mes)[1]
    dias = [date(anio, mes, d) for d in range(1, dias_mes + 1)]

    estudiantes = list(
        Estudiante.objects.filter(seccion_obj=seccion)
        .select_related("usuario")
        .order_by("usuario__last_name", "usuario__first_name")
    )

    # Registros de todo el mes de esos estudiantes
    registros = RegistroAsistencia.objects.filter(
        estudiante__in=estudiantes,
        fecha__year=anio, fecha__month=mes,
    ).values("estudiante_id", "fecha", "estado")

    # Índice: {estudiante_id: {fecha: estado}}
    idx: dict = {}
    for r in registros:
        idx.setdefault(r["estudiante_id"], {})[r["fecha"]] = r["estado"]

    filas = []
    for i, e in enumerate(estudiantes, start=1):
        estados_por_dia = []
        totales = {"P": 0, "T": 0, "A": 0, "J": 0, "-": 0}
        for d in dias:
            weekday = d.weekday()  # 5=sab, 6=dom
            if weekday >= 5:
                estados_por_dia.append("")
                continue
            estado = idx.get(e.pk, {}).get(d)
            char = ESTADO_CHAR.get(estado, "-") if estado else "-"
            estados_por_dia.append(char)
            totales[char] = totales.get(char, 0) + 1

        dias_habiles = totales["P"] + totales["T"] + totales["A"] + totales["J"]
        pct_asist = round(
            100 * (totales["P"] + totales["T"] + totales["J"]) / max(dias_habiles, 1),
            1
        )

        nombre = f"{e.usuario.last_name}, {e.usuario.first_name}".strip(", ")
        filas.append({
            "n": i,
            "nombre": nombre,
            "dni": e.usuario.dni or "",
            "estados": estados_por_dia,
            "totales": totales,
            "pct": pct_asist,
        })

    cfg = ConfiguracionInstitucional.objects.first()
    return {
        "seccion": seccion,
        "anio": anio, "mes": mes,
        "dias": dias,
        "filas": filas,
        "cfg": cfg,
    }


# ═════════════════════════════════════════════════════════════════════════════
# EXCEL
# ═════════════════════════════════════════════════════════════════════════════
def excel_asistencia_mensual(seccion_id: int, anio: int, mes: int) -> bytes:
    d = _datos(seccion_id, anio, mes)
    seccion = d["seccion"]; cfg = d["cfg"]; dias = d["dias"]; filas = d["filas"]

    wb = Workbook()
    ws = wb.active
    ws.title = f"{seccion.nombre} {MES_ES[mes]} {anio}"[:31]

    borde_fino = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # ── Cabecera institucional ────────────────────────────────
    total_cols = 3 + len(dias) + 5  # N + Nombre + DNI + días + P T A J %
    ultima_letra = get_column_letter(total_cols)

    ws["A1"] = (cfg.nombre_institucion if cfg else "Institución").upper()
    ws["A1"].font = Font(size=14, bold=True, color="1E3A5F")
    ws.merge_cells(f"A1:{ultima_letra}1")

    linea2 = f"Código modular: {cfg.codigo_modular if cfg else ''}   ·   {cfg.ugel if cfg else ''}   ·   {cfg.dre if cfg else ''}"
    ws["A2"] = linea2
    ws["A2"].font = Font(size=10, color="475569")
    ws.merge_cells(f"A2:{ultima_letra}2")

    ws["A3"] = f"REGISTRO DE ASISTENCIA — {seccion.nombre}   ·   {MES_ES[mes].capitalize()} {anio}"
    ws["A3"].font = Font(size=12, bold=True)
    ws.merge_cells(f"A3:{ultima_letra}3")

    # ── Cabecera de tabla ──────────────────────────────────────
    header_row = 5
    headers = ["N°", "Apellidos y Nombres", "DNI"]
    for d_ in dias:
        headers.append(str(d_.day))
    headers += ["P", "T", "A", "J", "% Asist."]

    for i, h in enumerate(headers, start=1):
        cel = ws.cell(row=header_row, column=i, value=h)
        cel.font = Font(bold=True, color="FFFFFF", size=10)
        cel.fill = PatternFill(start_color="1E3A5F", end_color="1E3A5F", fill_type="solid")
        cel.alignment = Alignment(horizontal="center", vertical="center")
        cel.border = borde_fino

    # Marcar fines de semana en gris claro en la cabecera
    for i, d_ in enumerate(dias, start=4):
        if d_.weekday() >= 5:
            ws.cell(row=header_row, column=i).fill = PatternFill(
                start_color="94A3B8", end_color="94A3B8", fill_type="solid"
            )

    ws.row_dimensions[header_row].height = 24
    ws.column_dimensions["A"].width = 4
    ws.column_dimensions["B"].width = 32
    ws.column_dimensions["C"].width = 10
    for i in range(len(dias)):
        ws.column_dimensions[get_column_letter(4 + i)].width = 3.5
    for i, w in enumerate([5, 5, 5, 5, 9], start=4 + len(dias)):
        ws.column_dimensions[get_column_letter(i)].width = w

    # ── Filas de estudiantes ───────────────────────────────────
    for row_idx, f in enumerate(filas, start=header_row + 1):
        ws.cell(row=row_idx, column=1, value=f["n"]).alignment = Alignment(horizontal="center")
        ws.cell(row=row_idx, column=2, value=f["nombre"])
        ws.cell(row=row_idx, column=3, value=f["dni"]).alignment = Alignment(horizontal="center")

        for i, char in enumerate(f["estados"], start=4):
            cel = ws.cell(row=row_idx, column=i, value=char)
            cel.alignment = Alignment(horizontal="center", vertical="center")
            cel.border = borde_fino
            cel.font = Font(size=9, bold=True)
            if char in ESTADO_COLOR_HEX:
                cel.font = Font(size=9, bold=True, color="FFFFFF")
                cel.fill = PatternFill(
                    start_color=ESTADO_COLOR_HEX[char],
                    end_color=ESTADO_COLOR_HEX[char],
                    fill_type="solid",
                )

        col = 4 + len(dias)
        for k, v in [("P", f["totales"]["P"]), ("T", f["totales"]["T"]),
                     ("A", f["totales"]["A"]), ("J", f["totales"]["J"])]:
            cel = ws.cell(row=row_idx, column=col, value=v)
            cel.alignment = Alignment(horizontal="center")
            cel.border = borde_fino
            col += 1

        cel = ws.cell(row=row_idx, column=col, value=f"{f['pct']}%")
        cel.alignment = Alignment(horizontal="center")
        cel.font = Font(bold=True, color="10B981" if f["pct"] >= 85 else "EF4444")
        cel.border = borde_fino

        # Bordes en las columnas iniciales
        for c in (1, 2, 3):
            ws.cell(row=row_idx, column=c).border = borde_fino

    # ── Leyenda ────────────────────────────────────────────────
    leyenda_row = header_row + len(filas) + 2
    ws.cell(row=leyenda_row, column=1, value="Leyenda:").font = Font(bold=True, size=10)
    leyenda = [("P", "Presente", "10B981"), ("T", "Tardanza", "F59E0B"),
               ("A", "Ausente", "EF4444"), ("J", "Justificada", "6B7280")]
    col = 2
    for char, txt, color in leyenda:
        cel = ws.cell(row=leyenda_row, column=col, value=char)
        cel.font = Font(bold=True, color="FFFFFF")
        cel.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
        cel.alignment = Alignment(horizontal="center")
        ws.cell(row=leyenda_row, column=col + 1, value=txt).font = Font(size=10)
        col += 3

    ws.freeze_panes = f"D{header_row + 1}"

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ═════════════════════════════════════════════════════════════════════════════
# PDF (con membrete institucional, en horizontal para que quepan los días)
# ═════════════════════════════════════════════════════════════════════════════
def pdf_asistencia_mensual(seccion_id: int, anio: int, mes: int) -> bytes:
    d = _datos(seccion_id, anio, mes)
    seccion = d["seccion"]; cfg = d["cfg"]; dias = d["dias"]; filas = d["filas"]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=landscape(A4),
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    elementos = []

    # Cabecera institucional
    nombre = (cfg.nombre_institucion if cfg else "Institución").upper()
    linea2 = f"Código modular: {cfg.codigo_modular if cfg else ''} · {cfg.ugel if cfg else ''} · {cfg.dre if cfg else ''}"
    elementos.append(Paragraph(f"<b>{nombre}</b>", styles["Title"]))
    elementos.append(Paragraph(linea2, styles["Normal"]))
    elementos.append(Spacer(1, 6))
    elementos.append(Paragraph(
        f"<b>REGISTRO DE ASISTENCIA</b> — Sección {seccion.nombre} — "
        f"{MES_ES[mes].capitalize()} {anio}",
        styles["Heading3"]
    ))
    elementos.append(Spacer(1, 6))

    # Tabla
    header = ["N°", "Apellidos y Nombres", "DNI"]
    header += [str(dd.day) for dd in dias]
    header += ["P", "T", "A", "J", "%"]

    data = [header]
    for f in filas:
        row = [str(f["n"]), f["nombre"], f["dni"]]
        row += f["estados"]
        row += [str(f["totales"]["P"]), str(f["totales"]["T"]),
                str(f["totales"]["A"]), str(f["totales"]["J"]),
                f"{f['pct']}%"]
        data.append(row)

    # Column widths
    ancho_dia = 0.5 * cm
    col_widths = [0.8 * cm, 5.5 * cm, 1.6 * cm] + [ancho_dia] * len(dias) + \
                 [0.6 * cm] * 4 + [1.0 * cm]

    tabla = Table(data, colWidths=col_widths, repeatRows=1)

    style = TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),

        # Cuerpo
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#CBD5E1")),
        ("ALIGN", (3, 1), (-1, -1), "CENTER"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (2, -1), "CENTER"),
    ])

    # Colorear celdas por estado
    for r_i, f in enumerate(filas, start=1):
        for c_i, char in enumerate(f["estados"], start=3):
            if char == "P":
                style.add("BACKGROUND", (c_i, r_i), (c_i, r_i), colors.HexColor("#D1FAE5"))
            elif char == "T":
                style.add("BACKGROUND", (c_i, r_i), (c_i, r_i), colors.HexColor("#FEF3C7"))
            elif char == "A":
                style.add("BACKGROUND", (c_i, r_i), (c_i, r_i), colors.HexColor("#FEE2E2"))
            elif char == "J":
                style.add("BACKGROUND", (c_i, r_i), (c_i, r_i), colors.HexColor("#E5E7EB"))
        # % en color según >= 85%
        col_pct = 3 + len(dias) + 4
        style.add(
            "TEXTCOLOR", (col_pct, r_i), (col_pct, r_i),
            colors.HexColor("#10B981") if f["pct"] >= 85 else colors.HexColor("#EF4444")
        )
        style.add("FONTNAME", (col_pct, r_i), (col_pct, r_i), "Helvetica-Bold")

    # Fin de semana columnas más grises en header
    for c_i, dd in enumerate(dias, start=3):
        if dd.weekday() >= 5:
            style.add("BACKGROUND", (c_i, 0), (c_i, 0), colors.HexColor("#94A3B8"))

    tabla.setStyle(style)
    elementos.append(tabla)

    # Leyenda
    elementos.append(Spacer(1, 10))
    leyenda_txt = (
        "<b>Leyenda:</b> "
        "<font backColor='#D1FAE5'>&nbsp;P&nbsp;</font> Presente &nbsp;·&nbsp; "
        "<font backColor='#FEF3C7'>&nbsp;T&nbsp;</font> Tardanza &nbsp;·&nbsp; "
        "<font backColor='#FEE2E2'>&nbsp;A&nbsp;</font> Ausente &nbsp;·&nbsp; "
        "<font backColor='#E5E7EB'>&nbsp;J&nbsp;</font> Justificada"
    )
    elementos.append(Paragraph(leyenda_txt, styles["Normal"]))

    # Firmas
    elementos.append(Spacer(1, 24))
    firmas_data = [[
        Paragraph("_" * 40 + "<br/>Tutor(a) de sección", styles["Normal"]),
        Paragraph("_" * 40 + "<br/>Auxiliar / Subdirección", styles["Normal"]),
        Paragraph("_" * 40 + "<br/>Dirección", styles["Normal"]),
    ]]
    firmas_tabla = Table(firmas_data, colWidths=[9 * cm, 9 * cm, 9 * cm])
    firmas_tabla.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    elementos.append(firmas_tabla)

    doc.build(elementos)
    return buffer.getvalue()
