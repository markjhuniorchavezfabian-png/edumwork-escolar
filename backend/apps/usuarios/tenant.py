"""
Aislamiento multi-tenant para cuentas personales de docente.

Idea: guardamos request.user en thread-local via middleware.
Los managers de modelos "docente-owned" filtran automáticamente por owner
cuando el usuario está en modo=personal.

Así el código de queries existente no necesita cambios — el filtro es transparente.
En modo=institucional (default), los managers NO filtran (backward compat).
"""

import threading

from django.db import models


_local = threading.local()


def set_current_user(user):
    _local.user = user


def get_current_user():
    return getattr(_local, "user", None)


def clear_current_user():
    if hasattr(_local, "user"):
        del _local.user


def es_modo_personal(user=None) -> bool:
    """True si el usuario actual (o el pasado) está en modo personal."""
    u = user or get_current_user()
    if not u or not getattr(u, "is_authenticated", False):
        return False
    return getattr(u, "modo_cuenta", None) == "personal"


class CurrentUserMiddleware:
    """
    Registra request.user en thread-local para uso de los managers.
    Debe ir DESPUÉS de AuthenticationMiddleware en MIDDLEWARE.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            set_current_user(user)
        try:
            return self.get_response(request)
        finally:
            clear_current_user()


class OwnedManager(models.Manager):
    """
    Manager que filtra por `owner` cuando el request lo dispara un usuario personal.

    Uso:
        class MiModelo(models.Model):
            owner = models.ForeignKey(
                'usuarios.Usuario', on_delete=models.CASCADE,
                null=True, blank=True, related_name='+', db_index=True,
            )
            objects = OwnedManager()

    Comportamiento:
        - Modo institucional: Nota.objects.all() → todo (backward compat)
        - Modo personal:     Nota.objects.all() → filtra por owner=user actual
        - Sin request (management, scripts): sin filtro
    """
    def get_queryset(self):
        qs = super().get_queryset()
        user = get_current_user()
        if es_modo_personal(user):
            return qs.filter(owner_id=user.id)
        return qs

    def all_tenants(self):
        """Escape hatch: bypass del filtro cuando necesitas ver TODO (admin, migrations)."""
        return super().get_queryset()


def auto_asignar_owner(instance, user=None):
    """
    Helper para asignar owner al guardar un modelo desde un usuario personal.
    Usar en views/serializers antes de instance.save().
    """
    u = user or get_current_user()
    if es_modo_personal(u) and hasattr(instance, "owner_id") and not instance.owner_id:
        instance.owner = u


# ── DRF JWT wrapper: setea el thread-local en la fase de auth ──────────────
# El middleware normal de Django no ve el user de JWT (DRF lo autentica después).
# Por eso subclaseamos JWTAuthentication para setear el thread-local temprano.

from rest_framework_simplejwt.authentication import JWTAuthentication as _JWTBase


class TenantAwareJWTAuthentication(_JWTBase):
    """Reemplaza al JWTAuthentication default en REST_FRAMEWORK settings."""
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is not None:
            user, _token = result
            set_current_user(user)
        return result
