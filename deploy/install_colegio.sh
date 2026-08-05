#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Sistema TIC Escolar — Instalador para colegios
#
# Uso en un servidor Ubuntu 22.04+ recién comprado (SitioHost / Elástika / DonWeb):
#
#   curl -sSL https://raw.githubusercontent.com/etdherhwrahaerherahetar/sistema-tic-escolar/main/deploy/install_colegio.sh | sudo bash
#
# O si preferís revisarlo antes:
#   wget https://raw.githubusercontent.com/etdherhwrahaerherahetar/sistema-tic-escolar/main/deploy/install_colegio.sh
#   cat install_colegio.sh
#   sudo bash install_colegio.sh
#
# Qué hace:
#   1. Instala Docker + Docker Compose + Nginx + Certbot (SSL gratis)
#   2. Clona el sistema
#   3. Genera claves seguras aleatorias
#   4. Pregunta datos del colegio (nombre, dominio, RUC…)
#   5. Levanta todo el stack (Postgres + Redis + backend + frontend)
#   6. Configura HTTPS con Let's Encrypt (opcional)
#   7. Crea usuarios iniciales
#   8. Configura backup diario automático
#
# Tiempo estimado: 15-25 minutos
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

CYAN='\033[0;36m'; VERDE='\033[0;32m'; ROJO='\033[0;31m'; AMAR='\033[1;33m'; RESET='\033[0m'

log()   { echo -e "${CYAN}▶${RESET} $*"; }
ok()    { echo -e "${VERDE}✓${RESET} $*"; }
err()   { echo -e "${ROJO}✗${RESET} $*" >&2; }
warn()  { echo -e "${AMAR}⚠${RESET} $*"; }

# ── Requisitos previos ─────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || { err "Ejecutá con: sudo bash $0"; exit 1; }
command -v apt >/dev/null || { err "Este script requiere Ubuntu/Debian"; exit 1; }

echo
echo -e "${VERDE}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${VERDE}  Sistema TIC Escolar — Instalación automática${RESET}"
echo -e "${VERDE}══════════════════════════════════════════════════════════════${RESET}"
echo

# ── Preguntas al instalador ────────────────────────────────────────────────
echo -e "${AMAR}Ediciones disponibles:${RESET}"
echo "  1) Completa      → 6 roles (director, docente, admin_tic, padre, estudiante, ugel). Colegios grandes."
echo "  2) Solo Docente  → 1 rol (docente). Colegios chicos (1-10 docentes, unidocente/multigrado). Más barata."
read -rp "Elegí edición [1/2] (default 1): " EDICION_ELECCION
EDICION_ELECCION=${EDICION_ELECCION:-1}
if [ "$EDICION_ELECCION" = "2" ]; then
    EDICION="solo_docente"
    ok "Instalando Edición Docente."
else
    EDICION="completa"
    ok "Instalando Edición Completa."
fi
echo

