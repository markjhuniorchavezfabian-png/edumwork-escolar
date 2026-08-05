#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# install_colegio.sh — LEGACY. NO USAR PARA INSTALAR UN COLEGIO.
#
# Este es el camino viejo: baja imágenes ya construidas desde un registry
# (Docker Hub). Esas imágenes se eliminaron el 2026-07-24 al decidir el modelo
# de instalación asistida, así que este script falla en un VPS limpio.
#
# ► El instalador vigente es `deploy/install_colegio.sh`: clona el repo privado
#   y construye desde el código fuente con docker-compose.prod.yml.
#   Ver docs/GUIA_INSTALACION_ASISTIDA.md.
#
# Se conserva solo como referencia del flujo por registry, por si algún día
# se vuelve a distribuir imágenes (decisión que hoy está descartada).
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "Este instalador es LEGACY (imágenes de registry) y no funciona hoy."
echo "Usá: sudo bash deploy/install_colegio.sh"
echo "Si aun así querés correrlo: INSTALL_LEGACY=1 bash install_colegio.sh"
[ "${INSTALL_LEGACY:-0}" = "1" ] || exit 1

VERDE="\033[0;32m"
AMARILLO="\033[1;33m"
ROJO="\033[0;31m"
CYAN="\033[0;36m"
NEGRITA="\033[1m"
NC="\033[0m"

ok()   { echo -e "${VERDE}✓${NC} $1"; }
info() { echo -e "${AMARILLO}→${NC} $1"; }
err()  { echo -e "${ROJO}✗ ERROR:${NC} $1"; exit 1; }
paso() { echo -e "\n${CYAN}${NEGRITA}[$1]${NC} $2"; }

leer() {
    local var=$1 prompt=$2 default=${3:-}
    if [[ -n "$default" ]]; then
        read -rp "    $prompt [$default]: " valor
        echo "${valor:-$default}"
    else
        local valor=""
        while [[ -z "$valor" ]]; do
            read -rp "    $prompt: " valor
            [[ -z "$valor" ]] && echo -e "    ${ROJO}Este campo es obligatorio.${NC}"
        done
        echo "$valor"
    fi
}

leer_password() {
    local prompt=$1
    local p1="" p2="x"
    while [[ "$p1" != "$p2" || -z "$p1" ]]; do
        read -rsp "    $prompt: " p1; echo ""
        read -rsp "    Repetir contraseña: " p2; echo ""
        [[ "$p1" != "$p2" ]] && echo -e "    ${ROJO}Las contraseñas no coinciden. Intenta de nuevo.${NC}"
        [[ -z "$p1" ]] && echo -e "    ${ROJO}La contraseña no puede estar vacía.${NC}"
    done
    echo "$p1"
}

leer_yn() {
    local prompt=$1 default=${2:-s}
    read -rp "    $prompt [s/n, por defecto: $default]: " resp
    resp="${resp:-$default}"
    [[ "$resp" =~ ^[sS]$ ]]
}

generar_secret() {
    python3 -c "import secrets; print(secrets.token_urlsafe(50))"
}

generar_hex() {
    python3 -c "import secrets; print(secrets.token_hex(24))"
}

generar_fernet() {
    python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null \
        || python3 -c "import base64, secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
}

# ════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}${NEGRITA}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   Sistema TIC Escolar — Instalación      ║"
echo "  ║   Asistente interactivo                  ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo "  Este asistente configura el sistema completo"
echo "  en menos de 5 minutos. Solo necesitas responder"
echo "  unas preguntas."
echo ""

# ── Verificar root ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "Ejecutar como root: sudo bash install_colegio.sh"
fi

# ── Verificar Python 3 (necesario para generar claves) ──────────────────────
if ! command -v python3 &>/dev/null; then
    err "Python 3 no encontrado. Instalar: apt install python3"
fi

# ════════════════════════════════════════════════════════════════════════════
paso "1/6" "Datos del colegio"
echo ""

