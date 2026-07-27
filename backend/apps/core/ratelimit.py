"""Decorador de rate-limit compatible con DRF @api_view."""
from functools import wraps

from django_ratelimit import ALL
from django_ratelimit.core import is_ratelimited
from rest_framework.response import Response


def ratelimit_drf(*, key="ip", rate="10/m", method=ALL, block=True):
    """Aplica django-ratelimit a una vista DRF (@api_view).

    Uso:
        @api_view(["POST"])
        @permission_classes([AllowAny])
        @ratelimit_drf(rate="5/h")
        def solicitar_reset_password(request):
            ...

    Cuando se excede, responde 429 con mensaje amigable en JSON.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            # django-ratelimit necesita HttpRequest, no Request de DRF
            http_request = getattr(request, "_request", request)
            limited = is_ratelimited(
                request=http_request,
                group=f"{view_func.__module__}.{view_func.__name__}",
                fn=view_func,
                key=key,
                rate=rate,
                method=method,
                increment=True,
            )
            if limited and block:
                return Response(
                    {"error": "Demasiadas solicitudes. Intenta de nuevo en unos minutos."},
                    status=429,
                )
            return view_func(request, *args, **kwargs)
        return _wrapped
    return decorator
