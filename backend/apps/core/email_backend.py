"""Backend de email que lee la configuración SMTP desde la BD en cada envío.
Si la BD tiene SMTP configurado, lo usa. Si no, cae en el backend de env vars."""
from django.core.mail.backends.smtp import EmailBackend as SmtpBackend
from django.core.mail.backends.console import EmailBackend as ConsoleBackend


class DbSmtpEmailBackend:
    """Lee config SMTP de ConfiguracionInstitucional. Fallback a console si no hay."""

    def __init__(self, **kwargs):
        from .models import ConfiguracionInstitucional
        cfg = ConfiguracionInstitucional.get_solo()

        if cfg.smtp_host and cfg.smtp_user and cfg.smtp_password:
            self._backend = SmtpBackend(
                host=cfg.smtp_host,
                port=cfg.smtp_port or 587,
                username=cfg.smtp_user,
                password=cfg.smtp_password,
                use_tls=cfg.smtp_use_tls,
                **kwargs,
            )
        else:
            # Sin config en BD → probar env vars (Django ya los cargó en settings)
            from django.conf import settings
            if getattr(settings, "EMAIL_HOST", ""):
                self._backend = SmtpBackend(**kwargs)
            else:
                self._backend = ConsoleBackend(**kwargs)

    def open(self): return self._backend.open()
    def close(self): return self._backend.close()
    def send_messages(self, messages): return self._backend.send_messages(messages)
    def __enter__(self): return self._backend.__enter__()
    def __exit__(self, *a): return self._backend.__exit__(*a)
