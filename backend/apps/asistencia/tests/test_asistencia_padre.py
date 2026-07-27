"""Tests críticos para el flujo padre → hijo en asistencia."""
import pytest
from rest_framework.test import APIClient

from apps.asistencia.models import EstadoAsistencia, RegistroAsistencia
from apps.usuarios.models import Estudiante, Padre, Rol, Usuario


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def padre(db):
    return Usuario.objects.create_user(username="p1", password="p", rol=Rol.PADRE)


@pytest.fixture
def hijo(db):
    u = Usuario.objects.create_user(username="e1", password="p", rol=Rol.ESTUDIANTE, first_name="Juan")
    return Estudiante.objects.create(usuario=u, grado="1ro", seccion="A", codigo_matricula="20260001")


@pytest.fixture
def hijo_otro(db):
    u = Usuario.objects.create_user(username="e2", password="p", rol=Rol.ESTUDIANTE, first_name="Juana")
    return Estudiante.objects.create(usuario=u, grado="1ro", seccion="A", codigo_matricula="20260002")


@pytest.fixture
def padre_con_hijos(db, padre, hijo, hijo_otro):
    perfil = Padre.objects.create(usuario=padre)
    perfil.hijos.add(hijo, hijo_otro)
    return padre


@pytest.fixture
def docente_marcador(db):
    return Usuario.objects.create_user(username="doc_m", password="p", rol=Rol.DOCENTE)


def test_mis_hijos_solo_devuelve_hijos_del_padre(client, padre_con_hijos, hijo, docente_marcador):
    """El endpoint mis-hijos filtra por FK de padre — no mezcla otros estudiantes."""
    RegistroAsistencia.objects.create(estudiante=hijo, fecha="2026-07-01", estado=EstadoAsistencia.PRESENTE, marcado_por=docente_marcador)
    client.force_authenticate(padre_con_hijos)
    resp = client.get("/api/asistencia/registros/mis-hijos/")
    assert resp.status_code == 200
    hijos_ids = [h["estudiante_id"] for h in resp.data["hijos"]]
    assert len(hijos_ids) == 2  # solo los 2 hijos, no otros


def test_mis_hijos_sin_padre_devuelve_vacio(client, db):
    """Usuario con rol PADRE sin perfil asociado → hijos: []."""
    huerfano = Usuario.objects.create_user(username="huerf", password="p", rol=Rol.PADRE)
    client.force_authenticate(huerfano)
    resp = client.get("/api/asistencia/registros/mis-hijos/")
    assert resp.status_code == 200
    assert resp.data["hijos"] == []


def test_mis_hijos_no_accesible_por_estudiante(client, db):
    """Endpoint es solo para padres — otro rol da 403."""
    est_user = Usuario.objects.create_user(username="est", password="p", rol=Rol.ESTUDIANTE)
    client.force_authenticate(est_user)
    resp = client.get("/api/asistencia/registros/mis-hijos/")
    assert resp.status_code == 403


def test_mis_hijos_calcula_porcentaje_asistencia(client, padre_con_hijos, hijo, docente_marcador):
    """El porcentaje de asistencia se calcula con GROUP BY optimizado."""
    m = docente_marcador
    RegistroAsistencia.objects.create(estudiante=hijo, fecha="2026-07-01", estado=EstadoAsistencia.PRESENTE, marcado_por=m)
    RegistroAsistencia.objects.create(estudiante=hijo, fecha="2026-07-02", estado=EstadoAsistencia.PRESENTE, marcado_por=m)
    RegistroAsistencia.objects.create(estudiante=hijo, fecha="2026-07-03", estado=EstadoAsistencia.AUSENTE, marcado_por=m)
    RegistroAsistencia.objects.create(estudiante=hijo, fecha="2026-07-04", estado=EstadoAsistencia.TARDANZA, marcado_por=m)

    client.force_authenticate(padre_con_hijos)
    resp = client.get("/api/asistencia/registros/mis-hijos/")
    hijo_data = [h for h in resp.data["hijos"] if h["estudiante_id"] == hijo.pk][0]
    # 3 asistidos (2 presente + 1 tardanza) de 4 totales = 75%
    assert hijo_data["porcentaje_asistencia"] == 75.0
    assert hijo_data["total_registros"] == 4
