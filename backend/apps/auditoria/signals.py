"""Signals de auditoría automática para los modelos críticos del sistema.
Registra CREATE / UPDATE / DELETE de Incidencia, Equipo, RegistroAsistencia,
Visita, y cambios en LLMConfig."""
import threading

from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

# Local (evita import circular): se resuelven al ready()
from apps.incidencias.models import Incidencia
from apps.inventario.models import Equipo
from apps.asistencia.models import RegistroAsistencia
from apps.visitas.models import Visita
from apps.ia.models import LLMConfig

from .models import Auditoria, TipoAccion


# Thread-local para pasar user desde middleware
_local = threading.local()


def set_actor(user, ip=None):
    _local.user = user
    _local.ip = ip


def _actor():
    user = getattr(_local, "user", None)
    ip = getattr(_local, "ip", None)
    return user, ip


def _snapshot_dict(instance):
    """Extrae campos serializables de la instancia (ignorando FK profundas)."""
    out = {}
    for f in instance._meta.fields:
        try:
            v = getattr(instance, f.attname, None)
            if v is None:
                out[f.name] = None
            elif isinstance(v, (str, int, float, bool)):
                out[f.name] = v
            else:
                out[f.name] = str(v)
        except Exception:
            pass
    return out


def _registrar(instance, tipo, cambios=None, descripcion=""):
    user, ip = _actor()
    Auditoria.objects.create(
        usuario=user if (user and user.is_authenticated) else None,
        usuario_username=(user.username if (user and user.is_authenticated) else "sistema"),
        tipo=tipo,
        modelo=type(instance).__name__,
        objeto_id=str(getattr(instance, "pk", "")),
        descripcion=descripcion[:250],
        cambios=cambios or {},
        ip_origen=ip,
    )


# Guardamos snapshot pre-save para calcular diff en UPDATE
def _guardar_previa(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        anterior = sender.objects.filter(pk=instance.pk).first()
        instance._auditoria_previa = _snapshot_dict(anterior) if anterior else None
    except Exception:
        instance._auditoria_previa = None


def _procesar_post(sender, instance, created, **kwargs):
    if created:
        _registrar(instance, TipoAccion.CREAR, cambios=_snapshot_dict(instance),
                   descripcion=str(instance)[:250])
        return
    previa = getattr(instance, "_auditoria_previa", None)
    if not previa:
        _registrar(instance, TipoAccion.ACTUALIZAR, cambios={},
                   descripcion=str(instance)[:250])
        return
    actual = _snapshot_dict(instance)
    diff = {}
    for k, v_nuevo in actual.items():
        v_ant = previa.get(k)
        if v_ant != v_nuevo:
            diff[k] = {"antes": v_ant, "despues": v_nuevo}
    if diff:
        _registrar(instance, TipoAccion.ACTUALIZAR, cambios=diff,
                   descripcion=str(instance)[:250])


def _procesar_delete(sender, instance, **kwargs):
    _registrar(instance, TipoAccion.ELIMINAR,
               cambios=_snapshot_dict(instance),
               descripcion=str(instance)[:250])


# Registrar signals para cada modelo bajo auditoría
for modelo in (Incidencia, Equipo, RegistroAsistencia, Visita, LLMConfig):
    pre_save.connect(_guardar_previa, sender=modelo, weak=False)
    post_save.connect(_procesar_post, sender=modelo, weak=False)
    post_delete.connect(_procesar_delete, sender=modelo, weak=False)
