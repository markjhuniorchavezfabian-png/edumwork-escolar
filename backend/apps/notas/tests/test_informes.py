import pytest
from rest_framework.test import APIClient

from apps.usuarios.models import Rol, Seccion, Usuario


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def director(db):
    return Usuario.objects.create_user(
        username="dir_informes",
        password="pass2026",
        rol=Rol.DIRECTOR,
        first_name="Dir",
        last_name="Informes",
    )


def test_informe_solo_datos_no_invoca_ia(client, director, monkeypatch):
    seccion = Seccion.objects.create(nombre="1ro A", grado="1", letra="A", nivel="primaria")

    def fail_if_called(*args, **kwargs):
        raise AssertionError("No debe invocar IA cuando solo_datos=1")

    monkeypatch.setattr("apps.ia.servicios.generar_informe_notas", fail_if_called)
    client.force_authenticate(user=director)

    resp = client.get(f"/api/notas/informe/?seccion_id={seccion.id}&bimestre=1&anio=2026&solo_datos=1")

    assert resp.status_code == 200, resp.data
    assert resp.data["narrativa"] is None
    assert resp.data["seccion"] == "1ro A"