read -rp "Nombre corto del colegio (ej: 'cesarvallejo'): " NOMBRE_CORTO
NOMBRE_CORTO=${NOMBRE_CORTO,,}
NOMBRE_CORTO=${NOMBRE_CORTO// /_}

read -rp "Nombre completo del colegio (ej: 'I.E. César Vallejo'): " NOMBRE_COMPLETO

# ── Datos del primer usuario (solo si es Edición Docente) ─────────────────
if [ "$EDICION" = "solo_docente" ]; then
    echo
    echo -e "${AMAR}En Edición Docente el primer usuario será el docente-administrador${RESET}"
    echo "(podrá crear estudiantes, secciones, ambientes y otros docentes)."
    read -rp "Nombre del docente admin: " DOCENTE_NOMBRE
    read -rp "Apellidos: " DOCENTE_APELLIDOS
    read -rp "Email: " DOCENTE_EMAIL
    read -rp "DNI (8 dígitos): " DOCENTE_DNI
    read -rp "Username (para login, ej: 'juanperez'): " DOCENTE_USERNAME
    read -rsp "Contraseña inicial: " DOCENTE_PASSWORD
    echo
fi
read -rp "Código modular (ej: '0712885', dejá vacío si no lo sabés): " COD_MODULAR
read -rp "¿Tenés un dominio propio (ej: sistema.cesarvallejo.edu.pe)? [S/n]: " USAR_DOMINIO
USAR_DOMINIO=${USAR_DOMINIO:-S}

if [[ "$USAR_DOMINIO" =~ ^[SsYy] ]]; then
    read -rp "Dominio (ej: sistema.cesarvallejo.edu.pe): " DOMINIO
    read -rp "Email para certificado SSL (Let's Encrypt te avisa cuando vence): " EMAIL_SSL
    HTTPS=1
else
    DOMINIO=$(hostname -I | awk '{print $1}')
    warn "Instalación sin HTTPS. Podrás agregarlo después."
    HTTPS=0
fi

# ── SMTP (opcional pero recomendado) ───────────────────────────────────────
echo
echo -e "${AMAR}📧 Configuración de correo (SMTP)${RESET}"
echo "El sistema envía correos para: reset de contraseña, alertas de convivencia"
echo "(plazo legal 30 días) y notificaciones a padres. Sin SMTP esas funciones"
echo "quedan desactivadas."
echo
read -rp "¿Configurás SMTP ahora? (Recomendado) [S/n]: " USAR_SMTP
USAR_SMTP=${USAR_SMTP:-S}

if [[ "$USAR_SMTP" =~ ^[SsYy] ]]; then
    echo
    echo "Proveedores recomendados:"
    echo "  1) Gmail        (smtp.gmail.com, puerto 587)"
    echo "  2) Resend       (smtp.resend.com, puerto 465) — 3000/mes gratis"
    echo "  3) Brevo        (smtp-relay.brevo.com, puerto 587) — 300/día gratis"
    echo "  4) Otro         (ingresás host y puerto manualmente)"
    read -rp "Elegí [1-4]: " SMTP_ELECCION

    case "$SMTP_ELECCION" in
        1) SMTP_HOST="smtp.gmail.com"; SMTP_PORT=587; SMTP_TLS=True ;;
        2) SMTP_HOST="smtp.resend.com"; SMTP_PORT=465; SMTP_TLS=False ;;
        3) SMTP_HOST="smtp-relay.brevo.com"; SMTP_PORT=587; SMTP_TLS=True ;;
        *) read -rp "Host SMTP: " SMTP_HOST
           read -rp "Puerto (587 típico): " SMTP_PORT
           SMTP_TLS=True ;;
    esac

    read -rp "Usuario SMTP (email de envío): " SMTP_USER
    read -rsp "Contraseña SMTP (contraseña de aplicación en Gmail): " SMTP_PASS
    echo
    read -rp "'From' del correo (default: $SMTP_USER): " SMTP_FROM
    SMTP_FROM=${SMTP_FROM:-$SMTP_USER}
    SMTP_ACTIVO=1
else
    warn "SMTP saltado. Podrás configurarlo después editando .env.prod."
    SMTP_ACTIVO=0
fi

echo
log "Confirmando datos:"
echo "  Nombre corto:     $NOMBRE_CORTO"
echo "  Nombre completo:  $NOMBRE_COMPLETO"
echo "  Dominio/IP:       $DOMINIO"
echo "  HTTPS:            $([ $HTTPS -eq 1 ] && echo 'Sí (Let'\''s Encrypt)' || echo 'No')"
echo
read -rp "¿Todo bien? [S/n]: " CONFIRMAR
[[ "${CONFIRMAR:-S}" =~ ^[SsYy] ]] || { err "Cancelado."; exit 1; }

# ── Paso 1: dependencias del sistema ───────────────────────────────────────
log "[1/8] Instalando Docker, Nginx y utilidades..."
export DEBIAN_FRONTEND=noninteractive
apt update -qq
apt install -y -qq curl git nginx ufw ca-certificates gnupg lsb-release

if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
fi

if [ $HTTPS -eq 1 ]; then
    apt install -y -qq certbot python3-certbot-nginx
fi
ok "Dependencias instaladas."

# ── Paso 2: firewall ───────────────────────────────────────────────────────
log "[2/8] Configurando firewall..."
ufw --force enable >/dev/null
ufw allow 22/tcp >/dev/null   # SSH
ufw allow 80/tcp >/dev/null   # HTTP
ufw allow 443/tcp >/dev/null  # HTTPS
ok "Firewall activo."

# ── Paso 3: clonar el repo ─────────────────────────────────────────────────
# El repo es PRIVADO: hace falta tu token de GitHub (el mismo que usaste para
# bajar este script). El token se usa solo para el clone y NO queda guardado
# en el VPS del cliente — se limpia del remote enseguida.
REPO_URL="https://github.com/etdherhwrahaerherahetar/sistema-tic-escolar.git"
if [ -z "${TU_TOKEN:-}" ]; then
    err "Falta la variable TU_TOKEN (tu Personal Access Token de GitHub)."
    err "El repo es privado, sin token el clone falla. Corré:"
    err "  export TU_TOKEN=ghp_XXX && sudo -E bash $0"
    exit 1
fi
REPO_URL_AUTH="https://x-access-token:${TU_TOKEN}@github.com/etdherhwrahaerherahetar/sistema-tic-escolar.git"

