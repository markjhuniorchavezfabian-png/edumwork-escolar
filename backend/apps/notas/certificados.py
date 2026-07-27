"""Generación de Certificado de Estudios en PDF — formato estándar MINEDU (R.D. 0072-2005-ED).

Genera un certificado por alumno con:
  - Membrete institucional (nombre, código modular, UGEL, DRE, logo)
  - Datos del estudiante
  - Tabla de notas por año: Año | Grado | Sección | Áreas con NL final
  - Placeholder "Ver expediente" para años sin datos en el sistema
  - Espacio para firma del director y sello
"""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image


AZUL = colors.HexColor("#1e3a5f")
GRIS = colors.HexColor("#64748b")
GRIS_CLARO = colors.HexColor("#f1f5f9")
NEGRO = colors.black

# Áreas en el orden oficial MINEDU para mostrar en el certificado
ORDEN_AREAS = [
    "Comunicación", "Matemática", "Ciencia y Tecnología",
    "Historia, Geografía y Economía", "Ciencias Sociales", "Personal Social",
    "Inglés", "Arte y Cultura", "Educación Física",
    "Educación Religiosa", "DPCC", "Tutoría",
    "Desarrollo Personal", "Ciencias Sociales",
]


def _nota_final_por_area(notas_qs):
    """Determina la nota 'final' por área:
    1. Usa B4 (cuarto bimestre) si existe.
    2. Si no, usa el bimestre más alto disponible.
    3. Si hay múltiples competencias, usa la de mayor logro (AD>A>B>C).
    Devuelve dict {area: nl_string}
    """
    ORDEN = {"AD": 0, "A": 1, "B": 2, "C": 3, "": 99}
    por_area: dict = {}

    for nota in notas_qs:
        area = nota.area
        nl = nota.calificacion or ""
        bim = int(nota.bimestre or 0)
        if area not in por_area:
            por_area[area] = {"nl": nl, "bim": bim}
        else:
            prev = por_area[area]
            # Preferir bimestre más alto; dentro del mismo bimestre, mejor NL
            if bim > prev["bim"] or (bim == prev["bim"] and ORDEN.get(nl, 99) < ORDEN.get(prev["nl"], 99)):
                por_area[area] = {"nl": nl, "bim": bim}

    return {area: v["nl"] for area, v in por_area.items()}


