"""Generación de boletas de notas oficiales en PDF (formato MINEDU).

Formato: "Informe de Progreso del Aprendizaje del Estudiante" según RVM 094-2020-MINEDU.
Tres versiones: inicial, primaria, secundaria.
"""
import io
import zipfile
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image,
)

AZUL = colors.HexColor("#1e3a5f")
AZUL_CLARO = colors.HexColor("#dbeafe")
GRIS = colors.HexColor("#f1f5f9")
GRIS_BORDE = colors.HexColor("#94a3b8")
GRIS_BORDE_FINO = colors.HexColor("#cbd5e1")

COLOR_NL = {
    "AD": colors.HexColor("#bbf7d0"),
    "A":  colors.HexColor("#bfdbfe"),
    "B":  colors.HexColor("#fef9c3"),
    "C":  colors.HexColor("#fecaca"),
}

ETIQUETAS_LOGRO = {
    "AD": "Logro destacado",
    "A":  "Logro esperado",
    "B":  "En proceso",
    "C":  "En inicio",
}

BIMESTRE_TXT = {"1": "1°", "2": "2°", "3": "3°", "4": "4°"}


def _cfg_institucional():
    from apps.core.models import ConfiguracionInstitucional
    from apps.usuarios.models import Rol, Usuario
    obj = ConfiguracionInstitucional.objects.first()
    cfg = {
        "nombre":          obj.nombre_institucion if obj else "Institución Educativa",
        "codigo_modular":  obj.codigo_modular if obj else "",
        "ugel":            obj.ugel if obj else "",
        "dre":             obj.dre if obj else "",
        "direccion":       obj.direccion if obj else "",
        "director_nombre": "",
        "logo_path":       None,
        "anio":            (obj.anio_lectivo_activo if obj else None) or datetime.now().year,
    }
    if obj and obj.logo and obj.logo.name:
        try:
            cfg["logo_path"] = obj.logo.path
        except Exception:
            pass
    director = Usuario.objects.filter(rol=Rol.DIRECTOR, is_active=True).first()
    if director:
        cfg["director_nombre"] = f"{director.first_name} {director.last_name}".strip() or director.username
    return cfg


def _tutor_nombre(estudiante):
    if estudiante.seccion_obj and estudiante.seccion_obj.tutor:
        t = estudiante.seccion_obj.tutor
        return f"{t.first_name} {t.last_name}".strip() or t.username
    return ""


def _p(text, style):
    return Paragraph(str(text), style)


