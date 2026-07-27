from rest_framework.permissions import BasePermission

from apps.usuarios.models import Rol


class PermisoIncidencia(BasePermission):
    """
    Permisos del módulo Incidencias TI.

    - Todos los autenticados pueden listar; la view filtra el queryset por rol.
    - Solo docente y admin_tic pueden crear.
    - Solo admin_tic puede modificar (estado, notas, asignación).
    - El owner (docente que reportó) puede cerrar sus incidencias en estado 'resuelta'.
    - Solo director puede eliminar.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method == "POST":
            return request.user.rol in (Rol.DOCENTE, Rol.ADMIN_TIC)
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user

        if request.method in ("GET", "HEAD", "OPTIONS"):
            if user.rol in (Rol.ADMIN_TIC, Rol.DIRECTOR):
                return True
            if obj.reportado_por_id == user.id:
                return True
            # Padre puede ver la incidencia si su hijo es el estudiante afectado
            if user.rol == Rol.PADRE and obj.estudiante_afectado_id:
                try:
                    return user.perfil_padre.hijos.filter(
                        pk=obj.estudiante_afectado_id
                    ).exists()
                except AttributeError:
                    return False
            return False

        if request.method == "DELETE":
            return user.rol == Rol.DIRECTOR

        if request.method in ("PATCH", "PUT"):
            if user.rol == Rol.ADMIN_TIC:
                return True
            if obj.reportado_por_id == user.id and obj.estado == "resuelta":
                return True
            return False

        return False
