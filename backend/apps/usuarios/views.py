from django.contrib.auth import authenticate
from django.db import models, transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated

from apps.core.ratelimit import ratelimit_drf
from apps.core.utils import get_from_email
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .importacion import (
    credenciales_a_excel,
    importar_docentes,
    importar_estudiantes,
    importar_padres,
    template_docentes,
    template_estudiantes,
    template_padres,
)
from .listas import excel_lista_seccion, pdf_lista_seccion
from .models import CodigoRecuperacion, Docente, Estudiante, Matricula, Padre, Rol, Seccion, Usuario
from .permissions import EsDirector, EsDirectorOAdminTIC
from .tenant import es_modo_personal
from .serializers import (
    UsuarioCreateSerializer,
    UsuarioMeSerializer,
    UsuarioSerializer,
)


from apps.usuarios.permissions import puede_gestionar_usuarios as _puede_gestionar_usuarios  # noqa: E402


@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="20/m")
def login(request):
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"error": "username y password son requeridos"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Anti-bruteforce: consultar axes ANTES de authenticate.
    # authenticate() usa AxesStandaloneBackend, pero el bloqueo debe hacerse acá porque
    # esta view no es una LoginView de Django (no dispara la señal automática).
    from axes.helpers import is_client_ip_address_blacklisted  # noqa: F401
    from axes.handlers.proxy import AxesProxyHandler
    if AxesProxyHandler.is_locked(request, credentials={"username": username}):
        return Response(
            {"error": "Demasiados intentos fallidos. Reintenta en unos minutos."},
            status=status.HTTP_403_FORBIDDEN,
        )

    usuario = authenticate(request=request, username=username, password=password)
    if not usuario:
        return Response(
            {"error": "Credenciales inválidas"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not usuario.activo:
        return Response(
            {"error": "Cuenta desactivada"},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Bloqueo por edición: en solo_docente solo se permite rol=docente
    from django.conf import settings as _s
    if _s.EDICION == "solo_docente" and usuario.rol != "docente":
        return Response(
            {"error": "Esta edición del sistema solo permite acceso a docentes. Contacte al proveedor para actualizar a la edición completa."},
            status=status.HTTP_403_FORBIDDEN,
        )

    refresh = RefreshToken.for_user(usuario)
    # Registrar IP y fecha del último acceso
    from django.utils import timezone
    ip = (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
          or request.META.get("REMOTE_ADDR"))
    usuario.ultimo_acceso_ip = ip or None
    usuario.ultimo_acceso_en = timezone.now()
    usuario.save(update_fields=["ultimo_acceso_ip", "ultimo_acceso_en"])
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "usuario": UsuarioMeSerializer(usuario).data,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="60/m")
def refresh(request):
    from rest_framework_simplejwt.views import TokenRefreshView
    return TokenRefreshView.as_view()(request._request)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UsuarioMeSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cambiar_password(request):
    """Cambia la propia contraseña. Requiere password_actual + password_nuevo."""
    actual = request.data.get("password_actual")
    nuevo = request.data.get("password_nuevo")
    if not actual or not nuevo:
        return Response({"error": "Debes indicar la contraseña actual y la nueva."}, status=400)
    if len(nuevo) < 6:
        return Response({"error": "La nueva contraseña debe tener al menos 6 caracteres."}, status=400)
    if not request.user.check_password(actual):
        return Response({"error": "La contraseña actual es incorrecta."}, status=400)
    request.user.set_password(nuevo)
    request.user.debe_cambiar_password = False
    request.user.save(update_fields=["password", "debe_cambiar_password"])
    return Response({"ok": True, "mensaje": "Contraseña actualizada."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalogo_roles(request):
    """Devuelve la lista de roles del sistema con etiqueta legible."""
    return Response([
        {"codigo": c, "etiqueta": e} for c, e in Rol.choices
    ])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lista_estudiantes(request):
    """Lista compacta de estudiantes para selectores.
    - Docente: solo estudiantes de sus secciones (asignadas + tutoría).
    - Admin_tic / director / subdirector / secretaria: todos.
    - Otros roles: 403."""
    user = request.user
    from apps.usuarios.models import Estudiante
    from apps.core.models import ConfiguracionInstitucional

    cfg = ConfiguracionInstitucional.get_solo()
    anio_lectivo = cfg.anio_lectivo_activo or 2026

    qs = Estudiante.objects.select_related("usuario").filter(
        usuario__activo=True,
        matriculas__anio_lectivo=anio_lectivo,
        matriculas__situacion__in=["matriculado", "suspendido"],
    ).distinct()

    if user.rol == Rol.DOCENTE:
        from apps.notas.models import AsignacionDocente
        secciones_ids = set(user.secciones_asignadas.values_list("id", flat=True))
        secciones_ids.update(user.secciones_como_tutor.values_list("id", flat=True))
        secciones_ids.update(AsignacionDocente.objects.filter(docente=user).values_list("seccion_id", flat=True))
        qs = qs.filter(matriculas__seccion_id__in=secciones_ids, matriculas__anio_lectivo=anio_lectivo)
    elif user.rol not in (Rol.ADMIN_TIC, Rol.DIRECTOR, Rol.SUBDIRECTOR, Rol.SECRETARIA, Rol.AUXILIAR, Rol.PSICOLOGA):
        raise PermissionDenied()

    q = (request.GET.get("q") or "").strip().lower()
    seccion_id = request.GET.get("seccion")
    if seccion_id:
        qs = qs.filter(matriculas__seccion_id=seccion_id, matriculas__anio_lectivo=anio_lectivo)
    if q:
        qs = qs.filter(
            models.Q(usuario__first_name__icontains=q)
            | models.Q(usuario__last_name__icontains=q)
            | models.Q(matriculas__codigo_matricula__icontains=q)
        )

    # Precargar matrículas del año activo para evitar N+1
    matriculas_qs = Matricula.objects.filter(anio_lectivo=anio_lectivo)
    matriculas_por_est = {m.estudiante_id: m for m in matriculas_qs}

    resultado = []
    for e in qs.order_by("usuario__last_name", "usuario__first_name")[:500]:
        m = matriculas_por_est.get(e.pk)
        seccion_nombre = ""
        if m and m.seccion:
            seccion_nombre = f"{m.seccion.grado} {m.seccion.letra}".strip()
        resultado.append({
            "id": e.pk,
            "nombre_completo": f"{e.usuario.first_name} {e.usuario.last_name}".strip() or e.usuario.username,
            "nombre": f"{e.usuario.first_name} {e.usuario.last_name}".strip() or e.usuario.username,
            "seccion": seccion_nombre,
            "codigo_matricula": m.codigo_matricula if m else "",
            "dni": e.usuario.dni or "",
            "fecha_ingreso": str(m.fecha_matricula) if m and m.fecha_matricula else None,
        })
    return Response(resultado)


class UsuarioViewSet(viewsets.ModelViewSet):
    """CRUD completo de usuarios para la gestión desde director/admin_tic/subdirector/secretaría."""
    queryset = Usuario.objects.all().order_by("-creado_en")

    def get_serializer_class(self):
        if self.action == "create":
            return UsuarioCreateSerializer
        return UsuarioSerializer

    def get_permissions(self):
        return [IsAuthenticated()]

    def check_gestion(self):
        if not _puede_gestionar_usuarios(self.request.user):
            raise PermissionDenied("Solo el equipo directivo/administrativo puede gestionar cuentas.")

    def get_queryset(self):
        user = self.request.user
        qs = Usuario.objects.all().order_by("-creado_en")
        if _puede_gestionar_usuarios(user):
            # Filtros opcionales
            rol = self.request.GET.get("rol")
            q = self.request.GET.get("q")
            activo = self.request.GET.get("activo")
            if rol:
                # incluir directivos con es_docente cuando se pide rol=docente
                if rol == "docente":
                    qs = qs.filter(models.Q(rol=rol) | models.Q(es_docente=True))
                else:
                    qs = qs.filter(rol=rol)
            if q:
                qs = qs.filter(
                    models.Q(username__icontains=q)
                    | models.Q(first_name__icontains=q)
                    | models.Q(last_name__icontains=q)
                    | models.Q(dni__icontains=q)
                )
            if activo is not None:
                qs = qs.filter(activo=(activo.lower() in ("true", "1")))
            return qs.distinct()
        return Usuario.objects.filter(id=user.id)

    def create(self, request, *args, **kwargs):
        self.check_gestion()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = serializer.instance
        data = UsuarioSerializer(instance).data
        if hasattr(instance, "_password_generado"):
            data["password_generado"] = instance._password_generado
        from rest_framework import status as http_status
        from rest_framework.response import Response
        return Response(data, status=http_status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # El propio usuario puede editar sus datos básicos; staff puede editar a otros.
        if instance.id != request.user.id and not _puede_gestionar_usuarios(request.user):
            raise PermissionDenied("No puedes editar a otros usuarios.")
        kwargs.setdefault("partial", True)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self.check_gestion()
        # Desactivar en vez de eliminar (soft delete lógico)
        instance = self.get_object()
        instance.activo = False
        instance.is_active = False
        instance.save(update_fields=["activo", "is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """El staff resetea la contraseña de un usuario (para casos de olvido).
        Seguridad:
        - Marca debe_cambiar_password=True → el usuario ve banner al entrar.
        - Registra en auditoría quién reseteó a quién.
        - El director NO debería saber la contraseña: se auto-genera como DNI+año."""
        self.check_gestion()
        usuario = self.get_object()
        nueva = request.data.get("password_nuevo")
        if not nueva:
            import secrets, string
            chars = string.ascii_letters + string.digits
            nueva = "".join(secrets.choice(chars) for _ in range(10))
        if len(nueva) < 6:
            return Response({"error": "Mínimo 6 caracteres."}, status=400)
        usuario.set_password(nueva)
        usuario.debe_cambiar_password = True
        usuario.save(update_fields=["password", "debe_cambiar_password"])
        # Registrar en auditoría
        try:
            from apps.auditoria.models import Auditoria, TipoAccion
            Auditoria.objects.create(
                usuario=request.user,
                usuario_username=request.user.username,
                tipo=TipoAccion.ACCION,
                modelo="Usuario",
                objeto_id=str(usuario.pk),
                descripcion=f"Contraseña reseteada para {usuario.username} por {request.user.username}",
                cambios={"accion": "reset_password", "usuario_afectado": usuario.username},
            )
        except Exception:
            pass
        return Response({
            "ok": True,
            "password_temporal": nueva,
            "aviso": (
                f"Anota o comunicale esta contraseña a {usuario.first_name} EN PERSONA — "
                f"no la envíes por WhatsApp ni email. Al entrar, el sistema le pedirá que la cambie."
            ),
        })

    @action(detail=True, methods=["post"], url_path="reactivar")
    def reactivar(self, request, pk=None):
        self.check_gestion()
        usuario = self.get_object()
        usuario.activo = True
        usuario.is_active = True
        usuario.save(update_fields=["activo", "is_active"])
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=True, methods=["post"], url_path="vincular-hijos")
    def vincular_hijos(self, request, pk=None):
        """Solo aplica a usuarios con rol=padre. Payload: {"hijos_ids": [1,2,3]}"""
        self.check_gestion()
        usuario = self.get_object()
        if usuario.rol != Rol.PADRE:
            return Response({"error": "Este usuario no es padre de familia."}, status=400)
        ids = request.data.get("hijos_ids", [])
        if not isinstance(ids, list):
            return Response({"error": "hijos_ids debe ser una lista."}, status=400)
        padre, _ = Padre.objects.get_or_create(usuario=usuario)
        estudiantes = Estudiante.objects.filter(pk__in=ids)
        padre.hijos.set(estudiantes)
        return Response({
            "ok": True,
            "hijos_vinculados": [{"id": e.pk, "nombre": e.usuario.get_full_name()} for e in estudiantes],
        })

    @action(detail=False, methods=["post"], url_path="consentir")
    def consentir(self, request):
        """El padre autenticado registra su consentimiento Ley 29733."""
        if request.user.rol != Rol.PADRE:
            return Response({"error": "Solo padres pueden consentir."}, status=403)
        padre, _ = Padre.objects.get_or_create(usuario=request.user)
        padre.consentimiento_datos = True
        padre.consentimiento_fecha = timezone.now()
        ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR"))
        padre.consentimiento_ip = ip.split(",")[0].strip() if ip else None
        padre.save(update_fields=["consentimiento_datos", "consentimiento_fecha", "consentimiento_ip"])
        return Response({"ok": True, "fecha": padre.consentimiento_fecha})


# ═════════════════════════════════════════════════════════════════════════════
# SECCIONES — CRUD
# ═════════════════════════════════════════════════════════════════════════════
from rest_framework import serializers as drf_serializers


class SeccionSerializer(drf_serializers.ModelSerializer):
    tutor_nombre = drf_serializers.SerializerMethodField(read_only=True)
    cantidad_estudiantes = drf_serializers.SerializerMethodField(read_only=True)
    cantidad_docentes = drf_serializers.SerializerMethodField(read_only=True)
    docentes_detalle = drf_serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Seccion
        fields = ["id", "nombre", "nivel", "grado", "letra", "tutor", "tutor_nombre",
                  "docentes", "docentes_detalle",
                  "cantidad_estudiantes", "cantidad_docentes"]

    def get_tutor_nombre(self, obj):
        return obj.tutor.get_full_name() if obj.tutor else None

    def get_cantidad_estudiantes(self, obj):
        from apps.core.models import ConfiguracionInstitucional
        from apps.usuarios.models import Matricula
        cfg = ConfiguracionInstitucional.get_solo()
        return Matricula.objects.filter(
            seccion=obj, anio_lectivo=cfg.anio_lectivo_activo or 2026
        ).count()

    def get_cantidad_docentes(self, obj):
        return obj.docentes.count()

    def validate_letra(self, value):
        return value.upper() if value else value

    def get_docentes_detalle(self, obj):
        return [{"id": d.pk, "nombre": d.get_full_name()} for d in obj.docentes.all()]


class SeccionViewSet(viewsets.ModelViewSet):
    serializer_class = SeccionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Evalúa el manager por request (para que OwnedManager vea el thread-local user).
        qs = Seccion.objects.all().order_by("grado", "letra")
        if es_modo_personal(self.request.user):
            qs = qs.filter(owner_id=self.request.user.id)
        else:
            # Institucional: no ve las secciones de cuentas personales.
            qs = qs.filter(owner__isnull=True)
        return qs

    def _check_gestion(self):
        user = self.request.user
        # Personal: es dueño de sus propias secciones.
        if es_modo_personal(user):
            return
        if not _puede_gestionar_usuarios(user):
            raise PermissionDenied("Solo el equipo directivo puede gestionar secciones.")

    def perform_create(self, serializer):
        if es_modo_personal(self.request.user):
            serializer.save(owner=self.request.user)
        else:
            serializer.save()

    def create(self, request, *args, **kwargs):
        self._check_gestion()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._check_gestion()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._check_gestion()
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="docentes-disponibles")
    def docentes_disponibles(self, request):
        """Lista de docentes que pueden asignarse como tutores o miembros."""
        from django.db.models import Q
        qs = Usuario.objects.filter(
            Q(rol=Rol.DOCENTE) | Q(es_docente=True), activo=True
        ).order_by("last_name", "first_name")
        return Response([{"id": u.pk, "nombre": u.get_full_name(), "username": u.username} for u in qs])


# ═════════════════════════════════════════════════════════════════════════════
# IMPORT MASIVO — Templates + Import + Credenciales
# ═════════════════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def descargar_template_estudiantes(request):
    if not _puede_gestionar_usuarios(request.user):
        raise PermissionDenied()
    resp = HttpResponse(
        template_estudiantes(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = 'attachment; filename="template_estudiantes.xlsx"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def descargar_template_padres(request):
    if not _puede_gestionar_usuarios(request.user):
        raise PermissionDenied()
    resp = HttpResponse(
        template_padres(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = 'attachment; filename="template_padres.xlsx"'
    return resp


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def importar_estudiantes_endpoint(request):
    if not _puede_gestionar_usuarios(request.user):
        raise PermissionDenied()
    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el archivo Excel en el campo 'archivo'."}, status=400)
    try:
        resultado = importar_estudiantes(archivo)
    except Exception as e:
        return Response({"error": f"Error procesando Excel: {str(e)[:300]}"}, status=400)
    return Response(resultado)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def imprimir_lista_seccion(request, seccion_id: int):
    """Devuelve la lista de estudiantes de una sección en PDF o Excel."""
    formato = (request.query_params.get("formato") or "pdf").lower()
    rol = getattr(request.user, "rol", None)
    if rol not in ("director", "subdirector", "docente", "admin_tic",
                   "secretaria", "auxiliar", "psicologa"):
        raise PermissionDenied()

    try:
        if formato == "xlsx":
            data = excel_lista_seccion(seccion_id)
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ext = "xlsx"
        else:
            data = pdf_lista_seccion(seccion_id)
            content_type = "application/pdf"
            ext = "pdf"
    except ValueError as e:
        return Response({"error": str(e)}, status=404)

    resp = HttpResponse(data, content_type=content_type)
    resp["Content-Disposition"] = f'attachment; filename="lista_seccion_{seccion_id}.{ext}"'
    return resp


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def descargar_template_docentes(request):
    if not _puede_gestionar_usuarios(request.user):
        raise PermissionDenied()
    resp = HttpResponse(
        template_docentes(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = 'attachment; filename="template_docentes.xlsx"'
    return resp


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def importar_docentes_endpoint(request):
    if not _puede_gestionar_usuarios(request.user):
        raise PermissionDenied()
    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el archivo Excel en el campo 'archivo'."}, status=400)
    try:
        resultado = importar_docentes(archivo)
    except Exception as e:
        return Response({"error": f"Error procesando Excel: {str(e)[:300]}"}, status=400)
    return Response(resultado)


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def importar_padres_endpoint(request):
    if not _puede_gestionar_usuarios(request.user):
        raise PermissionDenied()
    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el archivo Excel en el campo 'archivo'."}, status=400)
    try:
        resultado = importar_padres(archivo)
    except Exception as e:
        return Response({"error": f"Error procesando Excel: {str(e)[:300]}"}, status=400)
    return Response(resultado)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generar_codigo_recuperacion(request):
    """El admin/director/secretaría genera un código temporal para un usuario.
    Se lo comunica al usuario por su canal (WhatsApp personal, teléfono, presencial)
    y el usuario entra a /recuperar-con-codigo para cambiar su contraseña."""
    rol = getattr(request.user, "rol", None)
    if rol not in ("director", "subdirector", "admin_tic", "secretaria"):
        raise PermissionDenied("Solo director/subdirector/admin TIC/secretaría puede generar códigos.")

    user_id = request.data.get("usuario_id")
    if not user_id:
        return Response({"error": "Falta 'usuario_id'."}, status=400)

    usuario = Usuario.objects.filter(pk=user_id).first()
    if not usuario:
        return Response({"error": "Usuario no encontrado."}, status=404)

    # Invalida códigos previos no usados
    CodigoRecuperacion.objects.filter(usuario=usuario, usado_en__isnull=True).update(
        usado_en=timezone.now()  # marca como consumidos para invalidar
    )

    codigo = CodigoRecuperacion.objects.create(
        usuario=usuario,
        generado_por=request.user,
    )
    return Response({
        "codigo": codigo.codigo,
        "usuario": usuario.username,
        "nombre": usuario.get_full_name(),
        "expira_en": codigo.expira_en.isoformat(),
        "expira_minutos": 15,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="20/h")
def recuperar_con_codigo(request):
    """El usuario usa el código temporal para cambiar su contraseña.
    Body: {username, codigo, nueva_password}
    """
    username = (request.data.get("username") or "").strip()
    codigo = (request.data.get("codigo") or "").strip()
    nueva_password = request.data.get("nueva_password") or ""

    if not username or not codigo or not nueva_password:
        return Response({"error": "Faltan datos: username, codigo, nueva_password."}, status=400)

    if len(nueva_password) < 8:
        return Response({"error": "La contraseña debe tener al menos 8 caracteres."}, status=400)

    usuario = Usuario.objects.filter(username__iexact=username).first()
    if not usuario:
        return Response({"error": "Usuario o código inválido."}, status=400)  # mensaje ambiguo por seguridad

    cod = CodigoRecuperacion.objects.filter(
        usuario=usuario, codigo=codigo, usado_en__isnull=True,
    ).order_by("-creado_en").first()

    if not cod or not cod.valido:
        return Response({"error": "Usuario o código inválido, o expiró."}, status=400)

    # Todo OK: cambiar contraseña y marcar código como usado
    usuario.set_password(nueva_password)
    usuario.debe_cambiar_password = False  # eligió su propia contraseña
    usuario.save(update_fields=["password", "debe_cambiar_password"])
    cod.usado_en = timezone.now()
    cod.ip_uso = request.META.get("REMOTE_ADDR")
    cod.save(update_fields=["usado_en", "ip_uso"])

    return Response({"ok": True, "mensaje": "Contraseña actualizada. Ya puedes iniciar sesión."})


@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="5/h")
def solicitar_reset_password(request):
    """El usuario ingresa username o email → recibe correo con link temporal (1h)."""
    ident = (request.data.get("identificador") or "").strip()
    if not ident:
        return Response({"error": "Ingresa tu usuario o correo."}, status=400)

    u = Usuario.objects.filter(username__iexact=ident).first() or \
        Usuario.objects.filter(email__iexact=ident).first()

    if u and u.email:
        from django.conf import settings
        from django.core.mail import send_mail
        from django.core.signing import TimestampSigner
        signer = TimestampSigner()
        token = signer.sign(str(u.pk))
        origen = request.build_absolute_uri("/").rstrip("/").replace(":8000", ":5173")
        link = f"{origen}/reset-password?token={token}"
        try:
            from apps.core.models import ConfiguracionInstitucional
            nombre_ie = ConfiguracionInstitucional.get_solo().nombre_institucion or "Sistema TIC"
            send_mail(
                f"Recuperación de contraseña — {nombre_ie}",
                (f"Hola {u.first_name},\n\n"
                 f"Solicitaste restablecer tu contraseña. Enlace válido por 1 hora:\n\n{link}\n\n"
                 f"Si no fuiste tú, ignora este mensaje.\n\n— {nombre_ie}"),
                get_from_email(),
                [u.email],
                fail_silently=False,
            )
        except Exception as e:  # noqa: BLE001 — respuesta genérica al usuario para no filtrar existencia
            import logging
            logging.getLogger(__name__).warning(
                "Fallo enviando reset-password a %s: %s", u.email, e
            )

    # Nunca revelar si existe o no (privacidad)
    return Response({"ok": True, "mensaje": "Si tu cuenta tiene un correo registrado, te enviamos un enlace."})


@api_view(["POST"])
@permission_classes([AllowAny])
@ratelimit_drf(rate="10/h")
def confirmar_reset_password(request):
    """Recibe token + nueva contraseña. Valida y aplica."""
    from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
    token = (request.data.get("token") or "").strip()
    nueva = (request.data.get("password_nuevo") or "").strip()
    if not token or not nueva:
        return Response({"error": "Faltan datos."}, status=400)
    if len(nueva) < 6:
        return Response({"error": "Mínimo 6 caracteres."}, status=400)
    signer = TimestampSigner()
    try:
        user_id = signer.unsign(token, max_age=60 * 60)
    except SignatureExpired:
        return Response({"error": "El enlace expiró. Solicita uno nuevo."}, status=400)
    except BadSignature:
        return Response({"error": "Enlace inválido."}, status=400)
    try:
        u = Usuario.objects.get(pk=int(user_id))
    except (Usuario.DoesNotExist, ValueError):
        return Response({"error": "Usuario no encontrado."}, status=404)
    u.set_password(nueva)
    u.debe_cambiar_password = False  # el usuario eligió su contraseña
    u.save(update_fields=["password", "debe_cambiar_password"])
    return Response({"ok": True, "mensaje": "Contraseña actualizada. Ahora inicia sesión."})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def descargar_credenciales(request):
    """Recibe una lista de credenciales (devuelta por el import) y devuelve Excel imprimible."""
    if not _puede_gestionar_usuarios(request.user):
        raise PermissionDenied()
    credenciales = request.data.get("credenciales", [])
    if not credenciales:
        return Response({"error": "Envía la lista 'credenciales'."}, status=400)
    resp = HttpResponse(
        credenciales_a_excel(credenciales),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    resp["Content-Disposition"] = 'attachment; filename="credenciales.xlsx"'
    return resp


# ═════════════════════════════════════════════════════════════════════════════
# Fichas completas — para el módulo de matrícula y gestión de datos
# ═════════════════════════════════════════════════════════════════════════════

class FichaEstudianteViewSet(viewsets.ModelViewSet):
    """Ficha completa del estudiante: datos personales, médicos, familia, académicos.
    Acceso:
      - Director/subdirector/admin_tic/secretaria: todos los estudiantes (lectura+edición)
      - Tutor de la sección: sus estudiantes (lectura+edición)
      - Auxiliar/psicóloga: lectura de todos (para intervenciones)
      - Padre: lectura de sus hijos, edición limitada de datos médicos/emergencia
      - Estudiante: lectura de sus propios datos
    """
    from .serializers import FichaEstudianteSerializer

    from .models import Estudiante
    queryset = Estudiante.objects.all().select_related("usuario")
    serializer_class = FichaEstudianteSerializer
    permission_classes = [IsAuthenticated]
    from rest_framework.parsers import FormParser, JSONParser
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        from .models import Estudiante
        from apps.core.models import ConfiguracionInstitucional
        user = self.request.user
        cfg = ConfiguracionInstitucional.get_solo()
        anio = cfg.anio_lectivo_activo or 2026
        qs = Estudiante.objects.select_related("usuario").prefetch_related("padres__usuario")

        if user.rol in ("director", "subdirector", "admin_tic", "secretaria", "auxiliar", "psicologa"):
            return qs
        if user.rol == "docente":
            secciones_ids = set(user.secciones_asignadas.values_list("id", flat=True))
            secciones_ids.update(user.secciones_como_tutor.values_list("id", flat=True))
            return qs.filter(matriculas__seccion_id__in=secciones_ids, matriculas__anio_lectivo=anio).distinct()
        if user.rol == "padre":
            try:
                return qs.filter(pk__in=user.perfil_padre.hijos.values_list("pk", flat=True))
            except AttributeError:
                return qs.none()
        if user.rol == "estudiante":
            est = getattr(user, "perfil_estudiante", None)
            return qs.filter(pk=est.pk) if est else qs.none()
        return qs.none()

    def _puede_editar(self, request, obj):
        user = request.user
        if user.rol in ("director", "subdirector", "admin_tic", "secretaria"):
            return True, "completo"
        if user.rol == "docente":
            m = obj.matricula_actual
            if m and m.seccion and m.seccion.tutor_id == user.id:
                return True, "completo"
            return False, ""
        if user.rol == "padre":
            try:
                if user.perfil_padre.hijos.filter(pk=obj.pk).exists():
                    return True, "medico_emergencia"  # solo campos limitados
            except AttributeError:
                pass
            return False, ""
        return False, ""

    def update(self, request, *args, **kwargs):
        obj = self.get_object()
        puede, nivel = self._puede_editar(request, obj)
        if not puede:
            raise PermissionDenied("No puedes editar esta ficha.")

        if nivel == "medico_emergencia":
            # Padre solo puede tocar campos médicos y de emergencia
            campos_permitidos = {
                "grupo_sanguineo", "alergias", "medicamentos", "condicion_medica",
                "tiene_seguro", "tipo_seguro",
                "contacto_emergencia_nombre", "contacto_emergencia_parentesco",
                "contacto_emergencia_telefono", "direccion", "referencia_direccion",
            }
            request.data.__class__ = dict if not hasattr(request.data, "copy") else request.data.__class__
            filtered = {k: v for k, v in request.data.items() if k in campos_permitidos}
            serializer = self.get_serializer(obj, data=filtered, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        # Los estudiantes se crean vía UsuarioViewSet o import Excel
        raise PermissionDenied("Usa el módulo de gestión de usuarios o importar Excel para crear estudiantes.")


class FichaApoderadoViewSet(viewsets.ModelViewSet):
    """Ficha del apoderado (padre/madre/tutor)."""
    from .serializers import FichaApoderadoSerializer

    from .models import Padre
    queryset = Padre.objects.all().select_related("usuario")
    serializer_class = FichaApoderadoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from .models import Padre
        user = self.request.user
        qs = Padre.objects.select_related("usuario").prefetch_related("hijos__usuario")

        if user.rol in ("director", "subdirector", "admin_tic", "secretaria", "auxiliar", "psicologa"):
            return qs
        if user.rol == "docente":
            from apps.core.models import ConfiguracionInstitucional
            cfg = ConfiguracionInstitucional.get_solo()
            anio = cfg.anio_lectivo_activo or 2026
            secciones_ids = set(user.secciones_asignadas.values_list("id", flat=True))
            secciones_ids.update(user.secciones_como_tutor.values_list("id", flat=True))
            return qs.filter(hijos__matriculas__seccion_id__in=secciones_ids, hijos__matriculas__anio_lectivo=anio).distinct()
        if user.rol == "padre":
            return qs.filter(usuario=user)
        return qs.none()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def matricula_list(request):
    """Lista de estudiantes para el módulo de matrícula.
    Filtros: ?seccion_id=&situacion=&anio=&q=
    Permisos: director, subdirector, admin_tic, secretaria.
    """
    from .models import Estudiante
    if request.user.rol not in ("director", "subdirector", "admin_tic", "secretaria"):
        raise PermissionDenied()

    anio_param = request.query_params.get("anio")
    anio = int(anio_param) if anio_param and anio_param.isdigit() else timezone.now().year

    qs = (Estudiante.objects
          .select_related("usuario")
          .prefetch_related("padres__usuario")
          .filter(matriculas__anio_lectivo=anio)
          .order_by("matriculas__seccion__grado", "matriculas__seccion__letra", "usuario__last_name", "usuario__first_name"))

    seccion_id = request.query_params.get("seccion_id")
    if seccion_id:
        qs = qs.filter(matriculas__seccion_id=seccion_id, matriculas__anio_lectivo=anio)

    situacion = request.query_params.get("situacion")
    if situacion:
        qs = qs.filter(matriculas__situacion=situacion, matriculas__anio_lectivo=anio)

    q = request.query_params.get("q", "").strip()
    if q:
        from django.db.models import Q
        qs = qs.filter(
            Q(usuario__first_name__icontains=q) |
            Q(usuario__last_name__icontains=q) |
            Q(usuario__dni__icontains=q) |
            Q(matriculas__codigo_matricula__icontains=q)
        )

    # Precargar matrículas del año solicitado para evitar N+1
    matriculas_qs = Matricula.objects.filter(anio_lectivo=anio)
    matriculas_por_est = {m.estudiante_id: m for m in matriculas_qs}

    resultado = []
    for e in qs.distinct():
        m = matriculas_por_est.get(e.pk)
        apoderado = e.padres.first()
        seccion_nombre = ""
        seccion_id_out = None
        if m and m.seccion:
            seccion_nombre = f"{m.seccion.grado} {m.seccion.letra}".strip()
            seccion_id_out = m.seccion_id
        resultado.append({
            "id": e.pk,
            "nombre_completo": e.usuario.get_full_name(),
            "dni": e.usuario.dni or "",
            "codigo_matricula": m.codigo_matricula if m else "",
            "seccion_id": seccion_id_out,
            "seccion": seccion_nombre,
            "grado": m.seccion.grado if m and m.seccion else e.grado or "",
            "sexo": e.sexo or "",
            "fecha_nacimiento": str(e.fecha_nacimiento) if e.fecha_nacimiento else "",
            "situacion_matricula": m.situacion if m else "—",
            "fecha_ingreso": str(m.fecha_matricula) if m and m.fecha_matricula else str(e.fecha_ingreso) if e.fecha_ingreso else "",
            "colegio_procedencia": e.colegio_procedencia or "",
            "apoderado_nombre": apoderado.usuario.get_full_name() if apoderado else "",
            "apoderado_telefono": apoderado.usuario.telefono if apoderado else "",
            "apoderado_dni": apoderado.usuario.dni if apoderado else "",
        })
    return Response(resultado)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def matricular_estudiante(request):
    """Matricula un nuevo estudiante: crea Usuario + Estudiante + apoderado + contraseña inicial.

    Body: {
        nombres, apellidos, dni, fecha_nacimiento?, sexo?, seccion_id?,
        fecha_ingreso?, colegio_procedencia?,
        apoderado_nombres?, apoderado_apellidos?, apoderado_dni?,
        apoderado_telefono?, apoderado_parentesco?
    }
    Permisos: director, subdirector, admin_tic, secretaria.
    Contraseña inicial: primeros 6 dígitos del DNI + año actual.
    """
    from .models import Estudiante, Seccion
    import re
    from django.utils import timezone

    if request.user.rol not in ("director", "subdirector", "admin_tic", "secretaria"):
        raise PermissionDenied("Solo el director o secretaría puede matricular estudiantes.")

    nombres = (request.data.get("nombres") or "").strip()
    apellidos = (request.data.get("apellidos") or "").strip()
    dni = re.sub(r"\D", "", (request.data.get("dni") or "").strip())[:8]

    if not nombres or not apellidos:
        return Response({"error": "Nombres y apellidos son obligatorios."}, status=400)

    # Generar username único
    base_username = f"{nombres.split()[0].lower()}.{apellidos.split()[0].lower()}"
    base_username = re.sub(r"[^a-z0-9.]", "", base_username)[:20]
    username = base_username
    suffix = 1
    while Usuario.objects.filter(username=username).exists():
        username = f"{base_username}{suffix}"
        suffix += 1

    # Contraseña inicial
    anio = timezone.now().year
    password = f"{dni[:6]}{anio}" if dni else f"colegio{anio}"

    # Generar código de matrícula (formato: YYYY + 4 dígitos, ej: 20260001)
    anio_str = str(anio)
    codigo_len = len(anio_str) + 4  # 8 chars para años de 4 dígitos
    from django.db.models.functions import Length
    ultimo = (Matricula.objects
              .filter(codigo_matricula__startswith=anio_str)
              .annotate(clen=Length("codigo_matricula"))
              .filter(clen=codigo_len)
              .order_by("-codigo_matricula").first())
    if ultimo and ultimo.codigo_matricula:
        try:
            num = int(ultimo.codigo_matricula[len(anio_str):]) + 1
        except ValueError:
            num = 1
    else:
        num = 1
    codigo_matricula = f"{anio_str}{num:04d}"

    # Crear usuario
    nombre_parts = nombres.split(maxsplit=1)
    apellido_parts = apellidos.split(maxsplit=1)
    u = Usuario.objects.create_user(
        username=username,
        password=password,
        first_name=nombres,
        last_name=apellidos,
        rol="estudiante",
        dni=dni or None,
        debe_cambiar_password=True,
    )

    # Crear perfil estudiante
    fecha_nac = request.data.get("fecha_nacimiento") or None
    sexo = request.data.get("sexo") or None
    seccion_id = request.data.get("seccion_id") or None
    fecha_ingreso = request.data.get("fecha_ingreso") or None
    colegio_procedencia = (request.data.get("colegio_procedencia") or "").strip()

    seccion = None
    if seccion_id:
        try:
            seccion = Seccion.objects.get(pk=seccion_id)
        except Seccion.DoesNotExist:
            pass

    grado = seccion.grado if seccion else ""
    letra = seccion.letra if seccion else ""

    est = Estudiante.objects.create(
        usuario=u,
        grado=grado,
        seccion=letra,
        fecha_nacimiento=fecha_nac or None,
        sexo=sexo or "",
        fecha_ingreso=fecha_ingreso or None,
        colegio_procedencia=colegio_procedencia,
    )

    Matricula.objects.create(
        estudiante=est,
        seccion=seccion,
        anio_lectivo=anio,
        codigo_matricula=codigo_matricula,
        situacion="matriculado",
        fecha_matricula=fecha_ingreso or None,
    )

    # Crear apoderado si se proporcionaron datos
    apod_nombres = (request.data.get("apoderado_nombres") or "").strip()
    apod_apellidos = (request.data.get("apoderado_apellidos") or "").strip()
    apod_dni = re.sub(r"\D", "", (request.data.get("apoderado_dni") or ""))[:8]
    apod_telefono = (request.data.get("apoderado_telefono") or "").strip()
    apod_parentesco = (request.data.get("apoderado_parentesco") or "Padre/Madre").strip()

    if apod_nombres and apod_apellidos:
        from .models import Padre as PadreApoderado
        apod_base = f"{apod_nombres.split()[0].lower()}.{apod_apellidos.split()[0].lower()}"
        apod_base = re.sub(r"[^a-z0-9.]", "", apod_base)[:20]
        apod_username = apod_base
        suffix = 1
        while Usuario.objects.filter(username=apod_username).exists():
            apod_username = f"{apod_base}{suffix}"
            suffix += 1
        apod_password = f"{apod_dni[:6]}{anio}" if apod_dni else f"padre{anio}"
        apod_u = Usuario.objects.create_user(
            username=apod_username,
            password=apod_password,
            first_name=apod_nombres,
            last_name=apod_apellidos,
            rol="padre",
            dni=apod_dni or None,
            telefono=apod_telefono or "",
            debe_cambiar_password=True,
        )
        apod = PadreApoderado.objects.create(
            usuario=apod_u,
            parentesco=apod_parentesco,
        )
        apod.hijos.add(est)

    return Response({
        "ok": True,
        "id": est.pk,
        "usuario_id": u.pk,
        "username": u.username,
        "codigo_matricula": codigo_matricula,
        "password_inicial": password,
        "mensaje": f"Estudiante matriculado. Usuario: {username} / Contraseña: {password}",
    }, status=201)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def cambiar_situacion_matricula(request, pk):
    """Cambia la situación de matrícula de un estudiante (retirado, trasladado, etc.).
    Permisos: director, subdirector, admin_tic, secretaria.
    """
    from .models import Estudiante, SituacionMatricula
    if request.user.rol not in ("director", "subdirector", "admin_tic", "secretaria"):
        raise PermissionDenied()
    try:
        est = Estudiante.objects.get(pk=pk)
    except Estudiante.DoesNotExist:
        return Response({"error": "Estudiante no encontrado."}, status=404)
    nueva = request.data.get("situacion_matricula")
    opciones = [c[0] for c in SituacionMatricula.choices]
    if nueva not in opciones:
        return Response({"error": f"Situación inválida. Opciones: {opciones}"}, status=400)
    m = est.matricula_actual
    if not m:
        return Response({"error": "El estudiante no tiene una matrícula activa."}, status=400)
    m.situacion = nueva
    m.save(update_fields=["situacion"])
    return Response({"ok": True, "situacion_matricula": nueva})