INSTALL_DIR="/opt/sistematic-$NOMBRE_CORTO"
log "[3/8] Clonando código en $INSTALL_DIR..."
if [ -d "$INSTALL_DIR" ]; then
    warn "El directorio ya existe. Actualizando..."
    cd "$INSTALL_DIR" && git pull "$REPO_URL_AUTH"
else
    git clone "$REPO_URL_AUTH" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"
git remote set-url origin "$REPO_URL"   # que el token no quede en .git/config
ok "Código instalado."

# ── Paso 4: generar .env.prod ──────────────────────────────────────────────
log "[4/8] Generando claves seguras..."
SECRET_KEY=$(python3 -c "import secrets;print(secrets.token_urlsafe(50))" 2>/dev/null || openssl rand -base64 50)
PGPASS=$(python3 -c "import secrets;print(secrets.token_urlsafe(24))" 2>/dev/null || openssl rand -base64 24)
FERNET=$(python3 -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())" 2>/dev/null || openssl rand -base64 32)

cat > .env.prod <<EOF
# Generado por install_colegio.sh — NO commitear

SECRET_KEY=$SECRET_KEY
ALLOWED_HOSTS=$DOMINIO,localhost,127.0.0.1
CORS_EXTRA_ORIGINS=https://$DOMINIO,http://$DOMINIO

POSTGRES_DB=sistematic
POSTGRES_USER=sistematic
POSTGRES_PASSWORD=$PGPASS

IA_ENCRYPTION_KEY=$FERNET

# Edición del sistema (completa | solo_docente)
EDICION=$EDICION

EOF

if [ "$SMTP_ACTIVO" -eq 1 ]; then
    cat >> .env.prod <<EOF
# SMTP configurado durante instalación
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=$SMTP_HOST
EMAIL_PORT=$SMTP_PORT
EMAIL_USE_TLS=$SMTP_TLS
EMAIL_HOST_USER=$SMTP_USER
EMAIL_HOST_PASSWORD=$SMTP_PASS
DEFAULT_FROM_EMAIL=$SMTP_FROM
EOF
else
    cat >> .env.prod <<EOF
# SMTP no configurado — los correos NO se envían de verdad.
# Editar este archivo cuando quieras activarlos.
DEFAULT_FROM_EMAIL=sistema@$DOMINIO
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EOF
fi

cat >> .env.prod <<EOF

# Puerto interno del contenedor frontend
HTTP_PORT=8080

# En producción HTTPS lo maneja Nginx del host
SECURE_SSL_REDIRECT=False
EOF

chmod 600 .env.prod
ok "Claves generadas y guardadas en .env.prod (chmod 600)."

# ── Paso 5: levantar Docker Compose ────────────────────────────────────────
log "[5/8] Construyendo y arrancando contenedores (10-15 min)..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
ok "Contenedores corriendo."

# ── Paso 6: seed inicial ───────────────────────────────────────────────────
log "[6/8] Esperando que la base de datos esté lista..."
sleep 12

log "Corriendo seeds iniciales..."
if [ "$EDICION" = "solo_docente" ]; then
    # Edición Docente: crear el primer docente admin en vez del pack completo de roles
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py shell -c "
from apps.usuarios.models import Usuario
u, creado = Usuario.objects.get_or_create(
    username='$DOCENTE_USERNAME',
    defaults=dict(
        first_name='$DOCENTE_NOMBRE',
        last_name='$DOCENTE_APELLIDOS',
        email='$DOCENTE_EMAIL',
        dni='$DOCENTE_DNI',
        rol='docente',
        activo=True,
        debe_cambiar_password=True,
        es_administrador=True,
    ),
)
if creado:
    u.set_password('$DOCENTE_PASSWORD')
    u.save()
    print(f'✓ Docente admin creado: {u.username}')
else:
    print(f'ℹ Usuario ya existía: {u.username}')
" 2>&1 | grep -E "creado|admin" || true
else
    docker compose -f docker-compose.prod.yml exec -T backend python manage.py seed_usuarios --produccion 2>&1 | grep -E "creado|Credenciales" | head -20 || true
fi

# Crear calendario escolar y feriados oficiales
docker compose -f docker-compose.prod.yml exec -T backend python manage.py seed_calendario 2>&1 | grep -E "feriados|año escolar" || true

# Cargar currículo nacional (CNEB) — áreas, competencias y capacidades
docker compose -f docker-compose.prod.yml exec -T backend python manage.py seed_cneb 2>&1 | grep -E "CNEB cargado|áreas" || true

