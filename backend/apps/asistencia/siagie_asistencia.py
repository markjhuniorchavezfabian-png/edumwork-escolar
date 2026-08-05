"""Relleno de plantillas oficiales SIAGIE para asistencia mensual.

El Excel oficial lo genera SIAGIE. EduMWork solo detecta columnas, rellena
las celdas de asistencia y conserva el resto del archivo.
"""

import calendar
import hashlib
import io
import json
import re
import unicodedata
from datetime import date

from openpyxl import load_workbook

from apps.asistencia.models import EstadoAsistencia, RegistroAsistencia
from apps.usuarios.models import Estudiante


# Leyenda SIAGIE: Asistió '.', Falta 'F', Tardanza 'T', Falta justificada 'J',
# Tardanza justificada 'U'. En EduMWork, 'U' se deriva de tardanza + justificación.
CODIGOS_ASISTENCIA_SIAGIE = {
    EstadoAsistencia.PRESENTE: ".",
    EstadoAsistencia.TARDANZA: "T",
    EstadoAsistencia.AUSENTE: "F",
    EstadoAsistencia.JUSTIFICADO: "J",
}


def _codigo_siagie(registro: dict) -> str | None:
    if registro["estado"] == EstadoAsistencia.TARDANZA and str(registro.get("justificacion") or "").strip():
        return "U"
    return CODIGOS_ASISTENCIA_SIAGIE.get(registro["estado"])


def _normalizar(valor) -> str:
    texto = str(valor or "")
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", texto).strip().lower()


def _hash_fila(fila_valores: list) -> str:
    normalizadas = [_normalizar(v) for v in fila_valores]
    texto = json.dumps(normalizadas, ensure_ascii=False)
    return hashlib.sha256(texto.encode()).hexdigest()


def _dia_desde_cabecera(valor) -> int | None:
    if isinstance(valor, int) and 1 <= valor <= 31:
        return valor
    texto = _normalizar(valor)
    if not texto:
        return None
    if texto.isdigit() and 1 <= int(texto) <= 31:
        return int(texto)
    match = re.search(r"\b(?:dia|d[ií]a)\s*0?([1-9]|[12]\d|3[01])\b", texto)
    if match:
        return int(match.group(1))
    return None


def _detectar_hoja(ws) -> dict | None:
    if "generalidad" in _normalizar(ws.title):
        return None

    max_col = min(ws.max_column, 80)
    for row_idx in range(1, min(ws.max_row, 30) + 1):
        fila = [ws.cell(row=row_idx, column=c).value for c in range(1, max_col + 1)]
        mapeo = {}
        dias = {}

        for idx, valor in enumerate(fila):
            texto = _normalizar(valor)
            dia = _dia_desde_cabecera(valor)
            if dia:
                mapeo[idx] = f"dia_{dia}"
                dias[dia] = idx
            elif re.search(r"^dni$|documento|n[°º]?\s*doc", texto):
                mapeo[idx] = "dni"
            elif re.search(r"c[oó]d|codigo|matricula", texto):
                mapeo[idx] = "codigo"
            elif "apellido" in texto or "nombres" in texto:
                mapeo[idx] = "apellidos_nombres"

        if ("dni" in mapeo.values() or "codigo" in mapeo.values()) and dias:
            hash_header = _hash_fila(fila)
            errores = []
            if "dni" not in mapeo.values() and "codigo" not in mapeo.values():
                errores.append("No se detectó columna DNI/código.")
            confianza = "alta" if not errores else "media"
            return {
                "hash": hash_header,
                "hoja": ws.title,
                "fila_cabecera": row_idx,
                "fila_datos": row_idx + 1,
                "mapeo": mapeo,
                "dias": sorted(dias),
                "metodo": "heuristica",
                "confianza": confianza,
                "errores": errores,
                "muestra_header": " | ".join(str(v or "")[:30] for v in fila if v is not None),
            }
    return None


def _info_desde_cache(ws, info_detectada: dict) -> dict | None:
    from apps.notas.models import SiagieMapeo

    existente = SiagieMapeo.objects.filter(
        tipo_template="asistencia",
        hash_header=info_detectada["hash"],
    ).first()
    if not existente:
        return None
    mapeo = {int(k): v for k, v in existente.mapeo_json.items()}
    dias = sorted(
        int(v.split("_", 1)[1])
        for v in mapeo.values()
        if isinstance(v, str) and v.startswith("dia_") and v.split("_", 1)[1].isdigit()
    )
    return {
        "hash": existente.hash_header,
        "hoja": ws.title,
        "fila_cabecera": info_detectada["fila_cabecera"],
        "fila_datos": existente.fila_datos,
        "mapeo": mapeo,
        "dias": dias,
        "metodo": "cache",
        "confianza": "alta",
        "errores": [],
        "muestra_header": existente.muestra_header,
    }


