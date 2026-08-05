"""
Endpoints de invitación e integración de docentes a la I.E.

- POST /auth/invitar-docente/     : director invita docente a la IE
- GET  /auth/invitaciones/        : director lista invitaciones enviadas
- GET  /auth/invitacion/<token>/  : docente ve detalles de la invitación
- POST /auth/aceptar-invitacion/  : docente acepta y crea cuenta institucional
"""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import InvitacionDocente, Rol, Usuario



# ══════════════════════════════════════════════════════════════════════════════
# INTEGRACIÓN CON I.E. (Fase 3)
# ══════════════════════════════════════════════════════════════════════════════

ROLES_INVITAR = ("director", "subdirector", "admin_tic", "secretaria")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mi_cuenta(request):
    """Datos mínimos de modalidad de cuenta usados por Mi perfil."""
    user = request.user
    return Response({
        "modo_cuenta": user.modo_cuenta,
        "integrado_a_ie_en": user.integrado_a_ie_en.isoformat() if user.integrado_a_ie_en else None,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mi_backup(request):
    """Backup JSON básico de la cuenta del usuario autenticado."""
    user = request.user
    return Response({
        "generado_en": timezone.now().isoformat(),
        "usuario": {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "rol": user.rol,
            "dni": user.dni,
            "telefono": user.telefono,
            "modo_cuenta": user.modo_cuenta,
            "integrado_a_ie_en": user.integrado_a_ie_en.isoformat() if user.integrado_a_ie_en else None,
        },
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def invitar_docente(request):
    """
    Director/admin_tic invita a un docente a integrarse a la I.E.
    Si el docente ya tiene cuenta personal (por email), la invitación queda
    lista para que la acepte y su data se una a la I.E. sin migrar.

    Body: { email, area_sugerida?, mensaje? }
    """
    if request.user.rol not in ROLES_INVITAR:
        return Response({"error": "No autorizado."}, status=403)

    email = (request.data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return Response({"error": "Email inválido."}, status=400)

    # ¿Ya existe cuenta personal con ese email?
    target = Usuario.objects.filter(email__iexact=email).first()

    # ¿Ya hay invitación pendiente vigente?
    pendiente = InvitacionDocente.objects.filter(
        email=email, estado=InvitacionDocente.ESTADO_PENDIENTE,
        expira_en__gt=timezone.now(),
    ).first()
    if pendiente:
        return Response({
            "error": "Ya hay una invitación pendiente para ese email.",
            "token": pendiente.token,
            "expira_en": pendiente.expira_en.isoformat(),
        }, status=409)

    inv = InvitacionDocente.objects.create(
        email=email,
        invitado_por=request.user,
        docente_target=target,
        area_sugerida=(request.data.get("area_sugerida") or "").strip()[:80],
        mensaje=(request.data.get("mensaje") or "").strip()[:2000],
    )

    # Enviar email (best-effort, no bloquea si falla)
    try:
        from django.core.mail import send_mail
        from django.conf import settings
        from apps.core.utils import get_from_email
        base_url = getattr(settings, "FRONTEND_URL", "")
        if not base_url and settings.CORS_ALLOWED_ORIGINS:
            base_url = settings.CORS_ALLOWED_ORIGINS[0]
        link = f"{base_url}/aceptar-invitacion/{inv.token}" if base_url else f"[configurar FRONTEND_URL]/aceptar-invitacion/{inv.token}"
        cuerpo = (
            f"Has sido invitado/a por {request.user.get_full_name()} a integrarte "
            f"al sistema del colegio.\n\n"
            f"Abre este enlace para aceptar (válido 14 días):\n"
            f"{link}\n\n"
            f"{inv.mensaje}"
        )
        send_mail(
            subject="Invitación a integrarte al sistema del colegio",
            message=cuerpo,
            from_email=get_from_email(),
            recipient_list=[email],
            fail_silently=True,
        )
    except Exception:
        pass

    return Response({
        "ok": True,
        "token": inv.token,
        "email": email,
        "existe_cuenta_previa": target is not None,
        "expira_en": inv.expira_en.isoformat(),
        "link_manual": f"/aceptar-invitacion/{inv.token}",
    }, status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def ver_invitacion(request, token):
    """Docente ve los detalles de la invitación antes de aceptar."""
    try:
        inv = InvitacionDocente.objects.select_related("invitado_por").get(token=token)
    except InvitacionDocente.DoesNotExist:
        return Response({"error": "Invitación no encontrada."}, status=404)

    if not inv.valida:
        if timezone.now() >= inv.expira_en and inv.estado == InvitacionDocente.ESTADO_PENDIENTE:
            inv.estado = InvitacionDocente.ESTADO_EXPIRADA
            inv.save(update_fields=["estado"])
        return Response({
            "valida": False,
            "estado": inv.estado,
            "email": inv.email,
        })

    return Response({
        "valida": True,
        "email": inv.email,
        "invitado_por": inv.invitado_por.get_full_name() if inv.invitado_por else "Director",
        "area_sugerida": inv.area_sugerida,
        "mensaje": inv.mensaje,
        "existe_cuenta_previa": inv.docente_target is not None,
        "expira_en": inv.expira_en.isoformat(),
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def aceptar_invitacion(request):
    """
    Docente acepta la invitación.
    - Si ya tenía cuenta personal → su modo cambia a institucional, datos se conservan
    - Si no tenía → recibe { username, password } y creamos su cuenta institucional

    Body: { token, password? (solo si es cuenta nueva), username? }
    """
    token = (request.data.get("token") or "").strip()
    if not token:
        return Response({"error": "Token requerido."}, status=400)

    with transaction.atomic():
        try:
            inv = InvitacionDocente.objects.select_for_update().get(token=token)
        except InvitacionDocente.DoesNotExist:
            return Response({"error": "Invitación no encontrada."}, status=404)

        if not inv.valida:
            return Response({"error": f"Invitación {inv.estado}."}, status=400)

        if inv.docente_target:
            # Cuenta personal existente → convertirla
            u = inv.docente_target
            u.modo_cuenta = Usuario.MODO_INSTITUCIONAL
            u.integrado_a_ie_en = timezone.now()
            u.save(update_fields=["modo_cuenta", "integrado_a_ie_en"])
            mensaje = "Tu cuenta personal ahora es parte del colegio. Tus datos se conservan."
        else:
            # Cuenta nueva desde 0
            username = (request.data.get("username") or "").strip().lower()
            password = request.data.get("password") or ""
            first_name = (request.data.get("first_name") or "").strip()
            last_name = (request.data.get("last_name") or "").strip()
            if not (username and password and first_name and last_name):
                return Response({
                    "error": "Cuenta nueva: envía username, password, first_name, last_name.",
                }, status=400)
            if Usuario.objects.filter(username=username).exists():
                return Response({"error": "Ese usuario ya existe."}, status=409)
            try:
                validate_password(password)
            except DjangoValidationError as e:
                return Response({"error": " ".join(e.messages)}, status=400)

            u = Usuario.objects.create_user(
                username=username, password=password,
                first_name=first_name, last_name=last_name,
                email=inv.email, rol=Rol.DOCENTE,
                modo_cuenta=Usuario.MODO_INSTITUCIONAL,
                integrado_a_ie_en=timezone.now(),
                activo=True,
            )
            mensaje = "Cuenta creada e integrada al colegio."

        inv.estado = InvitacionDocente.ESTADO_ACEPTADA
        inv.aceptada_en = timezone.now()
        inv.docente_target = u
        inv.save(update_fields=["estado", "aceptada_en", "docente_target"])

    refresh = RefreshToken.for_user(u)
    return Response({
        "ok": True,
        "mensaje": mensaje,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": u.id, "username": u.username,
            "first_name": u.first_name, "last_name": u.last_name,
            "rol": u.rol, "modo_cuenta": u.modo_cuenta,
        },
    })



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_invitaciones(request):
    """Director ve las invitaciones que ha enviado (con estado)."""
    if request.user.rol not in ROLES_INVITAR:
        return Response({"error": "No autorizado."}, status=403)

    invs = InvitacionDocente.objects.filter(
        invitado_por=request.user,
    ).order_by("-creado_en")[:50]

    return Response({
        "invitaciones": [
            {
                "id": i.id,
                "email": i.email,
                "estado": i.estado,
                "token": i.token if i.estado == InvitacionDocente.ESTADO_PENDIENTE else "",
                "existe_cuenta_previa": i.docente_target_id is not None,
                "expira_en": i.expira_en.isoformat(),
                "aceptada_en": i.aceptada_en.isoformat() if i.aceptada_en else None,
                "creado_en": i.creado_en.isoformat(),
            }
            for i in invs
        ],
    })