def _cabecera(cfg, estudiante, bimestre, anio, elementos, styles):
    """Encabezado institucional + datos del estudiante — igual al formato MINEDU."""
    s_titulo = ParagraphStyle("tit", parent=styles["Heading1"], alignment=1,
                              fontSize=10, textColor=colors.white,
                              backColor=AZUL, borderPadding=5)
    s_cel = ParagraphStyle("cel", parent=styles["Normal"], fontSize=8)
    s_lbl = ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8,
                           fontName="Helvetica-Bold")

    u = estudiante.usuario
    sec = estudiante.seccion_obj
    nivel_txt = (sec.nivel.upper() if sec and sec.nivel else "")
    if sec and sec.nombre:
        grado_txt = sec.nombre
    elif sec:
        grado_txt = f"{sec.grado or estudiante.grado or ''} {estudiante.seccion or ''}".strip()
    else:
        grado_txt = f"{estudiante.grado or ''} {estudiante.seccion or ''}".strip()

    titulo = (f"INFORME DE PROGRESO DEL APRENDIZAJE DEL ESTUDIANTE — "
              f"Bimestre {bimestre} · Año lectivo {anio}")

    # Logo + título en fila
    logo_path = cfg.get("logo_path")
    if logo_path:
        try:
            logo_img = Image(logo_path, width=1.8*cm, height=1.8*cm)
            s_tit_inner = ParagraphStyle("tit2", parent=styles["Normal"], alignment=1,
                                         fontSize=10, textColor=colors.white,
                                         fontName="Helvetica-Bold")
            t_banner = Table(
                [[logo_img, _p(titulo, s_tit_inner)]],
                colWidths=[2.2*cm, 15.3*cm],
            )
            t_banner.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), AZUL),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            elementos.append(t_banner)
        except Exception:
            elementos.append(_p(titulo, s_titulo))
    else:
        elementos.append(_p(titulo, s_titulo))

    elementos.append(Spacer(1, 0.2 * cm))

    # Tabla de datos institucionales + alumno
    datos = [
        [_p("DRE:", s_lbl), _p(cfg.get("dre", ""), s_cel),
         _p("UGEL:", s_lbl), _p(cfg.get("ugel", ""), s_cel)],
        [_p("Nivel:", s_lbl), _p(nivel_txt, s_cel),
         _p("Código Modular:", s_lbl), _p(cfg.get("codigo_modular", ""), s_cel)],
        [_p("Institución Educativa:", s_lbl),
         _p(cfg.get("nombre", ""), s_cel), "", ""],
        [_p("Grado y sección:", s_lbl), _p(grado_txt, s_cel),
         _p("Año lectivo:", s_lbl), _p(str(anio), s_cel)],
        [_p("Apellidos y nombres:", s_lbl),
         _p(f"{u.last_name}, {u.first_name}".strip(), s_cel), "", ""],
        [_p("Código del estudiante:", s_lbl),
         _p(estudiante.codigo_matricula or "—", s_cel),
         _p("DNI:", s_lbl), _p(u.dni or "—", s_cel)],
    ]
    t = Table(datos, colWidths=[3.8*cm, 6.2*cm, 3.2*cm, 4.3*cm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (0, -1), GRIS),
        ("BACKGROUND", (2, 0), (2, -1), GRIS),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("SPAN", (1, 2), (3, 2)),   # nombre IE ocupa 3 cols
        ("SPAN", (1, 4), (3, 4)),   # apellidos ocupa 3 cols
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elementos.append(t)
    elementos.append(Spacer(1, 0.3 * cm))


def _leyenda_y_firmas(cfg, tutor, elementos, styles):
    """Escala CNEB + firmas — al pie de la boleta."""
    s8 = ParagraphStyle("s8", parent=styles["Normal"], fontSize=8)
    s8b = ParagraphStyle("s8b", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold")
    s8c = ParagraphStyle("s8c", parent=styles["Normal"], fontSize=8, alignment=1)
    s7i = ParagraphStyle("s7i", parent=styles["Normal"], fontSize=7,
                         textColor=colors.HexColor("#64748b"))

    # Escala CNEB
    escala_data = [
        [_p("ESCALA DE CALIFICACIONES DEL CNEB", s8b), "", "", ""],
        [_p("AD", s8b), _p("Logro destacado", s8), _p("A", s8b), _p("Logro esperado", s8)],
        [_p("B", s8b),  _p("En proceso", s8),      _p("C", s8b), _p("En inicio", s8)],
    ]
    t_escala = Table(escala_data, colWidths=[1*cm, 4*cm, 1*cm, 4*cm])
    t_escala.setStyle(TableStyle([
        ("SPAN", (0, 0), (3, 0)),
        ("BACKGROUND", (0, 0), (-1, 0), GRIS),
        ("BACKGROUND", (0, 1), (0, 1), COLOR_NL["AD"]),
        ("BACKGROUND", (2, 1), (2, 1), COLOR_NL["A"]),
        ("BACKGROUND", (0, 2), (0, 2), COLOR_NL["B"]),
        ("BACKGROUND", (2, 2), (2, 2), COLOR_NL["C"]),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))

    # Firmas
    s_firma = ParagraphStyle("firma", parent=styles["Normal"], alignment=1, fontSize=8)
    s_linea = ParagraphStyle("linea", parent=styles["Normal"], alignment=1,
                             fontSize=9, textColor=colors.HexColor("#94a3b8"))
    director = cfg.get("director_nombre") or "Director(a)"
    t_firmas = Table([
        [_p("_" * 28, s_linea), "", _p("_" * 28, s_linea)],
        [_p(tutor or "Docente / Tutor(a)", s_firma), "",
         _p(director, s_firma)],
        [_p("Firma y sello del Docente o Tutor(a)", s_firma), "",
         _p("Firma y sello del Director(a)", s_firma)],
    ], colWidths=[8*cm, 1.5*cm, 8*cm])
    t_firmas.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    elementos.append(Spacer(1, 0.4*cm))
    elementos.append(t_escala)
    elementos.append(Spacer(1, 0.3*cm))
    elementos.append(t_firmas)
    elementos.append(Spacer(1, 0.2*cm))
    elementos.append(_p(
        f"Emitido el {datetime.now().strftime('%d/%m/%Y a las %H:%M')} · SIAGIE / Sistematic Escolar",
        ParagraphStyle("pie", parent=styles["Normal"], alignment=1, fontSize=7,
                       textColor=colors.HexColor("#94a3b8"))
    ))


# ─── PRIMARIA ────────────────────────────────────────────────────────────────

def _tabla_primaria(notas_qs, competencias_cneb, bimestre, elementos, styles):
    """Tabla principal estilo MINEDU para primaria: área → competencias → B1-B4."""
    s_hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontSize=7,
                           fontName="Helvetica-Bold", textColor=colors.white, alignment=1)
    s_area = ParagraphStyle("area", parent=styles["Normal"], fontSize=8,
                            fontName="Helvetica-Bold")
    s_comp = ParagraphStyle("comp", parent=styles["Normal"], fontSize=7)
    s_nl = ParagraphStyle("nl", parent=styles["Normal"], fontSize=9,
                          fontName="Helvetica-Bold", alignment=1)
    s_conc = ParagraphStyle("conc", parent=styles["Normal"], fontSize=7,
                            textColor=colors.HexColor("#334155"))

    # Organizar notas: {area: {competencia: {bimestre: (calificacion, conclusion)}}}
    from collections import defaultdict
    notas_org: dict = defaultdict(lambda: defaultdict(dict))
    for n in notas_qs:
        notas_org[n.area][n.competencia][str(n.bimestre)] = (
            n.calificacion or "—",
            n.conclusion_descriptiva or "",
        )

    # Nombres de competencias del CNEB: {area_nombre: {indice: nombre}}
    comp_nombres: dict = {}
    if competencias_cneb:
        for c in competencias_cneb:
            area_n = c.get("area_nombre", "")
            idx = c.get("orden", c.get("id", 0))
            comp_nombres.setdefault(area_n, {})[idx] = c.get("nombre", "")

    header = [
        _p("ÁREA CURRICULAR", s_hdr),
        _p("COMPETENCIAS", s_hdr),
        _p("B1", s_hdr), _p("B2", s_hdr), _p("B3", s_hdr), _p("B4", s_hdr),
        _p("Calif.\nanual\ncomp.", s_hdr),
        _p("Calif.\nanual\nárea", s_hdr),
        _p("Conclusión descriptiva", s_hdr),
    ]
    data = [header]
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (2, 0), (7, 0), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS]),
    ]

    if not notas_org:
        data.append([_p("Sin notas cargadas.", s_comp), "", "", "", "", "", "", "", ""])
    else:
        for area, comps in sorted(notas_org.items()):
            area_start = len(data)
            num_comps = len(comps)

            # Calcular calificativo anual de área (promedio RVM 048 de los 4 bimestres)
            calif_anual_area = _consolidado_anual_area(notas_org[area])

            for ci, (comp_idx, bims) in enumerate(sorted(comps.items())):
                nombre_comp = ""
                for an, cn in comp_nombres.items():
                    if area.lower() in an.lower() or an.lower() in area.lower():
                        nombre_comp = cn.get(comp_idx, f"Competencia {comp_idx}")
                        break
                if not nombre_comp:
                    nombre_comp = f"Competencia {comp_idx}"

                # Calificativo anual de la competencia
                nl_vals = [bims.get(b, ("—", ""))[0] for b in ("1","2","3","4")]
                calif_anual_comp = _consolidado_nl(nl_vals)

                # Conclusión del bimestre actual (o el más reciente)
                conc = bims.get(str(bimestre), ("", ""))[1]
                if not conc:
                    for b in ("4","3","2","1"):
                        conc = bims.get(b, ("",""))[1]
                        if conc:
                            break

                nl_b = {b: bims.get(b, ("—",""))[0] for b in ("1","2","3","4")}

                row = [
                    _p(area if ci == 0 else "", s_area),
                    _p(nombre_comp, s_comp),
                    _p(nl_b["1"], s_nl), _p(nl_b["2"], s_nl),
                    _p(nl_b["3"], s_nl), _p(nl_b["4"], s_nl),
                    _p(calif_anual_comp, s_nl),
                    _p(calif_anual_area if ci == 0 else "", s_nl),
                    _p(conc if ci == 0 else "", s_conc),
                ]
                data.append(row)

                # Colorear celdas NL
                ri = len(data) - 1
                for bi, bk in enumerate(("1","2","3","4"), start=2):
                    nl = nl_b[bk]
                    if nl in COLOR_NL:
                        style_cmds.append(("BACKGROUND", (bi, ri), (bi, ri), COLOR_NL[nl]))
                if calif_anual_comp in COLOR_NL:
                    style_cmds.append(("BACKGROUND", (6, ri), (6, ri), COLOR_NL[calif_anual_comp]))

            area_end = len(data) - 1
            if num_comps > 1:
                style_cmds.append(("SPAN", (0, area_start), (0, area_end)))
                style_cmds.append(("SPAN", (7, area_start), (7, area_end)))
                style_cmds.append(("SPAN", (8, area_start), (8, area_end)))
                if calif_anual_area in COLOR_NL:
                    style_cmds.append(("BACKGROUND", (7, area_start), (7, area_end), COLOR_NL[calif_anual_area]))

    t = Table(data, colWidths=[2.5*cm, 5.5*cm, 0.8*cm, 0.8*cm, 0.8*cm, 0.8*cm, 1.0*cm, 1.0*cm, 4.3*cm])
    t.setStyle(TableStyle(style_cmds))
    elementos.append(t)
    elementos.append(Spacer(1, 0.3*cm))


