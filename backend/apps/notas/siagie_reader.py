"""
Lector de templates SIAGIE oficiales.

FLUJO DE DETECCIÓN DE MAPEO (3 ramas):
    1. Hash del header ya existe en BD    → usar mapeo guardado  (0 costo)
    2. Hash nuevo + IA disponible          → LLMClient analiza    → guardar
    3. Hash nuevo + sin IA (o IA falla)    → heurística propia    → guardar

BYOK: Rama 2 usa `LLMConfig.get_para(usuario)`, que prioriza:
      config personal del usuario → institucional → env vars.
      Cada llamada queda registrada en LLMUsage (tracking automático).

MULTI-HOJA: si el template tiene varias hojas (SIAGIE genera 1 por sección o
      por área), se analiza y rellena hoja por hoja. Cada hoja puede tener
      su propio mapeo (mismo hash para hojas idénticas).
"""

import hashlib
import io
import json
import re
import unicodedata

from openpyxl import load_workbook


# ─── Constantes heurísticas ──────────────────────────────────────────────────

PATRONES_HEURISTICA = {
    "orden":       [r"^n[°º]?\.?\s*$", r"^ord", r"^item", r"^nro", r"^num", r"^id$"],
    "codigo":      [r"c[óo]d", r"codigo", r"c[oó]d\.?\s*est", r"matr[ií]cula"],
    "dni":         [r"^dni$", r"n[°º]?\s*doc", r"documento"],
    "apellidos":   [r"apellido", r"apellidos.*y.*nombres", r"apellidos y nombres", r"^nombres?$"],
    "nombres":     [r"\bnombre", r"nombre.*alumno", r"nombre.*estud", r"apellidos.*y.*nombres", r"^nombres?$"],
    "sexo":        [r"^sexo$", r"^g[eé]nero$"],
    "nota_nl":     [r"^nl$", r"^nivel\s*log", r"calificac", r"logro",
                    r"competencia.*nl", r"comp.*\d+.*nl", r"comp\.?\s*\d"],
    "conclusion":  [r"conclus", r"descripci[oó]n", r"competencia.*conclus", r"comp.*\d+.*conclus"],
}


# ─── Utilidades ──────────────────────────────────────────────────────────────

def _normalizar(texto) -> str:
    """Lowercase + trim + sin acentos + sin espacios dobles."""
    s = str(texto or "")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower()


def _hash_fila(fila_valores: list) -> str:
    """Hash estable del header: normaliza para tolerar espacios/acentos/caps."""
    normalizadas = [_normalizar(v) for v in fila_valores]
    texto = json.dumps(normalizadas, ensure_ascii=False)
    return hashlib.sha256(texto.encode()).hexdigest()


def _detectar_fila_cabecera(ws) -> tuple[int, list]:
    """Busca la fila de cabecera SIAGIE, incluso templates con ID/Cód. Estudiante."""
    max_col = min(ws.max_column, 50)
    for row_idx in range(1, min(25, ws.max_row + 1)):
        fila = [ws.cell(row=row_idx, column=c).value for c in range(1, max_col + 1)]
        texto = " ".join(_normalizar(v) for v in fila if v)
        if "dni" in texto or "apellido" in texto or ("cod" in texto and "estudiante" in texto) or "nombres" in texto:
            return row_idx, fila
    fila = [ws.cell(row=6, column=c).value for c in range(1, max_col + 1)]
    return 6, fila


def _extraer_muestra(ws, fila_cabecera: int, n_filas: int = 3) -> list[list]:
    max_col = min(ws.max_column, 50)
    muestra = []
    for row_idx in range(fila_cabecera + 1, fila_cabecera + 1 + n_filas):
        fila = [ws.cell(row=row_idx, column=c).value for c in range(1, max_col + 1)]
        if any(v is not None for v in fila):
            muestra.append(fila)
    return muestra


