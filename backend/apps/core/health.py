"""Endpoint de health check para monitoreo / balanceadores de carga."""
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


@require_GET
@never_cache
def health_check(request):
    """Retorna 200 si BD está OK, 503 si no."""
    checks = {"database": "unknown"}
    status = 200

    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:100]}"
        status = 503

    from django.utils import timezone
    return JsonResponse({
        "status": "ok" if status == 200 else "degraded",
        "timestamp": timezone.now().isoformat(),
        "checks": checks,
    }, status=status)
