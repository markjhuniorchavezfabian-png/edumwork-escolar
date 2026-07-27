from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .signals import set_actor


def _ip(request):
    x = request.META.get("HTTP_X_FORWARDED_FOR")
    if x:
        return x.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class ActorAuditoriaMiddleware:
    """Guarda el actor (usuario JWT o de sesión) en thread-local para signals.
    Para rutas /api/*, resuelve el JWT directamente sin esperar a la view."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt = JWTAuthentication()

    def __call__(self, request):
        user = None
        ip = _ip(request)

        # Autenticación de sesión (admin Django)
        sess_user = getattr(request, "user", None)
        if sess_user and getattr(sess_user, "is_authenticated", False):
            user = sess_user

        # JWT en rutas /api/*
        if not user and request.path.startswith("/api/"):
            try:
                resultado = self.jwt.authenticate(request)
                if resultado:
                    user, _ = resultado
            except (InvalidToken, TokenError, Exception):
                pass

        set_actor(user, ip=ip)
        return self.get_response(request)