def _tabla_conclusiones_primaria(notas_qs, bimestre, elementos, styles):
    """Tabla de conclusiones por periodo — solo primaria."""
    s_hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontSize=7,
                           fontName="Helvetica-Bold", textColor=colors.white, alignment=1)
    s7 = ParagraphStyle("s7", parent=styles["Normal"], fontSize=7)
    s7b = ParagraphStyle("s7b", parent=styles["Normal"], fontSize=7, fontName="Helvetica-Bold")

    from collections import defaultdict
    conclusiones: dict = defaultdict(str)
    for n in notas_qs:
        if n.competencia == 1 and n.conclusion_descriptiva:
            key = str(n.bimestre)
            if not conclusiones[key]:
                conclusiones[key] = n.conclusion_descriptiva

    data = [[_p("PERIODO", s_hdr), _p("CONCLUSIÓN DESCRIPTIVA POR PERIODO", s_hdr)]]
    for b in ("1","2","3","4"):
        data.append([_p(f"Bimestre {b}", s7b), _p(conclusiones.get(b, ""), s7)])

    t = Table(data, colWidths=[2.5*cm, 15*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS]),
        ("MINROWHEIGHT", (0, 1), (-1, -1), 1.0*cm),
    ]))
    elementos.append(t)


# ─── SECUNDARIA ──────────────────────────────────────────────────────────────

