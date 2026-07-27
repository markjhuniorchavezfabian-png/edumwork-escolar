from rest_framework.permissions import BasePermission
from .models import Rol


# ── Grupos de roles canónicos (fuente única de verdad) ──────────────────────
ROLES_GESTIONAN_USUARIOS = (Rol.DIRECTOR, Rol.SUBDIRECTOR, Rol.ADMIN_TIC, Rol.SECRETARIA)
ROLES_DIRECTIVOS = (Rol.DIRECTOR, Rol.SUBDIRECTOR)
ROLES_STAFF_COMPLETO = (
    Rol.DIRECTOR, Rol.SUBDIRECTOR, Rol.DOCENTE, Rol.ADMIN_TIC,
    Rol.SECRETARIA, Rol.AUXILIAR, Rol.PSICOLOGA,
)
ROLES_APROBADORES_JUSTIF = (Rol.DOCENTE, Rol.AUXILIAR)


def puede_gestionar_usuarios(user) -> bool:
    """Fuente única. Director/subdirector/admin_tic/secretaria pueden gestionar cuentas."""
    return getattr(user, "rol", None) in ROLES_GESTIONAN_USUARIOS


class EsRol(BasePermission):
    """Permite solo a usuarios con uno de los roles especificados."""
    roles_permitidos: list[str] = []

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.rol in self.roles_permitidos


class EsDirector(EsRol):
    roles_permitidos = [Rol.DIRECTOR]


class EsAdminTIC(EsRol):
    roles_permitidos = [Rol.ADMIN_TIC]


class EsDirectorOAdminTIC(EsRol):
    roles_permitidos = [Rol.DIRECTOR, Rol.ADMIN_TIC]


class EsDocente(EsRol):
    roles_permitidos = [Rol.DOCENTE]
