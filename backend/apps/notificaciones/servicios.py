"""Servicio central para crear notificaciones y despacharlas por canales.
En Fase 1: in-app (siempre) + email (si SMTP configurado y usuario acepta).
En Fase 2: WhatsApp Business API."""
import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import Notificacion, PreferenciasNotificacion

log = logging.getLogger(__name__)


def notificar(
    destinatario,
    titulo: str,
    cuerpo: str,
    tipo: str = "general",
    url_accion: str = "",
    forzar_email: bool = False,
    allow_email: bool = True,
) -> Notificacion:
    """Crea la notificación in-app y despacha por email si corresponde.
    `allow_email=False` bloquea el email aunque el usuario tenga recibir_email=True.
    Úsalo cuando el config institucional deshabilite emails para ese tipo de evento."""
    canales = ["app"]

    prefs, _ = PreferenciasNotificacion.objects.get_or_create(usuario=destinatario)

    # Filtrado por tipo según preferencias
    campo_pref = f"recibir_{tipo}"
    if hasattr(prefs, campo_pref) and not getattr(prefs, campo_pref):
        log.info(f"Usuario {destinatario.username} deshabilitó notificaciones de tipo {tipo}")
        return None

    # Email — respeta: flag global (allow_email) + forzado (emergencias) + preferencia usuario
    puede_email = allow_email and (forzar_email or prefs.recibir_email)
    if puede_email and destinatario.email:
        try:
            enviar_email(destinatario.email, titulo, cuerpo)
            canales.append("email")
        except Exception as e:
            _categorizar_error_smtp(e, destinatario.email)

    notif = Notificacion.objects.create(
        destinatario=destinatario,
        tipo=tipo,
        titulo=titulo,
        cuerpo=cuerpo,
        url_accion=url_accion,
        canales_enviados=",".join(canales),
    )
    return notif


def enviar_email(to: str, subject: str, body: str):
    """Envío simple. Si no hay backend SMTP configurado, usa consola en dev."""
    from apps.core.utils import get_from_email
    from_email = get_from_email()
    send_mail(subject, body, from_email, [to], fail_silently=False)


def _categorizar_error_smtp(exc: Exception, destinatario: str = ""):
    """Loguea el error SMTP con un mensaje descriptivo para el admin."""
    msg = str(exc).lower()
    if any(k in msg for k in ("authentication", "535", "username", "password", "credentials")):
        log.error(
            f"SMTP: credenciales incorrectas — verificá usuario/contraseña en Configuración → SMTP. "
            f"Destino: {destinatario} | Error: {exc}"
        )
    elif any(k in msg for k in ("connection refused", "timed out", "network", "timeout", "connect")):
        log.error(
            f"SMTP: no se pudo conectar al servidor — verificá host y puerto en Configuración → SMTP. "
            f"Destino: {destinatario} | Error: {exc}"
        )
    elif any(k in msg for k in ("quota", "rate", "too many", "limit", "550")):
        log.warning(
            f"SMTP: límite de envío alcanzado — esperá o cambiá de proveedor. "
            f"Destino: {destinatario} | Error: {exc}"
        )
    elif any(k in msg for k in ("recipient", "invalid", "does not exist", "550", "553")):
        log.warning(
            f"SMTP: dirección de destino inválida — {destinatario} | Error: {exc}"
        )
    else:
        log.warning(f"SMTP: fallo al enviar a {destinatario} | Error: {exc}")