def _tabla_secundaria(notas_qs, competencias_cneb, bimestre, grado, elementos, styles):
    """Tabla para secundaria: notas numéricas 0-20 por competencia y bimestre."""
    s_hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontSize=7,
                           fontName="Helvetica-Bold", textColor=colors.white, alignment=1)
    s_area = ParagraphStyle("area", parent=styles["Normal"], fontSize=8,
                            fontName="Helvetica-Bold")
    s_comp = ParagraphStyle("comp", parent=styles["Normal"], fontSize=7)
    s_num = ParagraphStyle("num", parent=styles["Normal"], fontSize=9,
                           fontName="Helvetica-Bold", alignment=1)
    s_conc = ParagraphStyle("conc", parent=styles["Normal"], fontSize=7)

    from collections import defaultdict
    notas_org: dict = defaultdict(lambda: defaultdict(dict))
    NUM_POR_LETRA = {"AD": 19, "A": 15, "B": 12, "C": 8, "—": "—"}
    for n in notas_qs:
        nl = n.calificacion or "—"
        num = int(n.calificacion_numerica) if n.calificacion_numerica else NUM_POR_LETRA.get(nl, "—")
        notas_org[n.area][n.competencia][str(n.bimestre)] = (nl, num, n.conclusion_descriptiva or "")

    comp_nombres: dict = {}
    if competencias_cneb:
        for c in competencias_cneb:
            area_n = c.get("area_nombre", "")
            idx = c.get("orden", c.get("id", 0))
            comp_nombres.setdefault(area_n, {})[idx] = c.get("nombre", "")

    # 1° de secundaria tiene conclusión descriptiva; 2°-5° no
    try:
        grado_num = int(''.join(filter(str.isdigit, str(grado))))
    except Exception:
        grado_num = 2
    mostrar_conclusion = grado_num <= 1

    cols_extra = [_p("Conclusión descriptiva", s_hdr)] if mostrar_conclusion else []
    anchos_extra = [3.5*cm] if mostrar_conclusion else []

    header = [
        _p("ÁREA CURRICULAR", s_hdr),
        _p("COMPETENCIAS", s_hdr),
        _p("B1", s_hdr), _p("B2", s_hdr), _p("B3", s_hdr), _p("B4", s_hdr),
        _p("Prom.\nanual", s_hdr),
    ] + cols_extra

    data = [header]
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("ALIGN", (2, 0), (6, 0), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS]),  # empieza en 1, no sobreescribe header
    ]

    if not notas_org:
        data.append([_p("Sin notas cargadas.", s_comp)] + [""] * (6 + len(cols_extra)))
    else:
        for area, comps in sorted(notas_org.items()):
            area_start = len(data)
            num_comps = len(comps)

            nums_area = []
            for ci, (comp_idx, bims) in enumerate(sorted(comps.items())):
                nombre_comp = f"Competencia {comp_idx}"
                for an, cn in comp_nombres.items():
                    if area.lower() in an.lower() or an.lower() in area.lower():
                        nombre_comp = cn.get(comp_idx, nombre_comp)
                        break

                num_vals = [bims.get(b, ("—", "—", ""))[1] for b in ("1","2","3","4")]
                nums_validos = [v for v in num_vals if isinstance(v, int)]
                prom = round(sum(nums_validos)/len(nums_validos)) if nums_validos else "—"
                if isinstance(prom, int):
                    nums_area.append(prom)

                conc = bims.get(str(bimestre), ("","",""))[2]
                if not conc:
                    for b in ("4","3","2","1"):
                        conc = bims.get(b, ("","",""))[2]
                        if conc:
                            break

                def _fmt(v): return str(v) if v != "—" else "—"

                row = [
                    _p(area if ci == 0 else "", s_area),
                    _p(nombre_comp, s_comp),
                    _p(_fmt(num_vals[0]), s_num), _p(_fmt(num_vals[1]), s_num),
                    _p(_fmt(num_vals[2]), s_num), _p(_fmt(num_vals[3]), s_num),
                    _p(_fmt(prom), s_num),
                ]
                if mostrar_conclusion:
                    row.append(_p(conc if ci == 0 else "", s_conc))
                data.append(row)

                # Color fondo según rango
                ri = len(data) - 1
                for bi, bk in enumerate(("1","2","3","4"), start=2):
                    val = num_vals[bi-2]
                    if isinstance(val, int):
                        bg = _color_num(val)
                        style_cmds.append(("BACKGROUND", (bi, ri), (bi, ri), bg))
                if isinstance(prom, int):
                    style_cmds.append(("BACKGROUND", (6, ri), (6, ri), _color_num(prom)))

            area_end = len(data) - 1
            if num_comps > 1:
                style_cmds.append(("SPAN", (0, area_start), (0, area_end)))
                if mostrar_conclusion:
                    style_cmds.append(("SPAN", (7, area_start), (7, area_end)))

    anchos = [2.5*cm, 5.5*cm, 1.0*cm, 1.0*cm, 1.0*cm, 1.0*cm, 1.2*cm] + anchos_extra
    # Ajustar última columna para llenar ancho
    total = sum(anchos)
    disponible = 17.5*cm
    if total < disponible:
        anchos[-1] += disponible - total

    t = Table(data, colWidths=anchos)
    t.setStyle(TableStyle(style_cmds))
    elementos.append(t)