NOMBRE_COLEGIO=$(leer NOMBRE_COLEGIO "Nombre completo del colegio (ej: I.E. Nuestra Señora de la Merced)")
CODIGO_MODULAR=$(leer CODIGO_MODULAR "Código modular MINEDU (opcional, Enter para omitir)" "")
UGEL=$(leer UGEL "UGEL a la que pertenece (ej: UGEL 03 Amarilis)" "")
EMAIL_INSTITUCIONAL=$(leer EMAIL_INSTITUCIONAL "Email institucional del colegio (opcional, Enter para omitir)" "")
DIRECTOR_NOMBRE=$(leer DIRECTOR_NOMBRE "Nombre completo del director")
DIRECTOR_EMAIL=$(leer DIRECTOR_EMAIL "Correo electrónico del director")

echo ""
echo -e "  ${NEGRITA}Contraseña de acceso inicial del director:${NC}"
echo "  (Se recomienda cambiarla en el primer ingreso)"
DIRECTOR_PASSWORD=$(leer_password "Contraseña inicial")

# ════════════════════════════════════════════════════════════════════════════
paso "2/6" "Configuración del servidor"
echo ""

IP_PUBLICA=$(curl -s ifconfig.me 2>/dev/null || echo "")
if [[ -n "$IP_PUBLICA" ]]; then
    echo "  IP pública detectada: ${CYAN}${IP_PUBLICA}${NC}"
fi

echo ""
echo "  El sistema puede ser accesible por:"
echo "    [1] IP directa           (http://${IP_PUBLICA:-TU_IP})"
echo "    [2] Dominio personalizado (ej: sistema.mi-colegio.edu.pe)"
echo ""
read -rp "    Elige [1/2, por defecto: 1]: " MODO_ACCESO
MODO_ACCESO="${MODO_ACCESO:-1}"

if [[ "$MODO_ACCESO" == "2" ]]; then
    DOMINIO=$(leer DOMINIO "Dominio (sin https://)")
    ALLOWED_HOSTS="${DOMINIO},${IP_PUBLICA:-localhost}"
    SECURE_SSL="True"
    INSTALAR_SSL=true
else
    DOMINIO="${IP_PUBLICA:-localhost}"
    ALLOWED_HOSTS="${IP_PUBLICA:-localhost},localhost,127.0.0.1"
    SECURE_SSL="False"
    INSTALAR_SSL=false
fi

HTTP_PORT=80
if leer_yn "¿Puerto 80 disponible?" "s"; then
    HTTP_PORT=80
else
    HTTP_PORT=$(leer HTTP_PORT "Puerto HTTP a usar" "8080")
fi

# ════════════════════════════════════════════════════════════════════════════
paso "3/6" "Email (para reseteo de contraseñas y alertas)"
echo ""

CONFIGURAR_EMAIL=false
if leer_yn "¿Configurar envío de correos ahora?" "n"; then
    CONFIGURAR_EMAIL=true
    EMAIL_HOST=$(leer EMAIL_HOST "Servidor SMTP (ej: smtp.gmail.com)" "smtp.gmail.com")
    EMAIL_PORT=$(leer EMAIL_PORT "Puerto SMTP" "587")
    EMAIL_USER=$(leer EMAIL_USER "Usuario/correo SMTP")
    read -rsp "    Contraseña de aplicación SMTP: " EMAIL_PASSWORD; echo ""
    EMAIL_FROM=$(leer EMAIL_FROM "Correo remitente" "$EMAIL_USER")
fi

# ════════════════════════════════════════════════════════════════════════════
paso "4/6" "Registry de imágenes Docker"
echo ""
echo "  El sistema se descarga como imágenes Docker pre-compiladas."
echo "  Puedes usar Docker Hub (docker.io), GitHub Container Registry (ghcr.io) o tu propio registry."
echo ""
DOCKER_REGISTRY=$(leer DOCKER_REGISTRY "Registry (ej: docker.io, ghcr.io)" "docker.io")
IMAGE_PREFIX=$(leer IMAGE_PREFIX "Usuario/organización del registry" "edumwork")
VERSION=$(leer VERSION "Versión de la imagen" "latest")

# ════════════════════════════════════════════════════════════════════════════
paso "5/6" "Generando configuración"
echo ""

INSTALL_DIR="/opt/edumwork"
DB_NAME="edumwork"
DB_USER="edumwork"

