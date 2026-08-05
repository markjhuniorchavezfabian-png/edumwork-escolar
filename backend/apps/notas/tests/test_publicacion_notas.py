import pytest
from rest_framework.test import APIClient

from apps.notas.models import NotaBimestre
from apps.usuarios.models import Estudiante, Matricula, Padre, Rol, Seccion, Usuario


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def escenario_notas(db):
    seccion = Seccion.objects.create(nombre="1ro A", grado="1ro", letra="A", nivel="primaria")
    estudiante_user = Usuario.objects.create_user(
        username="est_pub", password="p", rol=Rol.ESTUDIANTE,
        first_name="Ana", last_name="Perez", dni="12345678",
    )
    estudiante = Estudiante.objects.create(usuario=estudiante_user, grado="1ro", seccion="A")
    Matricula.objects.create(
        estudiante=estudiante, seccion=seccion, anio_lectivo=2026,
        situacion="matriculado", codigo_matricula="COD001",
    )
    padre_user = Usuario.objects.create_user(username="padre_pub", password="p", rol=Rol.PADRE)
    padre = Padre.objects.create(usuario=padre_user)
    padre.hijos.add(estudiante)
    NotaBimestre.objects.create(
        estudiante=estudiante, anio_lectivo=2026, area="Comunicación",
        bimestre="1", competencia=1, calificacion="A",
        conclusion_descriptiva="Logro esperado con avance sostenido.",
    )
    return seccion, estudiante, estudiante_user, padre_user


@pytest.mark.django_db
def test_padre_no_ve_notas_no_publicadas(client, escenario_notas):
    _seccion, estudiante, _estudiante_user, padre_user = escenario_notas
    client.force_authenticate(padre_user)

    resp = client.get(f"/api/notas/?estudiante={estudiante.pk}")

    assert resp.status_code == 200
    data = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
    assert data == []


@pytest.mark.django_db
def test_padre_no_descarga_boleta_no_publicada(client, escenario_notas):
    _seccion, estudiante, _estudiante_user, padre_user = escenario_notas
    client.force_authenticate(padre_user)

    resp = client.get(f"/api/notas/boleta/{estudiante.pk}/?bimestre=1&anio=2026")

    assert resp.status_code == 403


@pytest.mark.django_db
def test_director_publica_bimestre_y_padre_ve_notas_y_boleta(client, escenario_notas):
    seccion, estudiante, _estudiante_user, padre_user = escenario_notas
    director = Usuario.objects.create_user(username="dir_pub", password="p", rol=Rol.DIRECTOR)

    client.force_authenticate(director)
    pub = client.post(
        "/api/notas/publicaciones/",
        {"seccion_id": seccion.pk, "bimestre": "1", "anio": 2026, "estado": "publicado"},
        format="json",
    )
    assert pub.status_code == 200, pub.data
    assert pub.data["estado"] == "publicado"

    client.force_authenticate(padre_user)
    notas = client.get(f"/api/notas/?estudiante={estudiante.pk}")
    data = notas.data if isinstance(notas.data, list) else notas.data.get("results", [])
    assert len(data) == 1

    boleta = client.get(f"/api/notas/boleta/{estudiante.pk}/?bimestre=1&anio=2026")
    assert boleta.status_code == 200
    assert boleta["content-type"] == "application/pdf"