def _color_num(n):
    if n >= 17: return COLOR_NL["AD"]
    if n >= 14: return COLOR_NL["A"]
    if n >= 11: return COLOR_NL["B"]
    return COLOR_NL["C"]


# ─── INICIAL ─────────────────────────────────────────────────────────────────

def _tabla_inicial(notas_qs, bimestre, elementos, styles):
    """Tabla para inicial: áreas con calificativo y conclusión descriptiva."""
    s_hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontSize=7,
                           fontName="Helvetica-Bold", textColor=colors.white, alignment=1)
    s_area = ParagraphStyle("area", parent=styles["Normal"], fontSize=8,
                            fontName="Helvetica-Bold")
    s_nl = ParagraphStyle("nl", parent=styles["Normal"], fontSize=10,
                          fontName="Helvetica-Bold", alignment=1)
    s_etq = ParagraphStyle("etq", parent=styles["Normal"], fontSize=8)
    s_conc = ParagraphStyle("conc", parent=styles["Normal"], fontSize=7)

    from collections import defaultdict
    notas_org: dict = {}
    for n in notas_qs:
        if n.area not in notas_org:
            notas_org[n.area] = {"nl": n.calificacion or "—", "conc": n.conclusion_descriptiva or ""}

    data = [[
        _p("ÁREA / CAMPO DE EXPERIENCIA", s_hdr),
        _p("NL", s_hdr),
        _p("Nivel de logro", s_hdr),
        _p("Conclusión descriptiva del periodo", s_hdr),
    ]]
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS]),  # empieza en 1
        ("MINROWHEIGHT", (0, 1), (-1, -1), 1.0*cm),
    ]

    if not notas_org:
        data.append([_p("Sin notas cargadas.", s_area), "", "", ""])
    else:
        for ri, (area, vals) in enumerate(sorted(notas_org.items()), start=1):
            nl = vals["nl"]
            etq = ETIQUETAS_LOGRO.get(nl, nl)
            data.append([
                _p(area, s_area),
                _p(nl, s_nl),
                _p(etq, s_etq),
                _p(vals["conc"], s_conc),
            ])
            if nl in COLOR_NL:
                style_cmds.append(("BACKGROUND", (1, ri), (1, ri), COLOR_NL[nl]))

    t = Table(data, colWidths=[4.0*cm, 1.2*cm, 3.0*cm, 9.3*cm])
    t.setStyle(TableStyle(style_cmds))
    elementos.append(t)


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _consolidado_nl(niveles: list) -> str:
    PUNTOS = {"AD": 4, "A": 3, "B": 2.5, "C": 1}
    vals = [PUNTOS[n] for n in niveles if n in PUNTOS]
    if not vals:
        return "—"
    score = (sum(vals) / (len(vals) * 4)) * 10
    if score >= 8.75: return "AD"
    if score >= 6.875: return "A"
    if score >= 4.375: return "B"
    return "C"


