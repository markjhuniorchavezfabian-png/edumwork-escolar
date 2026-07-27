from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "Core"

    def ready(self):
        # Registrar signals de compresión de imágenes
        try:
            from .signals_media import registrar_compresion
            registrar_compresion()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"No se pudo registrar compresión: {e}")
