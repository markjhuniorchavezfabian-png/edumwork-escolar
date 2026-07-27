# ═══════════════════════════════════════════════════════════════════════════
# Dockerfile del backend Django — producción
#
# Multi-stage:
#   1. builder   — instala dependencias en un entorno con compiladores
#   2. runtime   — imagen final sin herramientas de build (más chica y segura)
#
# Corre gunicorn como usuario no-root, sirve la app en el puerto 8000.
# ═══════════════════════════════════════════════════════════════════════════

# ── Etapa 1: builder ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Compiladores solo en esta etapa
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


# ── Etapa 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# libpq5 = runtime psycopg. postgresql-client = pg_dump/psql para backup/restore desde la app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl postgresql-client gzip \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 app \
    && useradd --uid 1000 --gid app --shell /bin/bash --create-home app

WORKDIR /app

# Instalar wheels precompilados (sin gcc en la imagen final)
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels
RUN pip install --no-cache-dir gunicorn==22.0.0

# Copiar el código de la app (con .dockerignore para excluir venv, __pycache__, etc.)
COPY --chown=app:app . .

# Volumen para /media (uploads persistentes) — Fly.io lo monta como volumen
RUN mkdir -p /app/media /app/staticfiles && chown -R app:app /app/media /app/staticfiles

USER app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DJANGO_SETTINGS_MODULE=proyecto_api.settings

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health/ || exit 1

# Script de arranque: migra + collectstatic + gunicorn
COPY --chown=app:app entrypoint.sh /entrypoint.sh
CMD ["/bin/bash", "/entrypoint.sh"]
