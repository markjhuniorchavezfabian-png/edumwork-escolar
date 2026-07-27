from django.conf import settings


def get_email_institucional() -> str:
    """Devuelve el email institucional configurado, o el env DEFAULT_FROM_EMAIL, o el fallback de EduMWork."""
    from .models import ConfiguracionInstitucional
    cfg = ConfiguracionInstitucional.get_solo()
    return cfg.email_institucional or getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@edumwork.pe")


def get_from_email() -> str:
    """Alias semántico para el remitente por defecto de correos del sistema."""
    return get_email_institucional()
