import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-dev-only-change-in-production",
)

DEBUG = os.environ.get("DEBUG", "True") == "True"

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

AUTH_USER_MODEL = "usuarios.Usuario"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "axes",
    "apps.core",
    "apps.usuarios",
    "apps.incidencias",
    "apps.ia",
    "apps.asistencia",
    "apps.inventario",
    "apps.visitas",
    "apps.auditoria",
    "apps.comunicados",
    "apps.convivencia",
    "apps.ambientes",
    "apps.notificaciones",
    "apps.reservas",
    "apps.asistencia_personal",
    "apps.justificaciones",
    "apps.notas",
    "apps.aula_virtual",
    "apps.curricula",
    "apps.calendario",
]

# Email — consola en dev, SMTP en prod
# Backend DB-first: lee SMTP de ConfiguracionInstitucional, fallback a env vars, fallback a console
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "apps.core.email_backend.DbSmtpEmailBackend",
)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@edumwork.pe")

# URL pública del frontend (usada para enlaces de invitación, reset de contraseña, etc.)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")

_ia_key_default = "" if not DEBUG else "gQ0NaQdP6-2GmN8q7uoWhWx6ZXlxuORCHwmL3-k7dB4="
IA_ENCRYPTION_KEY = os.environ.get("IA_ENCRYPTION_KEY", _ia_key_default)
if not IA_ENCRYPTION_KEY:
    raise RuntimeError("IA_ENCRYPTION_KEY es requerida en producción. Agrégala al .env.")

# ── Edición del sistema (para el modelo comercial) ─────────────────────────
# "completa"     → todos los roles habilitados (director, docente, admin_tic, padre, estudiante, ugel)
# "solo_docente" → sub-app para colegios chicos: solo rol=docente. Uno o varios pueden ser es_administrador.
EDICION = os.environ.get("EDICION", "completa")
if EDICION not in ("completa", "solo_docente"):
    EDICION = "completa"

MIDDLEWARE = [
    "django.middleware.gzip.GZipMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.auditoria.middleware.ActorAuditoriaMiddleware",
    "apps.usuarios.tenant.CurrentUserMiddleware",  # multi-tenant: thread-local user
    "axes.middleware.AxesMiddleware",
]

AUTHENTICATION_BACKENDS = [
    "axes.backends.AxesStandaloneBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# django-axes — bloqueo tras 5 intentos fallidos
AXES_FAILURE_LIMIT = 10
AXES_COOLOFF_TIME = 1/12  # horas (5 min)
AXES_LOCKOUT_TEMPLATE = None
AXES_LOCKOUT_PARAMETERS = [["username", "ip_address"]]  # combo (no OR): lockout por par exacto
# Detrás de nginx: la IP real viene en X-Forwarded-For, no en REMOTE_ADDR (que es el container).
AXES_IPWARE_PROXY_COUNT = 1
AXES_IPWARE_META_PRECEDENCE_ORDER = [
    "HTTP_X_FORWARDED_FOR",
    "HTTP_X_REAL_IP",
    "REMOTE_ADDR",
]

# Cache — usado por django-ratelimit. En dev locmem, en prod Redis (via env).
CACHES = {
    "default": {
        "BACKEND": os.environ.get("CACHE_BACKEND", "django.core.cache.backends.locmem.LocMemCache"),
        "LOCATION": os.environ.get("CACHE_LOCATION", "edumwork-cache"),
    }
}
RATELIMIT_USE_CACHE = "default"

ROOT_URLCONF = "proyecto_api.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "proyecto_api.wsgi.application"

# DB: soporta DATABASE_URL (Fly.io, Railway, Render) o variables sueltas (docker-compose)
_DATABASE_URL = os.environ.get("DATABASE_URL", "")
if _DATABASE_URL:
    # Formato postgres://user:pass@host:port/dbname
    from urllib.parse import urlparse
    _p = urlparse(_DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _p.path.lstrip("/"),
            "USER": _p.username or "",
            "PASSWORD": _p.password or "",
            "HOST": _p.hostname or "",
            "PORT": str(_p.port or 5432),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "edumwork"),
            "USER": os.environ.get("POSTGRES_USER", "edumwork"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "dev_password"),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-pe"
TIME_ZONE = "America/Lima"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # Wrapper que setea thread-local user (para aislamiento multi-tenant personal)
        "apps.usuarios.tenant.TenantAwareJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 200,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost",
    "http://127.0.0.1",
]

# Orígenes CORS extra por env (para prod: "https://sistema.tu-colegio.edu.pe")
CORS_ALLOWED_ORIGINS += [
    o.strip() for o in os.environ.get("CORS_EXTRA_ORIGINS", "").split(",") if o.strip()
]

# Logging estructurado (aplica en dev y prod)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {asctime} {name} — {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"level": "INFO"},
        "apps": {"level": "INFO"},
        # Silenciar warnings deprecados de dependencias (N4)
        "litellm": {"level": "ERROR"},
        "pydantic": {"level": "ERROR"},
    },
}

# ═════════════════════════════════════════════════════════════════════════════
# Hardening de producción (activo solo cuando DEBUG=False)
# ═════════════════════════════════════════════════════════════════════════════
if not DEBUG:
    # HTTPS
    SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "True") == "True"
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Cookies
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

    # Contenido
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    X_FRAME_OPTIONS = "DENY"

    # Fail early si el SECRET_KEY sigue siendo el default
    if "django-insecure-dev-only" in SECRET_KEY:
        raise RuntimeError(
            "SECRET_KEY es la de desarrollo. Definí SECRET_KEY en el entorno de producción."
        )

    # Cache Redis en prod (evita LocMemCache que no comparte entre workers)
    if os.environ.get("REDIS_URL"):
        CACHES["default"] = {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": os.environ["REDIS_URL"],
        }

# Versión instalada del sistema (actualizar al instalar actualizaciones)
VERSION_INSTALADA = os.environ.get("VERSION_INSTALADA", "1.0.0")
