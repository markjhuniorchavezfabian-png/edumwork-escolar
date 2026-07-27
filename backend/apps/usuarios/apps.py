from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.usuarios"
    verbose_name = "Usuarios"

    def ready(self):
        # Registrar signals de auto-tenant
        from . import signals_tenant  # noqa: F401
        from . import signals_admin  # noqa: F401