def _detectar_nivel(ws) -> tuple[str, bool]:
    """Detecta nivel educativo y si tiene columna de conclusiones descriptivas."""
    nivel = ""
    tiene_conclusiones = False
    for row_idx in range(1, 20):
        for col_idx in range(1, 30):
            val = _normalizar(ws.cell(row=row_idx, column=col_idx).value)
            if not val:
                continue
            if "inicial" in val and not nivel:
                nivel = "inicial"
            elif "primaria" in val and not nivel:
                nivel = "primaria"
            elif "secundaria" in val and not nivel:
                nivel = "secundaria"
            if "conclusi" in val or "descripti" in val:
                tiene_conclusiones = True
    if nivel == "inicial":
        tiene_conclusiones = True
    return nivel, tiene_conclusiones


def _extraer_leyenda(ws) -> dict[str, str]:
    """Extrae leyendas tipo SIAGIE: 01 = competencia, NL = nivel de logro."""
    leyenda = {}
    inicio = None
    max_row = min(ws.max_row, 80)
    max_col = min(ws.max_column, 20)
    for row_idx in range(1, max_row + 1):
        for col_idx in range(1, max_col + 1):
            if _normalizar(ws.cell(row=row_idx, column=col_idx).value) == "leyenda":
                inicio = (row_idx, col_idx)
                break
        if inicio:
            break

    if not inicio:
        return leyenda

    row_inicio, col_inicio = inicio
    for row_idx in range(row_inicio, max_row + 1):
        valores = [ws.cell(row=row_idx, column=c).value for c in range(col_inicio, max_col + 1)]
        texto = " ".join(str(v or "").strip() for v in valores if v is not None).strip()
        if not texto:
            if row_idx > row_inicio + 1:
                break
            continue
        match = re.match(r"^(nl|\d{1,2})\s*=\s*(.+)$", texto, re.IGNORECASE)
        if match:
            codigo = match.group(1).upper().zfill(2) if match.group(1).isdigit() else match.group(1).upper()
            leyenda[codigo] = match.group(2).strip()
            continue
        if len(valores) >= 2:
            codigo_raw = _normalizar(valores[0]).upper()
            descripcion = str(valores[1] or "").strip()
            if re.fullmatch(r"\d{1,2}|NL", codigo_raw, re.IGNORECASE) and descripcion:
                codigo = codigo_raw.zfill(2) if codigo_raw.isdigit() else codigo_raw
                leyenda[codigo] = descripcion
    return leyenda


def _competencias_detectadas(ws, fila_cabecera_idx: int, fila_cabecera: list) -> list[dict]:
    """Une columnas 01/02/03 con la leyenda visible del archivo SIAGIE."""
    leyenda = _extraer_leyenda(ws)
    fila_2 = [ws.cell(row=fila_cabecera_idx + 1, column=c).value for c in range(1, min(ws.max_column, 50) + 1)]
    comps = []
    comp_idx = 0
    for idx, valor in enumerate(fila_cabecera):
        codigo_norm = _normalizar(valor)
        if not re.fullmatch(r"0?\d{1,2}", codigo_norm):
            continue
        comp_idx += 1
        codigo = codigo_norm.zfill(2)
        sub_actual = _normalizar(fila_2[idx] if idx < len(fila_2) else "")
        sub_siguiente = _normalizar(fila_2[idx + 1] if idx + 1 < len(fila_2) else "")
        comps.append({
            "codigo": codigo,
            "nombre": leyenda.get(codigo, ""),
            "competencia_default": comp_idx,
            "campo_nl": f"nota_nl_{comp_idx}" if sub_actual == "nl" else "",
            "campo_conclusion": f"conclusion_{comp_idx}" if ("conclusion" in sub_siguiente or "descript" in sub_siguiente) else "",
            "col_nl": idx,
            "col_conclusion": idx + 1 if ("conclusion" in sub_siguiente or "descript" in sub_siguiente) else None,
        })
    return comps


