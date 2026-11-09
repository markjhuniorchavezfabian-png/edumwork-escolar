# ═══════════════════════════════════════════════════════════════════════════
# Dockerfile Unificado de Producción — EduMWork (Frontend + Backend + Nginx)
# Optimizado para Railway Hobby (~100-150MB RAM)
# ═══════════════════════════════════════════════════════════════════════════

# ── Etapa 1: Compilación de Frontend Vite ──────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ .
ENV VITE_API_URL=/api
RUN npm run build

# ── Etapa 2: Compilación de Wheels Python ──────────────────────────────────
FROM python:3.11-slim AS backend-builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ── Etapa 3: Runtime Unificado ─────────────────────────────────────────────
FROM python:3.11-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx gettext-base libpq5 curl postgresql-client gzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias precompiladas de Python
COPY --from=backend-builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copiar el backend
COPY backend/ /app/backend/

# Copiar la build del frontend a la carpeta servida por Nginx
COPY --from=frontend-builder /build/dist /var/www/frontend

# Plantilla Nginx y script de arranque
COPY deploy/railway-nginx.conf.template /etc/nginx/templates/railway.conf.template
COPY deploy/railway-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Crear carpetas estáticas y media
RUN mkdir -p /app/backend/media /app/backend/staticfiles

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=proyecto_api.settings \
    PORT=8080

EXPOSE 8080

CMD ["/bin/bash", "/app/entrypoint.sh"]