def generar_certificado_pdf(estudiante, desde_anio: int, hasta_anio: int) -> bytes:
    """Genera el PDF del certificado de estudios.

    Args:
        estudiante: Instancia de Estudiante (con .usuario, .seccion_obj, etc.)
        desde_anio: Primer año a incluir
        hasta_anio: Último año a incluir (inclusive)
    """
    from apps.core.models import ConfiguracionInstitucional
    from apps.notas.models import NotaBimestre

    cfg_inst = ConfiguracionInstitucional.get_solo()
    styles = getSampleStyleSheet()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
    )

    elem = []

    # ── Membrete institucional ──────────────────────────────────────────────
    p_inst = ParagraphStyle("inst", parent=styles["Normal"], alignment=1,
                            fontSize=13, fontName="Helvetica-Bold",
                            textColor=AZUL, spaceAfter=2)
    p_sub = ParagraphStyle("sub", parent=styles["Normal"], alignment=1,
                           fontSize=9, textColor=GRIS, spaceAfter=1)

    nombre_ie = cfg_inst.nombre_institucion.upper() if cfg_inst.nombre_institucion else "INSTITUCIÓN EDUCATIVA"
    elem.append(Paragraph(nombre_ie, p_inst))

    sub_parts = []
    if cfg_inst.codigo_modular:
        sub_parts.append(f"Código Modular: {cfg_inst.codigo_modular}")
    if cfg_inst.ugel:
        sub_parts.append(cfg_inst.ugel)
    if cfg_inst.dre:
        sub_parts.append(cfg_inst.dre)
    if sub_parts:
        elem.append(Paragraph(" · ".join(sub_parts), p_sub))
    if cfg_inst.direccion:
        elem.append(Paragraph(cfg_inst.direccion, p_sub))

    elem.append(Spacer(1, 0.5 * cm))

    # Línea separadora
    tabla_sep = Table([[""]], colWidths=[doc.width])
    tabla_sep.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, -1), 1.5, AZUL),
    ]))
    elem.append(tabla_sep)
    elem.append(Spacer(1, 0.4 * cm))

    # ── Título ─────────────────────────────────────────────────────────────
    p_titulo = ParagraphStyle("tit", parent=styles["Heading1"], alignment=1,
                              fontSize=15, fontName="Helvetica-Bold",
                              textColor=AZUL, spaceBefore=4, spaceAfter=4)
    elem.append(Paragraph("CERTIFICADO DE ESTUDIOS", p_titulo))
    elem.append(Spacer(1, 0.3 * cm))

    # ── Texto de certificación ──────────────────────────────────────────────
    director_nombre = ""
    try:
        from apps.usuarios.models import Usuario
        director = Usuario.objects.filter(rol="director", activo=True).first()
        if director:
            director_nombre = director.get_full_name() or director.username
    except Exception:
        pass

    p_texto = ParagraphStyle("txt", parent=styles["Normal"], fontSize=10,
                             leading=16, spaceAfter=6)

    u = estudiante.usuario
    nombre_est = f"{u.last_name.upper()}, {u.first_name.upper()}".strip() or u.username.upper()
    dni_est = u.dni or "—"

    try:
        fecha_nac = estudiante.fecha_nacimiento.strftime("%d de %B de %Y") if estudiante.fecha_nacimiento else "—"
    except Exception:
        fecha_nac = "—"

    cargo = f"EL DIRECTOR DE {nombre_ie}"
    elem.append(Paragraph(cargo, ParagraphStyle("cargo", parent=styles["Normal"], fontSize=10,
                                                 fontName="Helvetica-Bold", spaceAfter=6)))

    elem.append(Paragraph("CERTIFICA:", ParagraphStyle("cert", parent=styles["Normal"], fontSize=10,
                                                        fontName="Helvetica-Bold", spaceAfter=8)))

    texto_cert = (
        f"Que el/la estudiante <b>{nombre_est}</b>, con DNI N° <b>{dni_est}</b>, "
        f"nacido(a) el <b>{fecha_nac}</b>, cursó estudios en esta Institución Educativa "
        f"obteniendo las siguientes calificaciones:"
    )
    elem.append(Paragraph(texto_cert, p_texto))
    elem.append(Spacer(1, 0.3 * cm))

    # ── Tabla de notas por año ──────────────────────────────────────────────
    # Recopilar todos los años y sus áreas
    todos_los_anios = list(range(desde_anio, hasta_anio + 1))

    # Obtener todas las notas en el rango
    notas_rango = NotaBimestre.objects.filter(
        estudiante=estudiante,
        anio_lectivo__gte=desde_anio,
        anio_lectivo__lte=hasta_anio,
    ).order_by("anio_lectivo", "area", "bimestre", "competencia")

    # Agrupar por año
    notas_por_anio: dict = {}
    for nota in notas_rango:
        notas_por_anio.setdefault(nota.anio_lectivo, []).append(nota)

    # Obtener info de sección por año (aproximación: usar la sección actual)
    # En un sistema ideal tendríamos historial de secciones
    seccion_actual = estudiante.seccion_obj
    grado_actual = estudiante.grado or (seccion_actual.grado if seccion_actual else "")
    letra_actual = estudiante.seccion or (seccion_actual.letra if seccion_actual else "")

    # Calcular el grado retroactivo (suposición simple)
    GRADOS = ["1ro", "2do", "3ro", "4to", "5to", "6to"]
    anio_activo = hasta_anio

    def _grado_para_anio(anio):
        """Aproxima el grado del alumno en un año dado."""
        if grado_actual in GRADOS:
            diff = anio_activo - anio
            idx_actual = GRADOS.index(grado_actual)
            idx_pasado = idx_actual - diff
            if 0 <= idx_pasado < len(GRADOS):
                return GRADOS[idx_pasado]
        return grado_actual or "—"

    # Determinar áreas a mostrar (unión de todas las áreas con datos)
    areas_con_datos: set = set()
    for notas_list in notas_por_anio.values():
        for n in notas_list:
            areas_con_datos.add(n.area)
    # Ordenar según ORDEN_AREAS
    areas_ordenadas = [a for a in ORDEN_AREAS if a in areas_con_datos]
    areas_ordenadas += [a for a in sorted(areas_con_datos) if a not in ORDEN_AREAS]

    if not areas_ordenadas:
        areas_ordenadas = ["Sin áreas registradas"]

    # Encabezados de la tabla
    header = ["Año", "Grado\nSección"] + areas_ordenadas
    col_año = 1.2 * cm
    col_grado = 1.6 * cm
    col_area = (doc.width - col_año - col_grado) / max(len(areas_ordenadas), 1)
    col_area = max(col_area, 1.2 * cm)  # mínimo 1.2cm

    col_widths = [col_año, col_grado] + [col_area] * len(areas_ordenadas)

    estilo_header = ParagraphStyle("th", parent=styles["Normal"], fontSize=7,
                                   alignment=1, fontName="Helvetica-Bold", textColor=colors.white)
    estilo_area = ParagraphStyle("area_h", parent=styles["Normal"], fontSize=6,
                                 alignment=1, fontName="Helvetica-Bold", textColor=colors.white,
                                 leading=8)
    estilo_celda = ParagraphStyle("td", parent=styles["Normal"], fontSize=8,
                                  alignment=1, fontName="Helvetica-Bold")
    estilo_placeholder = ParagraphStyle("ph", parent=styles["Normal"], fontSize=6,
                                        alignment=1, textColor=GRIS, fontName="Helvetica-Oblique")

    tabla_data = [[
        Paragraph("AÑO", estilo_header),
        Paragraph("GRADO\nSECC.", estilo_header),
    ] + [Paragraph(a.upper(), estilo_area) for a in areas_ordenadas]]

    nl_colors = {
        "AD": colors.HexColor("#dcfce7"),
        "A": colors.HexColor("#dbeafe"),
        "B": colors.HexColor("#fef3c7"),
        "C": colors.HexColor("#fee2e2"),
    }

    fila_styles = []

    for fila_idx, anio in enumerate(todos_los_anios):
        row_num = fila_idx + 1  # +1 por header
        grado_anio = _grado_para_anio(anio)

        if anio in notas_por_anio:
            nota_final = _nota_final_por_area(notas_por_anio[anio])
            fila = [
                Paragraph(str(anio), ParagraphStyle("year", parent=styles["Normal"],
                           fontSize=8, alignment=1, fontName="Helvetica-Bold")),
                Paragraph(f"{grado_anio}\n{letra_actual}", ParagraphStyle("grado",
                           parent=styles["Normal"], fontSize=7, alignment=1, leading=9)),
            ]
            for col_idx, area in enumerate(areas_ordenadas):
                nl = nota_final.get(area, "")
                fila.append(Paragraph(nl or "—", estilo_celda))
                if nl and nl in nl_colors:
                    fila_styles.append(("BACKGROUND", (col_idx + 2, row_num),
                                        (col_idx + 2, row_num), nl_colors[nl]))
        else:
            # Año sin datos
            fila = [
                Paragraph(str(anio), ParagraphStyle("year", parent=styles["Normal"],
                           fontSize=8, alignment=1)),
                Paragraph("—", ParagraphStyle("grado", parent=styles["Normal"],
                           fontSize=7, alignment=1)),
            ] + [Paragraph("*", estilo_placeholder)] * len(areas_ordenadas)
            fila_styles.append(("BACKGROUND", (0, row_num), (-1, row_num),
                                colors.HexColor("#f8fafc")))

        tabla_data.append(fila)

    tabla = Table(tabla_data, colWidths=col_widths, repeatRows=1)
    tabla.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("ROWBACKGROUND", (0, 1), (-1, -1), [colors.white, GRIS_CLARO]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ] + fila_styles))

    elem.append(tabla)
    elem.append(Spacer(1, 0.3 * cm))

    # Leyenda placeholder
    if any(anio not in notas_por_anio for anio in todos_los_anios):
        p_ley = ParagraphStyle("ley", parent=styles["Normal"], fontSize=7,
                               textColor=GRIS, fontName="Helvetica-Oblique")
        elem.append(Paragraph(
            "* Año sin datos en el sistema — completar manualmente con el expediente físico.",
            p_ley
        ))
        elem.append(Spacer(1, 0.2 * cm))

    # Leyenda NL
    p_ley = ParagraphStyle("ley", parent=styles["Normal"], fontSize=7, textColor=GRIS)
    elem.append(Paragraph(
        "AD = Logro destacado  |  A = Logro esperado  |  B = En proceso  |  C = En inicio  "
        "(Escala RVM 094-2020-MINEDU)",
        p_ley
    ))
    elem.append(Spacer(1, 0.5 * cm))

    # ── Texto de expedición ────────────────────────────────────────────────
    from django.utils import timezone
    hoy = timezone.localdate()
    meses = ["enero","febrero","marzo","abril","mayo","junio",
             "julio","agosto","septiembre","octubre","noviembre","diciembre"]
    lugar = cfg_inst.direccion.split(",")[0] if cfg_inst.direccion else "Huánuco"
    fecha_str = f"{lugar}, {hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"

    elem.append(Paragraph(
        f"Se expide el presente certificado a solicitud del interesado(a), para los fines "
        f"que crea conveniente.",
        p_texto
    ))
    elem.append(Spacer(1, 0.2 * cm))
    elem.append(Paragraph(fecha_str, ParagraphStyle("fecha", parent=styles["Normal"],
                                                      fontSize=10, alignment=2)))
    elem.append(Spacer(1, 1.5 * cm))

    # ── Firma ──────────────────────────────────────────────────────────────
    firma_data = [
        ["", ""],
        ["_" * 35, ""],
        [f"DIRECTOR(A)", ""],
        [director_nombre.upper() if director_nombre else "________________________", ""],
        [f"{nombre_ie}", ""],
    ]
    tabla_firma = Table(firma_data, colWidths=[doc.width * 0.5, doc.width * 0.5])
    tabla_firma.setStyle(TableStyle([
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("FONTNAME", (0, 2), (0, 2), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elem.append(tabla_firma)

    elem.append(Spacer(1, 0.5 * cm))

    # Sello placeholder
    elem.append(Paragraph(
        "<i>(Sello oficial de la Institución Educativa)</i>",
        ParagraphStyle("sello", parent=styles["Normal"], fontSize=8,
                       textColor=GRIS, fontName="Helvetica-Oblique", alignment=1)
    ))

    doc.build(elem)
    return buf.getvalue()
