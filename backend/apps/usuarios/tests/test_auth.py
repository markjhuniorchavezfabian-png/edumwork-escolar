import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.usuarios.models import Usuario, Rol


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def director(db):
    u = Usuario.objects.create_user(
        username="director_test",
        password="test2026",
        rol=Rol.DIRECTOR,
        first_name="Dir",
        last_name="Test",
    )
    return u


def test_login_exitoso(client, director):
    resp = client.post("/api/auth/login/", {"username": "director_test", "password": "test2026"})
    assert resp.status_code == 200
    assert "access" in resp.data
    assert "refresh" in resp.data
    assert resp.data["usuario"]["rol"] == "director"


def test_login_credenciales_invalidas(client, db):
    resp = client.post("/api/auth/login/", {"username": "noexiste", "password": "mal"})
    assert resp.status_code == 401


def test_me_sin_token(client):
    resp = client.get("/api/auth/me/")
    assert resp.status_code == 401


def test_me_con_token(client, director):
    login = client.post("/api/auth/login/", {"username": "director_test", "password": "test2026"})
    token = login.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    resp = client.get("/api/auth/me/")
    assert resp.status_code == 200
    assert resp.data["username"] == "director_test"
    assert resp.data["rol"] == "director"


def test_refresh_token(client, director):
    login = client.post("/api/auth/login/", {"username": "director_test", "password": "test2026"})
    refresh_token = login.data["refresh"]
    resp = client.post("/api/auth/refresh/", {"refresh": refresh_token})
    assert resp.status_code == 200
    assert "access" in resp.data


def test_mi_cuenta_con_token(client, director):
    login = client.post("/api/auth/login/", {"username": "director_test", "password": "test2026"})
    token = login.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    resp = client.get("/api/auth/mi-cuenta/")

    assert resp.status_code == 200
    assert resp.data["modo_cuenta"] == "institucional"
    assert resp.data["integrado_a_ie_en"] is None


def test_mi_backup_con_token(client, director):
    login = client.post("/api/auth/login/", {"username": "director_test", "password": "test2026"})
    token = login.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    resp = client.get("/api/auth/mi-backup/")

    assert resp.status_code == 200
    assert resp.data["usuario"]["username"] == "director_test"
    assert resp.data["usuario"]["rol"] == "director"
    assert "generado_en" in resp.data
