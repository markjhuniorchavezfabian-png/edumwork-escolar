"""Tareas de mantenimiento del servidor del colegio.

Son las dos cosas que evitan que un VPS sin nadie mirándolo se degrade solo:
purgar la bitácora (el único dato que crece sin techo) y avisar antes de que el
disco se llene — porque cuando se llena, Postgres deja de aceptar escrituras y
el colegio se queda sin poder marcar asistencia.
"""
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.auditoria.models import Auditoria, TipoAccion
from apps.notificaciones.models import Notificacion
from apps.usuarios.models import Rol, Usuario


def _auditoria(dias_atras: int):
    reg = Auditoria.objects.create(
        tipo=TipoAccion.CREAR, modelo="RegistroAsistencia", usuario_username="sistema",
    )
    # `creado_en` es auto_now_add: hay que pisarlo con UPDATE.
    Auditoria.objects.filter(pk=reg.pk).update(
        creado_en=timezone.now() - timezone.timedelta(days=dias_atras)
    )
    return reg


def _correr(comando, **kwargs):
    salida = StringIO()
    call_command(comando, stdout=salida, stderr=salida, **kwargs)
    return salida.getvalue()


# ── purgar_auditoria ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_purga_solo_lo_mas_viejo_que_el_corte():
    viejo = _auditoria(dias_atras=800)
    reciente = _auditoria(dias_atras=30)

    _correr("purgar_auditoria", meses=18, aplicar=True)

    assert not Auditoria.objects.filter(pk=viejo.pk).exists()
    assert Auditoria.objects.filter(pk=reciente.pk).exists()


@pytest.mark.django_db
def test_preview_no_borra():
    _auditoria(dias_atras=800)

    salida = _correr("purgar_auditoria", meses=18)

    assert Auditoria.objects.count() == 1
    assert "no se borró nada" in salida


@pytest.mark.django_db
def test_se_niega_a_dejar_menos_de_seis_meses_de_bitacora():
    _auditoria(dias_atras=800)

    salida = _correr("purgar_auditoria", meses=3, aplicar=True)

    assert Auditoria.objects.count() == 1
    assert "sin respaldo ante un reclamo" in salida


@pytest.mark.django_db
def test_purga_por_lotes_sin_dejar_nada_atras():
    """El borrado va en lotes de 5000: con más de un lote no debe cortarse."""
    for _ in range(12):
        _auditoria(dias_atras=800)

    with patch("apps.auditoria.management.commands.purgar_auditoria.LOTE", 5):
        _correr("purgar_auditoria", meses=18, aplicar=True)

    assert Auditoria.objects.count() == 0


# ── chequear_disco ───────────────────────────────────────────────────────────

def _disco(pct_usado):
    total = 100 * 1024 ** 3
    usado = int(total * pct_usado / 100)

    class Uso:
        pass
    u = Uso()
    u.total, u.used, u.free = total, usado, total - usado
    return u


@pytest.fixture
def dirigentes(db):
    return [
        Usuario.objects.create_user(username="dire", password="x", rol=Rol.DIRECTOR),
        Usuario.objects.create_user(username="tic", password="x", rol=Rol.ADMIN_TIC),
        # Un docente NO debería recibir este aviso: no puede hacer nada al respecto.
        Usuario.objects.create_user(username="doc", password="x", rol=Rol.DOCENTE),
    ]


@pytest.mark.django_db
def test_no_avisa_si_hay_espacio(dirigentes):
    with patch("shutil.disk_usage", return_value=_disco(55)):
        salida = _correr("chequear_disco")

    assert Notificacion.objects.count() == 0
    assert "Por debajo del umbral" in salida


@pytest.mark.django_db
def test_avisa_a_direccion_y_tic_cuando_se_pasa_del_umbral(dirigentes):
    with patch("shutil.disk_usage", return_value=_disco(85)):
        _correr("chequear_disco")

    destinatarios = set(Notificacion.objects.values_list("destinatario__username", flat=True))
    assert destinatarios == {"dire", "tic"}
    assert "85%" in Notificacion.objects.first().titulo


@pytest.mark.django_db
def test_umbral_configurable(dirigentes):
    with patch("shutil.disk_usage", return_value=_disco(70)):
        _correr("chequear_disco", umbral=60)

    assert Notificacion.objects.count() == 2