info "Generando claves de seguridad..."
SECRET_KEY=$(generar_secret)
DB_PASSWORD=$(generar_hex)
IA_ENCRYPTION_KEY=$(generar_fernet)
ok "Claves generadas (aleatorias, únicas para este colegio)"

# Crear directorio
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
ok "Directorio de instalación: $INSTALL_DIR"

info "Generando docker-compose.colegio.yml..."
cat > docker-compose.colegio.yml <<'COMPOSE_EOF'
# ═══════════════════════════════════════════════════════════════════════════
# docker-compose.colegio.yml — EduMWork Sistema TIC Escolar
# Generado por install_colegio.sh — no editar manualmente.
# ═══════════════════════════════════════════════════════════════════════════

services:

  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      TZ: ${TZ:-America/Lima}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [interno]

  backend:
    image: ${DOCKER_REGISTRY:-docker.io}/${IMAGE_PREFIX:-edumwork}/edumwork-backend:${VERSION:-latest}
    restart: always
    labels:
      - "com.centurylinklabs.watchtower.scope=edumwork"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DEBUG: "False"
      SECRET_KEY: ${SECRET_KEY}
      ALLOWED_HOSTS: ${ALLOWED_HOSTS}
      TZ: ${TZ:-America/Lima}
      POSTGRES_HOST: db
      POSTGRES_PORT: "5432"
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_URL: redis://redis:6379/0
      CACHE_BACKEND: django.core.cache.backends.redis.RedisCache
      CACHE_LOCATION: redis://redis:6379/1
      IA_ENCRYPTION_KEY: ${IA_ENCRYPTION_KEY}
      DEFAULT_FROM_EMAIL: ${DEFAULT_FROM_EMAIL}
      EMAIL_BACKEND: ${EMAIL_BACKEND:-django.core.mail.backends.console.EmailBackend}
      EMAIL_HOST: ${EMAIL_HOST:-}
      EMAIL_PORT: ${EMAIL_PORT:-587}
      EMAIL_HOST_USER: ${EMAIL_HOST_USER:-}
      EMAIL_HOST_PASSWORD: ${EMAIL_HOST_PASSWORD:-}
      EMAIL_USE_TLS: ${EMAIL_USE_TLS:-True}
      CORS_EXTRA_ORIGINS: ${CORS_EXTRA_ORIGINS:-}
      FRONTEND_URL: ${FRONTEND_URL:-}
      SECURE_SSL_REDIRECT: "False"
      GUNICORN_WORKERS: ${GUNICORN_WORKERS:-2}
    volumes:
      - media_data:/app/media
      - static_data:/app/staticfiles
    networks: [interno]

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    environment:
      TZ: ${TZ:-America/Lima}
    volumes:
      - redis_data:/data
    networks: [interno]

  frontend:
    image: ${DOCKER_REGISTRY:-docker.io}/${IMAGE_PREFIX:-edumwork}/edumwork-frontend:${VERSION:-latest}
    restart: always
    labels:
      - "com.centurylinklabs.watchtower.scope=edumwork"
    depends_on:
      - backend
    environment:
      API_UPSTREAM: http://backend:8000
      PORT: "80"
      TZ: ${TZ:-America/Lima}
    volumes:
      - static_data:/usr/share/nginx/html/static:ro
      - media_data:/usr/share/nginx/html/media:ro
    networks: [interno]

  caddy:
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
    networks: [interno]

  watchtower:
    image: containrrr/watchtower:latest
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      WATCHTOWER_CLEANUP: "true"
      WATCHTOWER_POLL_INTERVAL: "86400"
      WATCHTOWER_SCHEDULE: "0 0 3 * * *"
      WATCHTOWER_ROLLING_RESTART: "true"
      WATCHTOWER_INCLUDE_STOPPED: "false"
      WATCHTOWER_SCOPE: edumwork
      TZ: ${TZ:-America/Lima}
    command: --scope edumwork
    networks: [interno]
    labels:
      - "com.centurylinklabs.watchtower.scope=edumwork"

volumes:
  postgres_data:
  redis_data:
  media_data:
  static_data:
  caddy_data:
  caddy_config:

networks:
  interno:
    driver: bridge