def _consolidado_anual_area(comps_dict: dict) -> str:
    """Consolida todas las competencias de un área en un calificativo anual."""
    todos = []
    for bims in comps_dict.values():
        for b in ("1","2","3","4"):
            nl = bims.get(b, ("—",""))[0]
            if nl != "—":
                todos.append(nl)
    return _consolidado_nl(todos)


# ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

def generar_boleta_pdf(estudiante, bimestre: str, anio: int = None) -> bytes:
    """Genera el PDF de boleta según el nivel del estudiante (inicial/primaria/secundaria)."""
    from apps.notas.models import NotaBimestre
    from apps.curricula.models import Competencia

    cfg = _cfg_institucional()
    anio = anio or cfg["anio"]
    tutor = _tutor_nombre(estudiante)

    notas_qs = NotaBimestre.objects.filter(
        estudiante=estudiante, anio_lectivo=anio,
    ).order_by("area", "competencia", "bimestre")

    # Nivel del estudiante
    nivel = "primaria"
    grado = estudiante.grado or ""
    if estudiante.seccion_obj:
        nivel = estudiante.seccion_obj.nivel or "primaria"
        grado = estudiante.seccion_obj.grado or grado

    # Cargar competencias CNEB para el nivel
    comp_cneb = []
    try:
        comps_qs = Competencia.objects.filter(area__nivel=nivel).select_related("area")
        for c in comps_qs:
            comp_cneb.append({
                "area_nombre": c.area.nombre,
                "orden": c.numero,
                "nombre": c.nombre,
            })
    except Exception:
        pass

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        title=f"Boleta {estudiante.usuario.last_name} B{bimestre} {anio}",
    )
    elementos = []
    styles = getSampleStyleSheet()

    _cabecera(cfg, estudiante, bimestre, anio, elementos, styles)

    if nivel == "inicial":
        notas_b = notas_qs.filter(bimestre=str(bimestre))
        _tabla_inicial(notas_b, bimestre, elementos, styles)

    elif nivel == "secundaria":
        _tabla_secundaria(notas_qs, comp_cneb, bimestre, grado, elementos, styles)

    else:  # primaria (default)
        _tabla_primaria(notas_qs, comp_cneb, bimestre, elementos, styles)
        _tabla_conclusiones_primaria(notas_qs, bimestre, elementos, styles)

    _leyenda_y_firmas(cfg, tutor, elementos, styles)
    doc.build(elementos)
    return buf.getvalue()


