"""Tests para el flujo padre → hijo en incidencias (M1 sprint 4)."""
import pytest
from rest_framework.test import APIClient

from apps.incidencias.models import Incidencia, TipoIncidencia
from apps.usuarios.models import Estudiante, Matricula, Padre, Rol, Seccion, Usuario


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def admin_tic(db):
    return Usuario.objects.create_user(username="tic1", password="p", rol=Rol.ADMIN_TIC)


@pytest.fixture
def padre(db):
    return Usuario.objects.create_user(username="p1", password="p", rol=Rol.PADRE)


@pytest.fixture
def seccion(db):
    return Seccion.objects.create(nombre="1ro A", grado="1ro", letra="A")


@pytest.fixture
def hijo(db, seccion):
    u = Usuario.objects.create_user(username="e1", password="p", rol=Rol.ESTUDIANTE)
    est = Estudiante.objects.create(usuario=u, grado="1ro", seccion="A")
    Matricula.objects.create(estudiante=est, seccion=seccion, anio_lectivo=2026, codigo_matricula="20260001", situacion="matriculado")
    return est


@pytest.fixture
def estudiante_ajeno(db, seccion):
    u = Usuario.objects.create_user(username="e2", password="p", rol=Rol.ESTUDIANTE)
    est = Estudiante.objects.create(usuario=u, grado="1ro", seccion="A")
    Matricula.objects.create(estudiante=est, seccion=seccion, anio_lectivo=2026, codigo_matricula="20260002", situacion="matriculado")
    return est


@pytest.fixture
def padre_con_hijo(db, padre, hijo):
    perfil = Padre.objects.create(usuario=padre)
    perfil.hijos.add(hijo)
    return padre


def test_padre_ve_incidencias_de_su_hijo(client, admin_tic, padre_con_hijo, hijo):
    """Padre ve incidencias donde su hijo es `estudiante_afectado`."""
    Incidencia.objects.create(
        titulo="Rompió pantalla", descripcion="X", ubicacion="Aula",
        tipo=TipoIncidencia.PC, reportado_por=admin_tic,
        estudiante_afectado=hijo,
    )
    client.force_authenticate(padre_con_hijo)
    resp = client.get("/api/incidencias/")
    assert resp.status_code == 200
    items = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    assert len(items) == 1
    assert items[0]["estudiante_afectado"] == hijo.pk


def test_padre_no_ve_incidencias_de_otros_estudiantes(client, admin_tic, padre_con_hijo, estudiante_ajeno):
    """Padre NO ve incidencias donde el afectado no es su hijo."""
    Incidencia.objects.create(
        titulo="Otro caso", descripcion="X", ubicacion="Aula",
        tipo=TipoIncidencia.PC, reportado_por=admin_tic,
        estudiante_afectado=estudiante_ajeno,
    )
    client.force_authenticate(padre_con_hijo)
    resp = client.get("/api/incidencias/")
    items = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    assert len(items) == 0


def test_padre_no_ve_incidencias_sin_estudiante_afectado(client, admin_tic, padre_con_hijo):
    """Sin FK a estudiante, el padre no la ve — evita fugas de datos."""
    Incidencia.objects.create(
        titulo="Sin afectado", descripcion="X", ubicacion="Aula",
        tipo=TipoIncidencia.PC, reportado_por=admin_tic,
    )
    client.force_authenticate(padre_con_hijo)
    resp = client.get("/api/incidencias/")
    items = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    assert len(items) == 0
