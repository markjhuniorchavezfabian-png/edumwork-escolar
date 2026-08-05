import io

from openpyxl import Workbook, load_workbook

from apps.notas.siagie_reader import aplicar_mapeo_competencias, analizar_hoja, preview_relleno, rellenar_template


def _excel_siagie_con_codigo_sin_dni():
    wb = Workbook()
    ws = wb.active
    ws.title = "063-MATE"
    ws.append(["ID", "Cód. Estudiante", "Nombres", "01"])
    ws.append([None, None, None, "NL"])
    ws.append([1, "COD001", "ALUMNO UNO", None])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _excel_siagie_con_leyenda():
    wb = Workbook()
    ws = wb.active
    ws.title = "0005-COMU"
    ws.append(["ID", "Cód. Estudiante", "Nombres", "01", None, "02"])
    ws.append([None, None, None, "NL", "Conclusión descriptiva", "NL"])
    ws.append([1, "COD001", "ALUMNO UNO", None, None, None])
    ws.append([])
    ws.append(["LEYENDA"])
    ws.append(["NL = Nivel de logro alcanzado"])
    ws.append(["01 = Se comunica oralmente en su lengua materna"])
    ws.append(["02 = Lee diversos tipos de texto en su lengua materna"])
    return ws


def test_rellena_template_siagie_identificado_por_codigo_sin_dni():
    archivo = _excel_siagie_con_codigo_sin_dni()
    mapeo = [{
        "hoja": "063-MATE",
        "mapeo": {1: "codigo", 3: "nota_nl_1"},
        "fila_datos": 3,
    }]
    notas = {"COD001": {"nota_nl_1": "A"}}

    prev = preview_relleno(io.BytesIO(archivo.getvalue()), notas, mapeo)
    salida, n_rellenadas = rellenar_template(io.BytesIO(archivo.getvalue()), notas, mapeo)

    wb = load_workbook(salida)
    assert prev["total_filas"] == 1
    assert prev["se_rellenaran"] == 1
    assert n_rellenadas == 1
    assert wb["063-MATE"].cell(row=3, column=4).value == "A"


def test_analiza_leyenda_y_remapea_competencias_siagie(db, django_user_model):
    usuario = django_user_model.objects.create_user(username="dir", password="x", rol="director")
    info = analizar_hoja(_excel_siagie_con_leyenda(), usuario)

    assert info["leyenda"]["01"] == "Se comunica oralmente en su lengua materna"
    assert info["competencias_detectadas"][0]["codigo"] == "01"

    ajustado = aplicar_mapeo_competencias([info], {"0005-COMU": {"01": "2"}})[0]
    assert ajustado["mapeo"][3] == "nota_nl_2"
    assert ajustado["mapeo"][4] == "conclusion_2"