def _guardar_cache(info: dict):
    from apps.notas.models import SiagieMapeo

    SiagieMapeo.objects.get_or_create(
        tipo_template="asistencia",
        hash_header=info["hash"],
        defaults={
            "mapeo_json": {str(k): v for k, v in info["mapeo"].items()},
            "metodo_deteccion": info.get("metodo", "heuristica"),
            "fila_datos": info.get("fila_datos", 1),
            "muestra_header": info.get("muestra_header", ""),
        },
    )


def analizar_template_asistencia(archivo_excel) -> list[dict]:
    wb = load_workbook(archivo_excel, data_only=True)
    resultados = []
    for ws in wb.worksheets:
        info = _detectar_hoja(ws)
        if info:
            cache = _info_desde_cache(ws, info)
            if cache:
                resultados.append(cache)
            else:
                _guardar_cache(info)
                resultados.append(info)
    return resultados


def resumen_confianza(mapeo_infos: list[dict]) -> tuple[str, list[str]]:
    if not mapeo_infos:
        return "baja", ["No se detectó ninguna hoja de asistencia con DNI/código y días."]
    errores = [err for info in mapeo_infos for err in info.get("errores", [])]
    if errores:
        return "media", errores
    if all(info.get("confianza") == "alta" for info in mapeo_infos):
        return "alta", []
    return "media", []


def datos_asistencia_por_dni(seccion_id: int, anio: int, mes: int) -> dict[str, dict[str, str]]:
    dias_mes = calendar.monthrange(anio, mes)[1]
    estudiantes = list(
        Estudiante.objects.por_seccion(seccion_id, anio)
        .select_related("usuario")
        .order_by("usuario__last_name", "usuario__first_name")
    )
    registros = RegistroAsistencia.objects.filter(
        estudiante__in=estudiantes,
        fecha__gte=date(anio, mes, 1),
        fecha__lte=date(anio, mes, dias_mes),
    ).values("estudiante_id", "fecha", "estado", "justificacion")

    por_estudiante = {}
    for registro in registros:
        codigo = _codigo_siagie(registro)
        if codigo:
            por_estudiante.setdefault(registro["estudiante_id"], {})[f"dia_{registro['fecha'].day}"] = codigo

    salida = {}
    for estudiante in estudiantes:
        dni = str(estudiante.usuario.dni or "").strip()
        if dni and estudiante.id in por_estudiante:
            salida[dni] = por_estudiante[estudiante.id]
    return salida


def preview_relleno_asistencia(archivo_excel, datos_por_dni: dict[str, dict], mapeo_infos: list[dict]) -> dict:
    wb = load_workbook(archivo_excel, data_only=True)
    total_filas = 0
    se_rellenaran = 0
    dnis_sin_datos = []

    for ws in wb.worksheets:
        info = next((m for m in mapeo_infos if m.get("hoja") == ws.title), None)
        if not info:
            continue
        campo_a_col = {v: int(k) for k, v in info["mapeo"].items()}
        col_dni = campo_a_col.get("dni")
        if col_dni is None:
            continue
        for row_idx in range(info["fila_datos"], ws.max_row + 1):
            dni = str(ws.cell(row=row_idx, column=col_dni + 1).value or "").strip()
            if not dni:
                continue
            total_filas += 1
            if datos_por_dni.get(dni):
                se_rellenaran += 1
            else:
                dnis_sin_datos.append(dni)

    return {
        "total_filas": total_filas,
        "se_rellenaran": se_rellenaran,
        "sin_datos": len(dnis_sin_datos),
        "dnis_sin_datos": dnis_sin_datos[:50],
    }


def rellenar_template_asistencia(archivo_excel, datos_por_dni: dict[str, dict], mapeo_infos: list[dict]):
    wb = load_workbook(archivo_excel)
    total_rellenadas = 0

    for ws in wb.worksheets:
        info = next((m for m in mapeo_infos if m.get("hoja") == ws.title), None)
        if not info:
            continue
        campo_a_col = {v: int(k) for k, v in info["mapeo"].items()}
        col_dni = campo_a_col.get("dni")
        if col_dni is None:
            continue

        for row_idx in range(info["fila_datos"], ws.max_row + 1):
            dni = str(ws.cell(row=row_idx, column=col_dni + 1).value or "").strip()
            datos = datos_por_dni.get(dni)
            if not datos:
                continue
            relleno = False
            for campo, valor in datos.items():
                col_idx = campo_a_col.get(campo)
                if col_idx is not None and valor:
                    ws.cell(row=row_idx, column=col_idx + 1).value = valor
                    relleno = True
            if relleno:
                total_rellenadas += 1

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf, total_rellenadas
