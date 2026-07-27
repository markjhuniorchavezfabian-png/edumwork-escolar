"""Tests para el modelo BYOK (Bring Your Own Key) de LLMConfig."""
import pytest

from apps.ia.models import LLMConfig
from apps.usuarios.models import Rol, Usuario


@pytest.fixture
def director(db):
    return Usuario.objects.create_user(
        username="dir_test", password="p", rol=Rol.DIRECTOR,
    )


@pytest.fixture
def docente(db):
    return Usuario.objects.create_user(
        username="doc_test", password="p", rol=Rol.DOCENTE,
    )


@pytest.fixture
def config_institucional(db):
    return LLMConfig.objects.create(
        usuario=None,
        provider="deepseek",
        modelo_default="deepseek-chat",
        activo=True,
    )


@pytest.fixture
def config_docente(db, docente):
    return LLMConfig.objects.create(
        usuario=docente,
        provider="claude",
        modelo_default="claude-sonnet-4-6",
        activo=True,
    )


def test_get_para_usuario_sin_config_devuelve_institucional(config_institucional, docente):
    """Docente sin config propia recibe la institucional (fallback)."""
    cfg = LLMConfig.get_para(docente)
    assert cfg == config_institucional
    assert cfg.usuario_id is None


def test_get_para_usuario_con_config_devuelve_propia(config_institucional, config_docente, docente):
    """Docente con config propia recibe la suya, no la institucional."""
    cfg = LLMConfig.get_para(docente)
    assert cfg == config_docente
    assert cfg.usuario_id == docente.id
    assert cfg.provider == "claude"


def test_get_para_sin_config_alguna_devuelve_none(db, docente):
    """Sin ninguna config activa, devuelve None."""
    assert LLMConfig.get_para(docente) is None


def test_get_activa_solo_devuelve_institucional(config_institucional, config_docente):
    """`get_activa` es la institucional (compatibilidad con código previo)."""
    assert LLMConfig.get_activa() == config_institucional


def test_dos_config_activas_por_usuario_falla(db, docente):
    """El constraint `una activa por usuario` bloquea duplicados."""
    LLMConfig.objects.create(usuario=docente, provider="deepseek", modelo_default="x", activo=True)
    with pytest.raises(Exception):  # IntegrityError
        LLMConfig.objects.create(usuario=docente, provider="claude", modelo_default="y", activo=True)


def test_config_inactiva_no_es_devuelta_por_get_para(db, docente):
    """Config inactiva del docente no se usa; se cae al fallback institucional."""
    inst = LLMConfig.objects.create(usuario=None, provider="deepseek", modelo_default="x", activo=True)
    LLMConfig.objects.create(usuario=docente, provider="claude", modelo_default="y", activo=False)
    assert LLMConfig.get_para(docente) == inst
