"""
Signal que auto-asigna `owner` a modelos multi-tenant cuando el request
lo dispara un usuario en modo personal.

Sin esto, un docente personal crearía registros sin owner → los perdería
en la próxima query (porque el manager filtra por owner=user.id).
"""

from django.db.models.signals import pre_save
from django.dispatch import receiver

from .tenant import get_current_user, es_modo_personal


@receiver(pre_save)
def auto_asignar_owner_pre_save(sender, instance, **kwargs):
    """
    Si el modelo tiene un campo `owner_id` y el request es de un usuario
    en modo=personal, y el owner está vacío, lo asignamos automáticamente.
    """
    # Solo modelos con campo owner
    if not hasattr(instance, "owner_id"):
        return
    if instance.owner_id:  # ya tiene owner, no tocar
        return
    user = get_current_user()
    if es_modo_personal(user):
        instance.owner_id = user.id
