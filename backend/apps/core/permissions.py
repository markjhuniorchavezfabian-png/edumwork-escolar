from rest_framework.permissions import BasePermission


class EsSoloLectura(BasePermission):
    def has_permission(self, request, view):
        return request.method in ("GET", "HEAD", "OPTIONS")