def aplicar_mapeo_competencias(mapeo_infos: list[dict], competencias_por_hoja: dict | None = None) -> list[dict]:
    """Aplica correcciones simples: hoja -> codigo SIAGIE -> competencia EduMWork."""
    if not competencias_por_hoja:
        return mapeo_infos
    ajustadas = []
    for info in mapeo_infos:
        hoja = info.get("hoja", "")
        overrides = competencias_por_hoja.get(hoja) or {}
        if not overrides:
            ajustadas.append(info)
            continue
        nuevo = {**info, "mapeo": dict(info.get("mapeo", {})), "metodo": "manual"}
        for comp in info.get("competencias_detectadas", []):
            codigo = comp.get("codigo")
            destino = overrides.get(codigo) or overrides.get(str(int(codigo)) if str(codigo).isdigit() else codigo)
            if destino in (None, "", "ignorar"):
                continue
            try:
                destino_int = int(destino)
            except (TypeError, ValueError):
                continue
            col_nl = comp.get("col_nl")
            col_conclusion = comp.get("col_conclusion")
            if col_nl is not None:
                nuevo["mapeo"][int(col_nl)] = f"nota_nl_{destino_int}"
            if col_conclusion is not None:
                nuevo["mapeo"][int(col_conclusion)] = f"conclusion_{destino_int}"
        ajustadas.append(nuevo)
    return ajustadas


# ─── Rama heurística ─────────────────────────────────────────────────────────

def _mapeo_heuristico(fila_cabecera: list) -> dict:
    """Mapea columnas sin IA buscando patrones conocidos de SIAGIE."""
    mapeo = {}
    for idx, valor in enumerate(fila_cabecera):
        texto = _normalizar(valor)
        if not texto:
            continue
        for campo, patrones in PATRONES_HEURISTICA.items():
            for patron in patrones:
                if re.search(patron, texto, re.IGNORECASE) and idx not in mapeo:
                    mapeo[idx] = campo
                    break

    # Renombrar duplicados: nota_nl, nota_nl → nota_nl_1, nota_nl_2
    for campo_base in ("nota_nl", "conclusion"):
        cols = [i for i, v in mapeo.items() if v == campo_base]
        if len(cols) > 1:
            for i, col_idx in enumerate(cols):
                mapeo[col_idx] = f"{campo_base}_{i + 1}"
    return mapeo


def _mapeo_heuristico_2_filas(ws, fila_cabecera_idx: int, fila_cabecera: list) -> dict:
    """Detecta templates SIAGIE reales donde F1 tiene competencias y F2 NL/conclusión."""
    mapeo = _mapeo_heuristico(fila_cabecera)
    max_col = min(ws.max_column, 50)
    fila_2 = [ws.cell(row=fila_cabecera_idx + 1, column=c).value for c in range(1, max_col + 1)]
    comp_idx = 0
    for idx, valor in enumerate(fila_cabecera):
        if not re.fullmatch(r"0?\d{1,2}", _normalizar(valor)):
            continue
        comp_idx += 1
        sub_actual = _normalizar(fila_2[idx] if idx < len(fila_2) else "")
        sub_siguiente = _normalizar(fila_2[idx + 1] if idx + 1 < len(fila_2) else "")
        if sub_actual == "nl":
            mapeo[idx] = f"nota_nl_{comp_idx}"
        if "conclusion" in sub_siguiente or "descript" in sub_siguiente:
            mapeo[idx + 1] = f"conclusion_{comp_idx}"
    return mapeo


# ─── Rama IA ──────────────────────────────────────────────────────────────────

