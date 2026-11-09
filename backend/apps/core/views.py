import gzip
import os
import subprocess
from datetime import datetime

from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import ConfiguracionInstitucional
from .versiones import get_versiones


def _rol_admin(user):
    return getattr(user, "rol", None) in ("director", "subdirector", "admin_tic")


@api_view(["GET"])
@permission_classes([AllowAny])
def info_institucional(request):
    """Datos institucionales públicos — usados en Login, Sidebar, boletas, QR carnets, etc.
    Sin auth: la vista de login también necesita el nombre y logo.
    """
    cfg = _get_or_create_config()
    logo_url = None
    if cfg.logo:
        try:
            logo_url = cfg.logo.url  # URL relativa: /media/logos/...
        except Exception:
            pass
    return Response({
        "nombre": cfg.nombre_institucion,
        "sigla": cfg.sigla or _sigla(cfg.nombre_institucion),
        "codigo_modular": cfg.codigo_modular,
        "direccion": cfg.direccion,
        "ugel": cfg.ugel,
        "dre": cfg.dre,
        "email_institucional": cfg.email_institucional or "",
        "modulos_activos": cfg.modulos_activos or [],
        "primer_anio_lectivo": cfg.primer_anio_lectivo or cfg.anio_lectivo_activo or 2026,
        "anio_lectivo_activo": cfg.anio_lectivo_activo or 2026,
        "logo_url": logo_url,
        "edicion": settings.EDICION,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def descargar_backup(request):
    """Genera un pg_dump comprimido y lo devuelve como descarga directa.
    Solo director/subdirector/admin_tic. La contraseña PG se pasa por env.
    """
    if not _rol_admin(request.user):
        raise PermissionDenied()

    db = settings.DATABASES["default"]
    env = os.environ.copy()
    env["PGPASSWORD"] = db["PASSWORD"]

    cmd = [
        "pg_dump",
        "-h", db["HOST"] or "localhost",
        "-p", str(db["PORT"] or "5432"),
        "-U", db["USER"],
        "-d", db["NAME"],
        "--no-owner",
        "--clean",
        "--if-exists",
    ]

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        raw, err = proc.communicate(timeout=180)
        if proc.returncode != 0:
            return Response(
                {"error": f"pg_dump falló: {err.decode('utf-8', errors='ignore')[:300]}"},
                status=500,
            )
    except FileNotFoundError:
        return Response({"error": "pg_dump no está instalado en el contenedor."}, status=500)
    except subprocess.TimeoutExpired:
        proc.kill()
        return Response({"error": "pg_dump superó el timeout de 3 minutos."}, status=504)

    comprimido = gzip.compress(raw, compresslevel=6)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre = f"backup_{db['NAME']}_{ts}.sql.gz"

    resp = HttpResponse(comprimido, content_type="application/gzip")
    resp["Content-Disposition"] = f'attachment; filename="{nombre}"'
    resp["Content-Length"] = str(len(comprimido))
    return resp


@api_view(["POST"])
@parser_classes([MultiPartParser])
@permission_classes([IsAuthenticated])
def restaurar_backup(request):
    """Restaura un backup .sql o .sql.gz enviado como archivo.
    DESTRUCTIVO: reemplaza toda la data. Solo director.
    """
    rol = getattr(request.user, "rol", None)
    if rol != "director":
        raise PermissionDenied("Solo el director puede restaurar backups.")

    archivo = request.FILES.get("archivo")
    if not archivo:
        return Response({"error": "Envía el backup en el campo 'archivo'."}, status=400)

    # Confirmación explícita
    if request.data.get("confirmar") != "SI_BORRAR_TODO":
        return Response({
            "error": "Confirma con el valor exacto 'SI_BORRAR_TODO' en el campo 'confirmar'."
        }, status=400)

    raw = archivo.read()
    if archivo.name.endswith(".gz"):
        try:
            raw = gzip.decompress(raw)
        except Exception as e:
            return Response({"error": f"El .gz no es válido: {e}"}, status=400)

    db = settings.DATABASES["default"]
    env = os.environ.copy()
    env["PGPASSWORD"] = db["PASSWORD"]

    cmd = [
        "psql",
        "-h", db["HOST"] or "localhost",
        "-p", str(db["PORT"] or "5432"),
        "-U", db["USER"],
        "-d", db["NAME"],
        "-v", "ON_ERROR_STOP=1",
    ]

    try:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        _out, err = proc.communicate(input=raw, timeout=300)
        if proc.returncode != 0:
            return Response(
                {"error": f"Restauración falló: {err.decode('utf-8', errors='ignore')[:500]}"},
                status=500,
            )
    except FileNotFoundError:
        return Response({"error": "psql no está instalado en el contenedor."}, status=500)
    except subprocess.TimeoutExpired:
        proc.kill()
        return Response({"error": "La restauración superó el timeout de 5 minutos."}, status=504)

    return Response({"ok": True, "mensaje": "Backup restaurado correctamente."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def email_status(_request):
    """Devuelve si el envío real de emails está activo o no.
    Se usa para mostrar un banner de advertencia al director si SMTP no está configurado.
    """
    from django.conf import settings
    backend = getattr(settings, "EMAIL_BACKEND", "")
    activo = "smtp" in backend.lower()
    return Response({
        "activo": activo,
        "backend": backend,
        "detalle": (
            "SMTP configurado: los emails se envían de verdad."
            if activo else
            "Los correos NO se están enviando. Reset de contraseña, alertas de convivencia "
            "y notificaciones a padres NO llegan. Configura SMTP en .env.prod."
        ),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def email_test(request):
    """Envía un correo de prueba al email del usuario que lo solicita.
    Permite verificar que SMTP está configurado correctamente."""
    if request.user.rol not in ("director", "subdirector", "admin_tic"):
        return Response({"error": "Solo el director/admin puede enviar correos de prueba."}, status=403)
    if not request.user.email:
        return Response({"error": "Tu usuario no tiene email configurado."}, status=400)
    from django.core.mail import send_mail
    from .utils import get_from_email
    cfg = _get_or_create_config()
    nombre_ie = cfg.nombre_institucion or "Sistema TIC"
    try:
        send_mail(
            subject=f"Prueba de email — {nombre_ie}",
            message=(
                f"Hola {request.user.first_name},\n\n"
                f"Este es un correo de prueba del Sistema TIC de {nombre_ie}.\n"
                f"Si lo recibiste, el envío de correos está funcionando correctamente.\n\n"
                f"— {nombre_ie}"
            ),
            from_email=get_from_email(),
            recipient_list=[request.user.email],
            fail_silently=False,
        )
        return Response({"ok": True, "mensaje": f"Correo enviado a {request.user.email}"})
    except Exception as e:
        msg = str(e).lower()
        if any(k in msg for k in ("authentication", "535", "username", "password")):
            detalle = "Credenciales incorrectas. Verifica usuario y contraseña SMTP en la configuración."
        elif any(k in msg for k in ("connection refused", "timed out", "connect")):
            detalle = "No se pudo conectar al servidor SMTP. Verifica host y puerto."
        elif any(k in msg for k in ("quota", "rate", "too many", "limit")):
            detalle = "Límite de envío alcanzado. Espera unas horas o cambia de proveedor."
        elif "no smtp" in msg or "backend" in msg:
            detalle = "SMTP no configurado. Completa los datos en Configuración → Envío de correos."
        else:
            detalle = str(e)
        return Response({"ok": False, "error": detalle}, status=500)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def subir_logo(request):
    """Sube o elimina el logo institucional. Solo director/admin_tic."""
    if request.user.rol not in ("director", "subdirector", "admin_tic"):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied()
    cfg = _get_or_create_config()
    if request.method == "DELETE":
        if cfg.logo:
            cfg.logo.delete(save=False)
            cfg.logo = None
            cfg.save(update_fields=["logo"])
        return Response({"ok": True, "logo_url": None})
    archivo = request.FILES.get("logo")
    if not archivo:
        return Response({"error": "No se recibió archivo."}, status=400)
    if cfg.logo:
        cfg.logo.delete(save=False)
    cfg.logo = archivo
    cfg.save(update_fields=["logo"])
    return Response({"ok": True, "logo_url": request.build_absolute_uri(cfg.logo.url)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def onboarding_status(request):
    """Devuelve qué pasos del onboarding inicial del colegio están completos."""
    from apps.usuarios.models import Usuario, Docente, Estudiante, Seccion, Rol

    cfg = _get_or_create_config()

    tiene_config = bool(
        cfg.nombre_institucion
        and cfg.nombre_institucion.strip()
        and cfg.codigo_modular
        and cfg.codigo_modular.strip()
    )
    total_secciones = Seccion.objects.count()
    total_docentes = Usuario.objects.filter(rol=Rol.DOCENTE).count()
    total_estudiantes = Estudiante.objects.count()

    completado = (
        tiene_config
        and total_secciones > 0
        and total_docentes > 0
        and total_estudiantes > 0
    )

    return Response({
        "completado": completado,
        "pasos": {
            "config": {
                "completo": tiene_config,
                "nombre": cfg.nombre_institucion or "",
                "codigo_modular": cfg.codigo_modular or "",
            },
            "secciones": {"completo": total_secciones > 0, "total": total_secciones},
            "docentes": {"completo": total_docentes > 0, "total": total_docentes},
            "estudiantes": {"completo": total_estudiantes > 0, "total": total_estudiantes},
        },
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def configuracion_institucional(request):
    """Lee o actualiza la configuración institucional. Solo director/subdirector puede PATCH."""
    cfg = _get_or_create_config()

    if request.method == "PATCH":
        rol = getattr(request.user, "rol", None)
        if rol not in ("director", "subdirector", "admin_tic"):
            return Response({"detail": "No autorizado."}, status=403)
        campos_permitidos = [
            "nombre_institucion", "sigla", "codigo_modular", "direccion", "ugel", "dre",
            "email_institucional",
            "hora_tope_entrada_personal", "hora_tope_entrada_estudiantes",
            "tolerancia_minutos",
            "latitud_ie", "longitud_ie", "radio_permitido_metros",
            "exigir_geolocalizacion",
            "modulos_activos",
            "escala_calificacion",
            "plantilla_informe",
            "primer_anio_lectivo",
            "anio_lectivo_activo",
            "smtp_host", "smtp_port", "smtp_user",
            "smtp_password", "smtp_use_tls", "smtp_from_email",
            "email_comunicados_habilitado",
            "bloquear_boleta_por_deuda", "max_cuotas_vencidas_bloqueo",
            "facturacion_sunat_habilitada", "sunat_api_url", "sunat_api_token",
            "sunat_serie_boleta", "sunat_serie_factura",
            "cuenta_recaudacion_bcp", "cuenta_recaudacion_bbva",
        ]
        for campo in campos_permitidos:
            if campo in request.data:
                val = request.data[campo]
                if campo == "sunat_api_token" and (val == "" or (isinstance(val, str) and val.startswith("••"))):
                    continue
                if campo == "smtp_password" and val == "":
                    continue
                if val == "":
                    val = None if campo in ("latitud_ie", "longitud_ie") else val
                setattr(cfg, campo, val)
        cfg.save()

    return Response({
        "nombre_institucion": cfg.nombre_institucion or "",
        "sigla": cfg.sigla or "",
        "codigo_modular": cfg.codigo_modular or "",
        "direccion": cfg.direccion or "",
        "ugel": cfg.ugel or "",
        "dre": cfg.dre or "",
        "email_institucional": cfg.email_institucional or "",
        "hora_tope_entrada_personal": cfg.hora_tope_entrada_personal.strftime("%H:%M") if cfg.hora_tope_entrada_personal else "",
        "hora_tope_entrada_estudiantes": cfg.hora_tope_entrada_estudiantes.strftime("%H:%M") if cfg.hora_tope_entrada_estudiantes else "",
        "tolerancia_minutos": cfg.tolerancia_minutos or 0,
        "latitud_ie": str(cfg.latitud_ie) if cfg.latitud_ie is not None else "",
        "longitud_ie": str(cfg.longitud_ie) if cfg.longitud_ie is not None else "",
        "radio_permitido_metros": cfg.radio_permitido_metros or 100,
        "exigir_geolocalizacion": bool(cfg.exigir_geolocalizacion),
        "modulos_activos": cfg.modulos_activos or [],
        "escala_calificacion": cfg.escala_calificacion or "letras",
        "plantilla_informe": cfg.plantilla_informe or "",
        "primer_anio_lectivo": cfg.primer_anio_lectivo or cfg.anio_lectivo_activo or 2026,
        "anio_lectivo_activo": cfg.anio_lectivo_activo or 2026,
        "smtp_host": cfg.smtp_host or "",
        "smtp_port": cfg.smtp_port or 587,
        "smtp_user": cfg.smtp_user or "",
        "smtp_password": "••••••••" if cfg.smtp_password else "",  # enmascarada
        "smtp_use_tls": cfg.smtp_use_tls,
        "smtp_from_email": cfg.smtp_from_email or "",
        "smtp_configurado": bool(cfg.smtp_host and cfg.smtp_user and cfg.smtp_password),
        "email_comunicados_habilitado": cfg.email_comunicados_habilitado,
        "bloquear_boleta_por_deuda": cfg.bloquear_boleta_por_deuda,
        "max_cuotas_vencidas_bloqueo": cfg.max_cuotas_vencidas_bloqueo or 1,
        "facturacion_sunat_habilitada": cfg.facturacion_sunat_habilitada,
        "sunat_api_url": cfg.sunat_api_url or "",
        "sunat_api_token": "••••••••" if cfg.sunat_api_token else "",
        "sunat_serie_boleta": cfg.sunat_serie_boleta or "B001",
        "sunat_serie_factura": cfg.sunat_serie_factura or "F001",
        "cuenta_recaudacion_bcp": cfg.cuenta_recaudacion_bcp or "",
        "cuenta_recaudacion_bbva": cfg.cuenta_recaudacion_bbva or "",
    })


def _get_or_create_config():
    cfg = ConfiguracionInstitucional.objects.first()
    if not cfg:
        cfg = ConfiguracionInstitucional.objects.create(
            nombre_institucion="Institución Educativa",
            sigla="I.E.",
        )
    elif not cfg.nombre_institucion:
        cfg.nombre_institucion = "Institución Educativa"
        cfg.sigla = cfg.sigla or "I.E."
        cfg.save(update_fields=["nombre_institucion", "sigla"])
    return cfg


def _sigla(nombre: str) -> str:
    """Devuelve las iniciales para el logo mini (ej: 'I.E. Nuestra Señora de la Merced' → 'NSM')."""
    stopwords = {"nacional", "colegio", "institución", "institucion", "educativa",
                 "educativo", "escuela", "de", "del", "la", "el", "los", "las"}
    palabras = [p for p in nombre.replace(".", " ").split()
                if len(p) > 2 and p[0].isupper() and p.lower() not in stopwords]
    if len(palabras) >= 2:
        return (palabras[0][0] + palabras[1][0]).upper()
    if palabras:
        return palabras[0][:2].upper()
    return "IE"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kpis_director(request):
    """KPIs en tiempo real para el dashboard del director."""
    if request.user.rol not in ("director", "subdirector", "admin_tic"):
        raise PermissionDenied()

    from django.utils import timezone
    from apps.usuarios.models import Estudiante, Seccion

    hoy = timezone.localdate()
    anio = hoy.year
    es_fin_de_semana = hoy.weekday() >= 5

    # 1. Asistencia hoy
    try:
        from apps.asistencia.models import RegistroAsistencia
        total_est = Estudiante.objects.filter(usuario__activo=True).count()
        registros_hoy = RegistroAsistencia.objects.filter(fecha=hoy).count()
        presentes_hoy = RegistroAsistencia.objects.filter(
            fecha=hoy, estado__in=("presente", "tardanza")
        ).count()
        pct_asistencia = round(presentes_hoy / total_est * 100) if (total_est and registros_hoy > 0) else None
    except Exception:
        pct_asistencia = None
        registros_hoy = 0
        total_est = 0
        presentes_hoy = 0

    # 2. Incidencias abiertas (no cerradas ni resueltas)
    try:
        from apps.incidencias.models import Incidencia
        incidencias_abiertas = Incidencia.objects.exclude(
            estado__in=("resuelta", "cerrada")
        ).count()
        incidencias_nuevas = Incidencia.objects.filter(estado="nueva").count()
    except Exception:
        incidencias_abiertas = 0
        incidencias_nuevas = 0

    # 3. Casos SíseVe activos, vencidos y próximos a vencer
    try:
        from apps.convivencia.models import CasoConvivencia
        from django.utils.timezone import now as tz_now
        from datetime import timedelta
        activos_qs = CasoConvivencia.objects.exclude(
            estado__in=("cerrado", "cerrado_falso")
        )
        casos_activos = activos_qs.count()
        ahora = tz_now()
        fecha_limite_pronto = ahora + timedelta(days=7)
        casos_vencidos = activos_qs.filter(fecha_limite__lt=ahora).count()
        casos_por_vencer = activos_qs.filter(
            fecha_limite__gte=ahora, fecha_limite__lte=fecha_limite_pronto
        ).count()
    except Exception:
        casos_activos = 0
        casos_vencidos = 0
        casos_por_vencer = 0

    # 4. Totales de estudiantes y secciones
    try:
        total_estudiantes = Estudiante.objects.filter(usuario__activo=True).count()
        total_secciones = Seccion.objects.count()
    except Exception:
        total_estudiantes = 0
        total_secciones = 0

    # 5. Alertas de riesgo académico (estudiantes con muchas notas C)
    try:
        from apps.notas.models import NotaBimestre
        from django.db.models import Count
        en_riesgo = (
            NotaBimestre.objects.filter(calificacion="C", anio_lectivo=anio)
            .values("estudiante")
            .annotate(n=Count("id"))
            .filter(n__gte=3)
            .count()
        )
    except Exception:
        en_riesgo = 0

    return Response({
        "asistencia_hoy": {
            "pct": pct_asistencia,
            "presentes": presentes_hoy if registros_hoy > 0 else None,
            "total": total_est,
            "hay_registros": registros_hoy > 0,
            "es_dia_no_lectivo": es_fin_de_semana and registros_hoy == 0,
            "motivo_no_lectivo": "Fin de semana (no lectivo)" if es_fin_de_semana else "",
        },
        "incidencias": {
            "abiertas": incidencias_abiertas,
            "nuevas": incidencias_nuevas,
        },
        "convivencia": {
            "activos": casos_activos,
            "vencidos": casos_vencidos,
            "por_vencer": casos_por_vencer,
        },
        "estudiantes": {
            "total": total_estudiantes,
            "secciones": total_secciones,
        },
        "riesgo_academico": {
            "en_riesgo": en_riesgo,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def versiones_sistema(request):
    """Devuelve el historial de versiones de Sistematic con metadatos de actualización."""
    versiones, instalada = get_versiones()
    hay_actualizacion = any(v["es_nueva"] for v in versiones)
    return Response({
        "version_instalada": instalada,
        "hay_actualizacion": hay_actualizacion,
        "versiones": versiones,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def servir_archivo(request, token: str):
    """GET /api/archivos/<token>/ — el archivo de un enlace firmado.

    `AllowAny` a propósito y no por descuido: la autorización la lleva el
    token, porque un `<img src="...">` no manda el header `Authorization` con
    el que se autentica esta app. Sólo se puede tener un token válido si el
    servidor lo emitió dentro de una respuesta que sí exigió sesión.

    Nunca sirve directorios ni rutas de fuera de MEDIA_ROOT: eso lo comprueba
    `archivos.ruta_de`, que además responde None por igual ante una firma
    inválida, una vencida y una que apunte afuera — distinguirlas le diría a
    quien pruebe tokens cuál de las tres falló.
    """
    import mimetypes

    from django.http import FileResponse, Http404

    from .archivos import ruta_de

    ruta = ruta_de(token)
    if ruta is None:
        raise Http404

    tipo, _ = mimetypes.guess_type(ruta.name)
    respuesta = FileResponse(
        ruta.open("rb"), content_type=tipo or "application/octet-stream",
    )
    # Que ninguna caché intermedia guarde copia: el agujero anterior servía
    # esto mismo con `Cache-Control: public` por siete días.
    respuesta["Cache-Control"] = "private, no-store"
    respuesta["X-Content-Type-Options"] = "nosniff"
    # Se descarga, no se ejecuta: un SVG o un HTML subido como adjunto se
    # abriría en el origen de la app y podría leer el token de localStorage.
    respuesta["Content-Disposition"] = f'inline; filename="{ruta.name}"'
    if (tipo or "").startswith(("text/html", "image/svg")):
        respuesta["Content-Disposition"] = f'attachment; filename="{ruta.name}"'
    return respuesta
