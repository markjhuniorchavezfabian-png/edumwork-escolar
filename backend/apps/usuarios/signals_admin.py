"""Auto-marca es_administrador según rol y edición del sistema.

- Roles director/admin_tic → siempre es_administrador=True.
- Edición solo_docente + primer docente creado → es_administrador=True.
- Edición solo_docente + no hay admin activo → siguiente docente creado hereda es_administrador=True.
"""
from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import Usuario


@receiver(pre_save, sender=Usuario)
def auto_marcar_es_administrador(sender, instance, **kwargs):
    if instance.rol in ("director", "admin_tic"):
        instance.es_administrador = True
        return

    if settings.EDICION == "solo_docente" and instance.rol == "docente":
        if instance.pk:
            return
        hay_admin = Usuario.objects.filter(
            rol="docente", es_administrador=True, activo=True
        ).exists()
        if not hay_admin:
            instance.es_administrador = True