# Personalizar la ConfiguracionInstitucional
docker compose -f docker-compose.prod.yml exec -T backend python manage.py shell -c "
from apps.core.models import ConfiguracionInstitucional
cfg, _ = ConfiguracionInstitucional.objects.get_or_create(pk=1)
cfg.nombre_institucion = '$NOMBRE_COMPLETO'
cfg.codigo_modular = '$COD_MODULAR'
cfg.save()
print(f'Configuración: {cfg.nombre_institucion}')
" 2>&1 | tail -3 || true

# Copiar CSV de credenciales al host
if docker compose -f docker-compose.prod.yml exec -T backend test -f credenciales_seed.csv 2>/dev/null; then
    docker compose -f docker-compose.prod.yml cp backend:/app/credenciales_seed.csv ./credenciales_seed.csv 2>/dev/null || true
    chmod 600 credenciales_seed.csv 2>/dev/null || true
    ok "Credenciales guardadas en $INSTALL_DIR/credenciales_seed.csv"
fi

# ── Paso 7: reverse proxy Nginx ────────────────────────────────────────────
log "[7/8] Configurando Nginx reverse proxy..."
cat > /etc/nginx/sites-available/sistematic <<EOF
server {
    listen 80;
    server_name $DOMINIO;
    client_max_body_size 20M;
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/sistematic /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && systemctl reload nginx
ok "Nginx configurado."

# ── Paso 8: SSL con Let's Encrypt ──────────────────────────────────────────
if [ $HTTPS -eq 1 ]; then
    log "[8/8] Solicitando certificado SSL a Let's Encrypt..."
    if certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --email "$EMAIL_SSL" --redirect >/dev/null 2>&1; then
        ok "HTTPS activo en https://$DOMINIO"
    else
        warn "El certificado SSL no se pudo crear ahora. Probá manual:"
        warn "  sudo certbot --nginx -d $DOMINIO"
    fi
else
    log "[8/8] Saltando SSL (elegiste sin dominio)."
fi

# ── Backup diario automático ───────────────────────────────────────────────
log "Configurando backup diario automático..."
mkdir -p /var/backups/sistematic
cat > /etc/cron.daily/sistematic-backup <<EOF
#!/bin/bash
cd $INSTALL_DIR
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db pg_dump -U sistematic sistematic | gzip > /var/backups/sistematic/backup-\$(date +%Y%m%d).sql.gz
# Retener últimos 30 días
find /var/backups/sistematic -type f -name "backup-*.sql.gz" -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/sistematic-backup
ok "Backup diario configurado en /var/backups/sistematic/"

# ── Cron para tareas programadas ───────────────────────────────────────────
cat > /etc/cron.d/sistematic-tareas <<EOF
# Alertar casos de convivencia próximos a vencer plazo legal
0 7 * * * root cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml exec -T backend python manage.py alertar_casos_vencer

# Rotar tokens de QR de campañas de auto-registro
0 3 1 * * root cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml exec -T backend python manage.py rotar_qr_campanas

# Avisar a dirección si el disco pasa el 80% (si se llena, Postgres deja de escribir)
30 6 * * * root cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml exec -T backend python manage.py chequear_disco

# Purgar bitácora de auditoría de más de 18 meses (crece ~110 MB/año por colegio)
0 4 1 * * root cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml exec -T backend python manage.py purgar_auditoria --meses 18 --aplicar
EOF
ok "Tareas programadas configuradas."

# ── Resumen final ──────────────────────────────────────────────────────────
echo
echo -e "${VERDE}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${VERDE}  ¡Instalación completada!${RESET}"
echo -e "${VERDE}══════════════════════════════════════════════════════════════${RESET}"
echo
echo "🌐 Sistema disponible en: $([ $HTTPS -eq 1 ] && echo "https://$DOMINIO" || echo "http://$DOMINIO")"
echo
echo "📁 Directorio de instalación:  $INSTALL_DIR"
echo "🔑 Credenciales iniciales:     $INSTALL_DIR/credenciales_seed.csv"
echo "💾 Backups automáticos:        /var/backups/sistematic/"
echo
echo "─── Comandos útiles ───"
echo
echo "  Ver logs en vivo:"
echo "    cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml logs -f backend"
echo
echo "  Actualizar a la última versión:"
echo "    cd $INSTALL_DIR && git pull && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo
echo "  Backup manual:"
echo "    sudo /etc/cron.daily/sistematic-backup"
echo
echo "  Reiniciar el sistema:"
echo "    cd $INSTALL_DIR && docker compose -f docker-compose.prod.yml restart"
echo
echo -e "${AMAR}⚠  IMPORTANTE:${RESET}"
echo "  1. Descargá el CSV con credenciales y GUARDALO en un lugar seguro."
echo "  2. BORRÁ $INSTALL_DIR/credenciales_seed.csv del servidor después de distribuir."
echo "  3. Para email real: configurá SMTP en .env.prod (EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend)"
echo