def _mapeo_con_ia(fila_cabecera: list, muestra: list[list], usuario) -> dict | None:
    """
    Llama al LLMClient (BYOK: usa config personal del usuario si existe).
    Retorna dict de mapeo o None si no hay IA configurada o falla.
    """
    from apps.ia.models import LLMConfig
    from apps.ia.client import LLMClient

    cfg = LLMConfig.get_para(usuario)
    if not cfg:
        return None

    cabecera_texto = "\n".join(
        f"  Col {i}: {repr(v)}" for i, v in enumerate(fila_cabecera) if v is not None
    )
    muestra_texto = ""
    for fila in muestra[:2]:
        muestra_texto += "  " + " | ".join(str(v or "")[:20] for v in fila) + "\n"

    prompt = f"""Analiza este encabezado de un Excel oficial del sistema SIAGIE (MINEDU Perú) y mapea cada columna a uno de estos campos:

CAMPOS POSIBLES:
- orden: número correlativo
- codigo: código de matrícula
- dni: DNI del estudiante
- apellidos, nombres, sexo
- nota_nl_1, nota_nl_2, ...: nivel de logro por competencia (AD, A, B, C)
- conclusion_1, conclusion_2, ...: conclusión descriptiva por competencia
- ignorar: columna sin dato útil

COLUMNAS DEL EXCEL:
{cabecera_texto}

MUESTRA DE DATOS (2 filas):
{muestra_texto}

Responde SOLO con JSON válido:
{{"0": "orden", "1": "codigo", "2": "dni", "3": "apellidos", ...}}

Índices 0-based como string. Sin explicaciones."""

    try:
        client = LLMClient(cfg, endpoint="siagie_mapeo", usuario=usuario)
        texto = client.completar(prompt, max_tokens=512, timeout=30)
    except Exception:
        return None

    match = re.search(r"\{.*\}", texto or "", re.DOTALL)
    if not match:
        return None
    try:
        raw = json.loads(match.group())
        return {int(k): v for k, v in raw.items()}
    except (ValueError, TypeError):
        return None


# ─── API pública ─────────────────────────────────────────────────────────────

def analizar_hoja(ws, usuario) -> dict:
    """
    Analiza UNA hoja del Excel: detecta cabecera, nivel, mapeo (3 ramas).
    Guarda el mapeo en BD si es nuevo. Retorna info completa.
    """
    from .models import SiagieMapeo

    fila_cabecera_idx, fila_cabecera = _detectar_fila_cabecera(ws)
    fila_subheader = [ws.cell(row=fila_cabecera_idx + 1, column=c).value for c in range(1, min(ws.max_column, 50) + 1)]
    usa_subheader = any(_normalizar(v) == "nl" or "conclusion" in _normalizar(v) for v in fila_subheader)
    fila_datos = fila_cabecera_idx + (2 if usa_subheader else 1)
    hash_h = _hash_fila(fila_cabecera)
    muestra_header = " | ".join(str(v or "")[:30] for v in fila_cabecera if v is not None)

    # ── Rama 1: cache ────────────────────────────────────────────────────
    existente = SiagieMapeo.objects.filter(tipo_template="notas", hash_header=hash_h).first()
    if existente:
        competencias = _competencias_detectadas(ws, fila_cabecera_idx, fila_cabecera)
        return {
            "hash": hash_h,
            "hoja": ws.title,
            "mapeo": {int(k): v for k, v in existente.mapeo_json.items()},
            "nivel": existente.nivel,
            "tiene_conclusiones": existente.tiene_conclusiones,
            "fila_datos": existente.fila_datos,
            "metodo": "cache",
            "muestra_header": existente.muestra_header,
            "leyenda": _extraer_leyenda(ws),
            "competencias_detectadas": competencias,
        }

    # ── Ramas 2/3: nuevo mapeo ───────────────────────────────────────────
    nivel, tiene_conclusiones = _detectar_nivel(ws)
    muestra_datos = _extraer_muestra(ws, fila_cabecera_idx)

    mapeo = _mapeo_con_ia(fila_cabecera, muestra_datos, usuario)
    metodo = "ia" if mapeo else "heuristica"
    if not mapeo:
        mapeo = _mapeo_heuristico_2_filas(ws, fila_cabecera_idx, fila_cabecera)

    SiagieMapeo.objects.create(
        tipo_template="notas",
        hash_header=hash_h,
        mapeo_json={str(k): v for k, v in mapeo.items()},
        nivel=nivel,
        tiene_conclusiones=tiene_conclusiones,
        metodo_deteccion=metodo,
        fila_datos=fila_datos,
        muestra_header=muestra_header,
    )

    return {
        "hash": hash_h,
        "hoja": ws.title,
        "mapeo": mapeo,
        "nivel": nivel,
        "tiene_conclusiones": tiene_conclusiones,
        "fila_datos": fila_datos,
        "metodo": metodo,
        "muestra_header": muestra_header,
        "leyenda": _extraer_leyenda(ws),
        "competencias_detectadas": _competencias_detectadas(ws, fila_cabecera_idx, fila_cabecera),
    }


