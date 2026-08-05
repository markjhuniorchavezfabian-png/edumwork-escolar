import io
from datetime import date

import pytest
from openpyxl import Workbook, load_workbook
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.asistencia.models import EstadoAsistencia, RegistroAsistencia
from apps.notas.models import SiagieMapeo
from apps.usuarios.models import Estudiante, Matricula, Rol, Seccion, Usuario


def _template_asistencia():
    wb = Workbook()
    ws = wb.active
    ws.title = "Asistencia"
    ws.append(["Generalidades", None, None, None, None])
    ws.append([None, None, None, None, None])
    ws.append(["N°", "DNI", "Apellidos y nombres", 1, 2, 3])
    ws.append([1, "12345678", "PEREZ ANA", None, None])
    ws.append([2, "87654321", "SIN DATA", None, None])
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out


def _subida_template():
    return SimpleUploadedFile(
        "asistencia_siagie.xlsx",
        _template_asistencia().getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@pytest.mark.django_db
def test_rellena_template_siagie_asistencia_por_dni_y_dia():
    from apps.asistencia.siagie_asistencia import (
        analizar_template_asistencia,
        datos_asistencia_por_dni,
        rellenar_template_asistencia,
    )

    seccion = Seccion.objects.create(nombre="1ro A", grado="1ro", letra="A")
    marcador = Usuario.objects.create_user(username="doc", password="p", rol=Rol.DOCENTE)
    usuario = Usuario.objects.create_user(
        username="ana", password="p", rol=Rol.ESTUDIANTE, dni="12345678", first_name="Ana", last_name="Perez"
    )
    estudiante = Estudiante.objects.create(usuario=usuario, grado="1ro", seccion="A")
    Matricula.objects.create(estudiante=estudiante, seccion=seccion, anio_lectivo=2026, situacion="matriculado")
    RegistroAsistencia.objects.create(
        estudiante=estudiante,
        fecha=date(2026, 7, 1),
        estado=EstadoAsistencia.PRESENTE,
        marcado_por=marcador,
    )
    RegistroAsistencia.objects.create(
        estudiante=estudiante,
        fecha=date(2026, 7, 2),
        estado=EstadoAsistencia.TARDANZA,
        justificacion="Cita médica documentada",
        marcado_por=marcador,
    )
    RegistroAsistencia.objects.create(
        estudiante=estudiante,
        fecha=date(2026, 7, 3),
        estado=EstadoAsistencia.AUSENTE,
        marcado_por=marcador,
    )

    template = _template_asistencia()
    info = analizar_template_asistencia(template)
    template.seek(0)
    datos = datos_asistencia_por_dni(seccion.id, 2026, 7)
    salida, total = rellenar_template_asistencia(template, datos, info)

    wb = load_workbook(salida)
    ws = wb["Asistencia"]
    assert total == 1
    assert ws["D4"].value == "."
    assert ws["E4"].value == "U"
    assert ws["F4"].value == "F"
    assert ws["D5"].value is None
    assert ws["E5"].value is None


@pytest.mark.django_db
def test_analisis_siagie_asistencia_guarda_y_reutiliza_mapeo_por_hash():
    from apps.asistencia.siagie_asistencia import analizar_template_asistencia

    primera = analizar_template_asistencia(_template_asistencia())
    segunda = analizar_template_asistencia(_template_asistencia())

    assert primera[0]["metodo"] == "heuristica"
    assert segunda[0]["metodo"] == "cache"
    assert segunda[0]["confianza"] == "alta"
    assert SiagieMapeo.objects.filter(tipo_template="asistencia", hash_header=primera[0]["hash"]).exists()


@pytest.mark.django_db
def test_endpoint_preview_siagie_asistencia_devuelve_resumen():
    seccion = Seccion.objects.create(nombre="1ro A", grado="1ro", letra="A")
    director = Usuario.objects.create_user(username="dir", password="p", rol=Rol.DIRECTOR)
    usuario = Usuario.objects.create_user(
        username="ana2", password="p", rol=Rol.ESTUDIANTE, dni="12345678", first_name="Ana", last_name="Perez"
    )
    estudiante = Estudiante.objects.create(usuario=usuario, grado="1ro", seccion="A")
    Matricula.objects.create(estudiante=estudiante, seccion=seccion, anio_lectivo=2026, situacion="matriculado")
    RegistroAsistencia.objects.create(
        estudiante=estudiante,
        fecha=date(2026, 7, 1),
        estado=EstadoAsistencia.PRESENTE,
        marcado_por=director,
    )

    client = APIClient()
    client.force_authenticate(director)
    resp = client.post(
        "/api/asistencia/siagie/preview/",
        {"archivo": _subida_template(), "seccion_id": str(seccion.id), "mes": "2026-07"},
        format="multipart",
    )

    assert resp.status_code == 200
    assert resp.data["total_filas"] == 2
    assert resp.data["se_rellenaran"] == 1
    assert resp.data["asistencias_disponibles"] == 1
    assert resp.data["confianza"] == "alta"
