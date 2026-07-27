# ═══════════════════════════════════════════════════════════════════════════
# Dockerfile del frontend Vite — producción
#
# Multi-stage:
#   1. builder — instala deps y hace `npm run build`
#   2. runtime — nginx sirve los estáticos (más chico y rápido)
#
# Configuración: nginx proxea /api → backend (por variable API_UPSTREAM).
# ═══════════════════════════════════════════════════════════════════════════

# ── Etapa 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# En producción, el frontend y el backend están detrás del mismo nginx.
# Rutas relativas (/api) evitan configurar CORS y URLs por entorno.
ENV VITE_API_URL=/api
RUN npm run build


# ── Etapa 2: runtime ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# nginx:alpine oficial procesa /etc/nginx/templates/*.template con envsubst
# automáticamente en el entrypoint, no hace falta instalar gettext.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /build/dist /usr/share/nginx/html

# Variables por defecto (reemplazadas por envsubst en runtime)
ENV API_UPSTREAM=http://backend:8000 \
    PORT=80 \
    NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template

EXPOSE 80

# Usa el entrypoint por defecto de nginx (procesa templates + arranca daemon)