def generar_boletas_zip(estudiantes_qs, bimestre: str, anio: int = None) -> bytes:
    """ZIP con las boletas de todos los estudiantes indicados."""
    buf_zip = io.BytesIO()
    with zipfile.ZipFile(buf_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for est in estudiantes_qs.select_related("usuario"):
            pdf_bytes = generar_boleta_pdf(est, bimestre, anio)
            apellidos = (est.usuario.last_name or "").replace(" ", "_")[:20]
            nombre = f"boleta_{apellidos}_{est.codigo_matricula or est.usuario.dni or est.pk}_B{bimestre}.pdf"
            zf.writestr(nombre, pdf_bytes)
    buf_zip.seek(0)
    return buf_zip.getvalue()


# ─── LIBRETA ANUAL ───────────────────────────────────────────────────────────

def generar_libreta_anual_pdf(estudiante, anio: int = None) -> bytes:
    """Libreta anual: B1 B2 B3 B4 en una sola hoja por alumno."""
    from apps.notas.models import NotaBimestre

    cfg = _cfg_institucional()
    anio = anio or cfg["anio"]
    tutor = _tutor_nombre(estudiante)

    notas_qs = NotaBimestre.objects.filter(
        estudiante=estudiante, anio_lectivo=anio, competencia=1,
    ).order_by("area", "bimestre")

    nivel = "primaria"
    if estudiante.seccion_obj:
        nivel = estudiante.seccion_obj.nivel or "primaria"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        title=f"Libreta Anual {estudiante.usuario.last_name} {anio}",
    )
    elementos = []
    styles = getSampleStyleSheet()

    # Título
    s_tit = ParagraphStyle("tit", parent=styles["Heading2"], alignment=1, fontSize=11,
                           textColor=colors.white, backColor=AZUL, borderPadding=6)
    s_sub = ParagraphStyle("sub", parent=styles["Normal"], fontSize=8, alignment=1,
                           textColor=colors.HexColor("#475569"))
    s_lbl = ParagraphStyle("lbl", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold")
    s_cel = ParagraphStyle("cel", parent=styles["Normal"], fontSize=8)
    s_hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontSize=7,
                           fontName="Helvetica-Bold", textColor=colors.white, alignment=1)
    s_area = ParagraphStyle("area", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold")
    s_nl = ParagraphStyle("nl", parent=styles["Normal"], fontSize=10,
                          fontName="Helvetica-Bold", alignment=1)

    cfg2 = _cfg_institucional()
    elementos.append(_p(f"LIBRETA DE NOTAS ANUAL — AÑO LECTIVO {anio}", s_tit))
    elementos.append(_p(cfg2.get("nombre", ""), s_sub))
    elementos.append(Spacer(1, 0.2*cm))

    u = estudiante.usuario
    sec = estudiante.seccion_obj
    grado_txt = sec.nombre if sec else f"{estudiante.grado} {estudiante.seccion}".strip()
    datos = [
        [_p("Estudiante:", s_lbl), _p(f"{u.last_name}, {u.first_name}".strip(), s_cel),
         _p("Código:", s_lbl), _p(estudiante.codigo_matricula or "—", s_cel)],
        [_p("DNI:", s_lbl), _p(u.dni or "—", s_cel),
         _p("Grado / Sección:", s_lbl), _p(grado_txt, s_cel)],
    ]
    t_datos = Table(datos, colWidths=[3.0*cm, 6.5*cm, 3.0*cm, 5.0*cm])
    t_datos.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (0, -1), GRIS),
        ("BACKGROUND", (2, 0), (2, -1), GRIS),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elementos.append(t_datos)
    elementos.append(Spacer(1, 0.4*cm))

    # Tabla resumen
    from collections import defaultdict
    areas: dict = defaultdict(dict)
    for n in notas_qs:
        areas[n.area][str(n.bimestre)] = n.calificacion or "—"

    data = [[
        _p("ÁREA CURRICULAR", s_hdr),
        _p("B1", s_hdr), _p("B2", s_hdr), _p("B3", s_hdr), _p("B4", s_hdr),
        _p("Calificativo\nanual", s_hdr),
    ]]
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), AZUL),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, GRIS_BORDE),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, GRIS_BORDE_FINO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]

    for ri, (area, bims) in enumerate(sorted(areas.items()), start=1):
        nl_vals = [bims.get(b, "—") for b in ("1","2","3","4")]
        calif_anual = _consolidado_nl(nl_vals)
        data.append([
            _p(area, s_area),
            _p(nl_vals[0], s_nl), _p(nl_vals[1], s_nl),
            _p(nl_vals[2], s_nl), _p(nl_vals[3], s_nl),
            _p(calif_anual, s_nl),
        ])
        for ci, nl in enumerate(nl_vals, start=1):
            if nl in COLOR_NL:
                style_cmds.append(("BACKGROUND", (ci, ri), (ci, ri), COLOR_NL[nl]))
        if calif_anual in COLOR_NL:
            style_cmds.append(("BACKGROUND", (5, ri), (5, ri), COLOR_NL[calif_anual]))

    t = Table(data, colWidths=[9*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 2.5*cm])
    t.setStyle(TableStyle(style_cmds))
    elementos.append(t)

    _leyenda_y_firmas(cfg2, tutor, elementos, styles)
    doc.build(elementos)
    return buf.getvalue()


def generar_libretas_anuales_zip(estudiantes_qs, anio: int = None) -> bytes:
    """ZIP con la libreta anual de todos los estudiantes."""
    buf_zip = io.BytesIO()
    cfg = _cfg_institucional()
    anio = anio or cfg["anio"]
    with zipfile.ZipFile(buf_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        for est in estudiantes_qs.select_related("usuario"):
            pdf_bytes = generar_libreta_anual_pdf(est, anio)
            nombre = f"libreta_{est.codigo_matricula or est.usuario.dni or est.pk}_{anio}.pdf"
            zf.writestr(nombre, pdf_bytes)
    buf_zip.seek(0)
    return buf_zip.getvalue()