COMPOSE_EOF
ok "docker-compose.colegio.yml generado"

# Calcular CORS y FRONTEND_URL según acceso
if [[ "$MODO_ACCESO" == "2" ]]; then
    CORS_EXTRA_ORIGINS="https://${DOMINIO}"
    FRONTEND_URL="https://${DOMINIO}"
else
    CORS_EXTRA_ORIGINS=""
    FRONTEND_URL="http://${DOMINIO}"
    if [[ "$HTTP_PORT" != "80" ]]; then
        FRONTEND_URL="http://${DOMINIO}:${HTTP_PORT}"
    fi
fi

# Escribir .env completamente configurado — sin valores "CAMBIAR"
info "Escribiendo .env..."
cat > .env <<EOF
# ─────────────────────────────────────────────────────────────────────────
# Sistema TIC Escolar — Configuración de ${NOMBRE_COLEGIO}
# Generado automáticamente el $(date '+%d/%m/%Y %H:%M')
# NO compartir este archivo — contiene credenciales.
# ─────────────────────────────────────────────────────────────────────────

# Imágenes Docker
DOCKER_REGISTRY=${DOCKER_REGISTRY}
IMAGE_PREFIX=${IMAGE_PREFIX}
VERSION=${VERSION}

# Colegio
NOMBRE_COLEGIO=${NOMBRE_COLEGIO}
CODIGO_MODULAR=${CODIGO_MODULAR}
UGEL=${UGEL}

# Director inicial
DIRECTOR_NOMBRE=${DIRECTOR_NOMBRE}
DIRECTOR_EMAIL=${DIRECTOR_EMAIL}
DIRECTOR_PASSWORD=${DIRECTOR_PASSWORD}

# Django
SECRET_KEY=${SECRET_KEY}
ALLOWED_HOSTS=${ALLOWED_HOSTS}
CORS_EXTRA_ORIGINS=${CORS_EXTRA_ORIGINS}
FRONTEND_URL=${FRONTEND_URL}
SECURE_SSL_REDIRECT=${SECURE_SSL}

# PostgreSQL
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}

# Cifrado IA
IA_ENCRYPTION_KEY=${IA_ENCRYPTION_KEY}

# Zona horaria
TZ=America/Lima

# Rendimiento (2 workers para VPS 1-2 GB, 4 para VPS 4 GB+)
GUNICORN_WORKERS=2

# Email
EOF

if [[ "$CONFIGURAR_EMAIL" == "true" ]]; then
cat >> .env <<EOF
DEFAULT_FROM_EMAIL=${EMAIL_FROM}
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=${EMAIL_HOST}
EMAIL_PORT=${EMAIL_PORT}
EMAIL_USE_TLS=True
EMAIL_HOST_USER=${EMAIL_USER}
EMAIL_HOST_PASSWORD=${EMAIL_PASSWORD}
EOF
else
cat >> .env <<EOF
DEFAULT_FROM_EMAIL=no-reply@edumwork.pe
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EOF
fi

ok ".env generado"
chmod 600 .env
ok "Permisos .env: 600 (solo root puede leerlo)"

