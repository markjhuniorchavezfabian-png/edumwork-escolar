import pytest
from rest_framework.test import APIClient

from apps.incidencias.models import EstadoIncidencia, Incidencia, TipoIncidencia
from apps.usuarios.models import Rol, Usuario


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def docente(db):
    return Usuario.objects.create_user(
        username="doc_test", password="pass2026", rol=Rol.DOCENTE,
        first_name="Doc", last_name="Test",
    )


@pytest.fixture
def docente_otro(db):
    return Usuario.objects.create_user(
        username="doc_otro", password="pass2026", rol=Rol.DOCENTE,
        first_name="Otro", last_name="Test",
    )


@pytest.fixture
def admin_tic(db):
    return Usuario.objects.create_user(
        username="tic_test", password="pass2026", rol=Rol.ADMIN_TIC,
        first_name="TIC", last_name="Test",
    )


@pytest.fixture
def director(db):
    return Usuario.objects.create_user(
        username="dir_test", password="pass2026", rol=Rol.DIRECTOR,
        first_name="Dir", last_name="Test",
    )


def _auth(client, user):
    client.force_authenticate(user=user)
    return client


def _crear_incidencia(user, **kw):
    defaults = dict(
        titulo="Proyector no enciende",
        descripcion="No responde el botón de encendido.",
        ubicacion="Aula 5to A",
        tipo=TipoIncidencia.PROYECTOR,
        reportado_por=user,
    )
    defaults.update(kw)
    return Incidencia.objects.create(**defaults)


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_1_docente_crea_incidencia(client, docente):
    _auth(client, docente)
    resp = client.post("/api/incidencias/", {
        "titulo": "Proyector no enciende",
        "descripcion": "Al presionar el botón no responde.",
        "ubicacion": "Aula 5to A",
        "tipo": "proyector",
        "prioridad": "alta",
    }, format="json")
    assert resp.status_code == 201, resp.data
    assert resp.data["estado"] == "nueva"
    assert resp.data["reportado_por"] == docente.id


def test_2_docente_lista_solo_las_suyas(client, docente, docente_otro):
    _crear_incidencia(docente, titulo="Mia")
    _crear_incidencia(docente_otro, titulo="Ajena")
    _auth(client, docente)
    resp = client.get("/api/incidencias/")
    assert resp.status_code == 200
    titulos = [i["titulo"] for i in resp.data["results"]]
    assert "Mia" in titulos
    assert "Ajena" not in titulos


def test_3_admin_tic_lista_todas(client, docente, docente_otro, admin_tic):
    _crear_incidencia(docente, titulo="A")
    _crear_incidencia(docente_otro, titulo="B")
    _auth(client, admin_tic)
    resp = client.get("/api/incidencias/")
    assert resp.status_code == 200
    assert resp.data["count"] == 2


def test_4_admin_pasa_a_en_atencion(client, docente, admin_tic):
    inc = _crear_incidencia(docente)
    _auth(client, admin_tic)
    resp = client.patch(f"/api/incidencias/{inc.id}/", {"estado": "en_atencion"}, format="json")
    assert resp.status_code == 200, resp.data
    inc.refresh_from_db()
    assert inc.estado == "en_atencion"
    assert inc.fecha_atencion is not None
    assert inc.asignado_a_id == admin_tic.id


def test_5_admin_no_puede_resolver_sin_solucion(client, docente, admin_tic):
    inc = _crear_incidencia(docente, estado=EstadoIncidencia.EN_ATENCION)
    _auth(client, admin_tic)
    resp = client.patch(f"/api/incidencias/{inc.id}/", {"estado": "resuelta"}, format="json")
    assert resp.status_code == 400
    assert "solucion" in resp.data


def test_6_admin_resuelve_con_solucion(client, docente, admin_tic):
    inc = _crear_incidencia(docente, estado=EstadoIncidencia.EN_ATENCION)
    _auth(client, admin_tic)
    resp = client.patch(
        f"/api/incidencias/{inc.id}/",
        {"estado": "resuelta", "solucion": "Se cambió el cable HDMI."},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    inc.refresh_from_db()
    assert inc.estado == "resuelta"
    assert inc.fecha_resolucion is not None


def test_7_docente_cierra_su_incidencia_resuelta(client, docente):
    inc = _crear_incidencia(
        docente,
        estado=EstadoIncidencia.RESUELTA,
        solucion="Ya se resolvió.",
    )
    _auth(client, docente)
    resp = client.patch(f"/api/incidencias/{inc.id}/", {"estado": "cerrada"}, format="json")
    assert resp.status_code == 200, resp.data
    inc.refresh_from_db()
    assert inc.estado == "cerrada"


def test_8_docente_no_puede_cerrar_incidencia_ajena(client, docente, docente_otro):
    inc = _crear_incidencia(
        docente_otro,
        estado=EstadoIncidencia.RESUELTA,
        solucion="Solución cualquiera.",
    )
    _auth(client, docente)
    resp = client.patch(f"/api/incidencias/{inc.id}/", {"estado": "cerrada"}, format="json")
    # El docente no puede ver ni tocar incidencias ajenas: 404 (queryset filtrado) o 403.
    assert resp.status_code in (403, 404)


def test_9_director_elimina(client, docente, director):
    inc = _crear_incidencia(docente)
    _auth(client, director)
    resp = client.delete(f"/api/incidencias/{inc.id}/")
    assert resp.status_code == 204
    assert not Incidencia.objects.filter(id=inc.id).exists()


def test_10_docente_no_puede_eliminar(client, docente):
    inc = _crear_incidencia(docente)
    _auth(client, docente)
    resp = client.delete(f"/api/incidencias/{inc.id}/")
    assert resp.status_code == 403


def test_11_kpis_estructura(client, docente, admin_tic, director):
    _crear_incidencia(docente, estado=EstadoIncidencia.NUEVA)
    _crear_incidencia(docente, estado=EstadoIncidencia.EN_ATENCION)
    _crear_incidencia(
        docente,
        estado=EstadoIncidencia.RESUELTA,
        solucion="ok",
    )
    _auth(client, director)
    resp = client.get("/api/incidencias/kpis/")
    assert resp.status_code == 200, resp.data
    data = resp.data
    assert data["total"] == 3
    assert set(data["por_estado"].keys()) == {"nueva", "en_atencion", "resuelta", "cerrada"}
    assert set(data["por_tipo"].keys()) >= {"proyector", "pc", "red", "pizarra", "impresora", "otro"}
    assert set(data["por_prioridad"].keys()) == {"alta", "media", "baja"}
    assert "tiempo_promedio_resolucion_horas" in data
    assert isinstance(data["por_ubicacion_top5"], list)
