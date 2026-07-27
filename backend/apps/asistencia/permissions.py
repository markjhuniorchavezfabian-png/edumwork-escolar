from rest_framework.permissions import BasePermission

from apps.usuarios.models import Rol


class PermisoAsistencia(BasePermission):
    """
    - Director, Admin TIC, Docente: pueden marcar y consultar todo.
    - Padre: solo puede consultar asistencias de sus hijos.
    - Estudiante: puede consultar la suya.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Escrituras solo para roles operativos
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            return request.user.rol in (Rol.DOCENTE, Rol.ADMIN_TIC, Rol.DIRECTOR)
        return True