# Generar Caddyfile
info "Generando Caddyfile..."
if [[ "$MODO_ACCESO" == "2" ]]; then
cat > Caddyfile <<EOF
${DOMINIO} {
    reverse_proxy frontend:80
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
EOF
else
cat > Caddyfile <<EOF
:${HTTP_PORT} {
    reverse_proxy frontend:80
    encode gzip
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
EOF
fi
ok "Caddyfile generado"

# ════════════════════════════════════════════════════════════════════════════
paso "6/6" "Instalando Docker y levantando el sistema"
echo ""

# Instalar Docker si no está
if command -v docker &>/dev/null; then
    ok "Docker ya instalado ($(docker --version | cut -d' ' -f3 | tr -d ','))"
else
    info "Instalando Docker (puede tomar 1-2 minutos)..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    ok "Docker instalado"
fi

# Verificar docker compose plugin
if ! docker compose version &>/dev/null; then
    info "Instalando Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
fi

# Descargar imágenes y levantar servicios
info "Descargando imágenes del sistema (primera vez puede tardar 3-5 min)..."
docker compose -f docker-compose.colegio.yml --env-file .env pull
ok "Imágenes descargadas"

info "Iniciando servicios..."
docker compose -f docker-compose.colegio.yml --env-file .env up -d
ok "Servicios iniciados"

# Esperar backend
info "Esperando que el backend esté listo..."
INTENTOS=0
until docker compose -f docker-compose.colegio.yml exec -T backend \
    curl -sf http://localhost:8000/health/ &>/dev/null; do
    INTENTOS=$((INTENTOS+1))
    [[ $INTENTOS -gt 40 ]] && err "El backend no respondió. Ver logs: docker compose -f docker-compose.colegio.yml logs backend"
    sleep 4
done
ok "Backend listo"

# Aplicar migraciones
info "Aplicando estructura de base de datos..."
docker compose -f docker-compose.colegio.yml exec -T backend \
    python manage.py migrate --noinput
ok "Base de datos lista"

# Configurar el colegio con los datos ingresados
info "Configurando datos del colegio..."
docker compose -f docker-compose.colegio.yml exec -T backend \
    python manage.py setup_colegio \
        --nombre "${NOMBRE_COLEGIO}" \
        --codigo-modular "${CODIGO_MODULAR}" \
        --ugel "${UGEL}" \
        --email-institucional "${EMAIL_INSTITUCIONAL}" \
        --director-nombre "${DIRECTOR_NOMBRE}" \
        --director-email "${DIRECTOR_EMAIL}" \
        --director-password "${DIRECTOR_PASSWORD}"
ok "Colegio configurado"

# Crear calendario escolar y feriados oficiales
info "Creando calendario escolar..."
docker compose -f docker-compose.colegio.yml exec -T backend \
    python manage.py seed_calendario
ok "Calendario escolar creado"

# Cargar currículo nacional (CNEB) — áreas, competencias y capacidades
info "Cargando currículo nacional CNEB..."
docker compose -f docker-compose.colegio.yml exec -T backend \
    python manage.py seed_cneb
ok "Currículo nacional cargado"

# Configurar backups automáticos en cron
info "Configurando backups diarios..."
CRON_CMD="0 2 * * * cd ${INSTALL_DIR} && docker compose -f docker-compose.colegio.yml --env-file .env exec -T backend python manage.py backup_db >> /var/log/edumwork-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v "edumwork-backup" || true ; echo "$CRON_CMD" ) | crontab -
ok "Backup diario programado (02:00 AM)"

# ════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${VERDE}${NEGRITA}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   ✓ Instalación completada               ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

URL="http://${DOMINIO}"
[[ "$HTTP_PORT" != "80" ]] && URL="http://${DOMINIO}:${HTTP_PORT}"
[[ "$MODO_ACCESO" == "2" ]] && URL="https://${DOMINIO}"

echo -e "  ${NEGRITA}Colegio:${NC}   ${NOMBRE_COLEGIO}"
echo -e "  ${NEGRITA}Sistema:${NC}   ${CYAN}${URL}${NC}"
echo ""
echo -e "  ${NEGRITA}Acceso del director:${NC}"
echo "    Usuario:     director"
echo "    Contraseña:  (la que ingresaste)"
echo "    Correo:      ${DIRECTOR_EMAIL}"
echo ""
echo "  ⚠  Cambiar la contraseña en el primer ingreso:"
echo "     Mi perfil → Cambiar contraseña"
echo ""
echo "  Actualizaciones automáticas: activas (Watchtower, 3 AM)"
echo "  Backups automáticos: activos (2 AM)"
echo ""
echo "  Comandos útiles:"
echo "    Ver estado:  docker compose -f ${INSTALL_DIR}/docker-compose.colegio.yml ps"
echo "    Ver logs:    docker compose -f ${INSTALL_DIR}/docker-compose.colegio.yml logs -f"
echo "    Reiniciar:   docker compose -f ${INSTALL_DIR}/docker-compose.colegio.yml restart"
echo "    Backup BD:   docker compose -f ${INSTALL_DIR}/docker-compose.colegio.yml exec -T backend python manage.py backup_db"
echo ""
echo "  Soporte: soporte@edumwork.pe"
echo ""