def analizar_template(archivo_excel, usuario) -> list[dict]:
    """
    Analiza TODAS las hojas del template. Retorna lista de dicts (uno por hoja).
    """
    wb = load_workbook(archivo_excel, data_only=True)
    resultados = []
    for ws in wb.worksheets:
        if _normalizar(ws.title) in {"generalidades", "parametros", "parámetros"}:
            continue
        try:
            resultados.append(analizar_hoja(ws, usuario))
        except Exception as e:
            resultados.append({"hoja": ws.title, "error": str(e)[:200]})
    return resultados


# ─── Preview (dry-run) ────────────────────────────────────────────────────────

def preview_relleno(archivo_excel, notas_por_dni: dict, mapeo_infos: list[dict]) -> dict:
    """
    Simula el relleno SIN modificar. Retorna qué DNIs se rellenarán y cuáles faltan.
    """
    wb = load_workbook(archivo_excel, data_only=True)
    dnis_en_template = []
    dnis_sin_notas = []

    for ws in wb.worksheets:
        info = next((m for m in mapeo_infos if m.get("hoja") == ws.title), None)
        if not info or "error" in info:
            continue

        mapeo = info["mapeo"]
        fila_datos = info["fila_datos"]
        campo_a_col = {v: int(k) for k, v in mapeo.items() if v != "ignorar"}
        col_identificador = campo_a_col.get("dni", campo_a_col.get("codigo"))
        if col_identificador is None:
            continue

        for row_idx in range(fila_datos, ws.max_row + 1):
            dni_val = str(ws.cell(row=row_idx, column=col_identificador + 1).value or "").strip()
            if not dni_val:
                continue
            dnis_en_template.append(dni_val)
            if dni_val not in notas_por_dni:
                dnis_sin_notas.append(dni_val)

    return {
        "total_filas": len(dnis_en_template),
        "se_rellenaran": len(dnis_en_template) - len(dnis_sin_notas),
        "sin_notas": len(dnis_sin_notas),
        "dnis_sin_notas": dnis_sin_notas[:50],  # primeros 50 para mostrar
    }


# ─── Relleno real ────────────────────────────────────────────────────────────

def rellenar_template(archivo_excel, notas_por_dni: dict, mapeo_infos: list[dict]):
    """
    Rellena TODAS las hojas del template. Retorna BytesIO con Excel modificado.
    Cuenta filas rellenadas por hoja.
    """
    wb = load_workbook(archivo_excel)
    total_rellenadas = 0

    for ws in wb.worksheets:
        info = next((m for m in mapeo_infos if m.get("hoja") == ws.title), None)
        if not info or "error" in info:
            continue

        mapeo = info["mapeo"]
        fila_datos = info["fila_datos"]
        campo_a_col = {v: int(k) for k, v in mapeo.items() if v != "ignorar"}
        col_identificador = campo_a_col.get("dni", campo_a_col.get("codigo"))
        if col_identificador is None:
            continue

        for row_idx in range(fila_datos, ws.max_row + 1):
            dni_val = str(ws.cell(row=row_idx, column=col_identificador + 1).value or "").strip()
            if not dni_val or dni_val not in notas_por_dni:
                continue
            datos = notas_por_dni[dni_val]
            algo_rellenado = False
            for campo, valor in datos.items():
                col_idx = campo_a_col.get(campo)
                if col_idx is not None and valor:
                    ws.cell(row=row_idx, column=col_idx + 1).value = valor
                    algo_rellenado = True
            if algo_rellenado:
                total_rellenadas += 1

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf, total_rellenadas
