#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# scripts/qa_instalacion.sh — Verifica una instalación de EduMWork en un VPS.
#
# Uso (desde el directorio de instalación /opt/edumwork):
#   bash scripts/qa_instalacion.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE="docker compose -f docker-compose.colegio.yml --env-file .env"
ERR=0

ok()   { echo -e "\033[0;32m✓\033[0m $1"; }
info() { echo -e "\033[1;34m→\033[0m $1"; }
err()  { echo -e "\033[0;31m✗\033[0m $1"; ERR=1; }

info "Verificando contenedores..."
if $COMPOSE ps --format json 2>/dev/null | grep -q '"running"' || $COMPOSE ps | grep -q "Up"; then
    ok "Contenedores levantados"
else
    err "No hay contenedores corriendo"
fi

info "Esperando healthcheck del backend..."
INTENTOS=0
HEALTHY=false
until $COMPOSE exec -T backend curl -sf http://localhost:8000/health/ >/dev/null 2>&1; do
    INTENTOS=$((INTENTOS+1))
    if [[ $INTENTOS -gt 30 ]]; then
        err "Backend no responde en /health/"
        break
    fi
    sleep 2
done
[[ "$HEALTHY" == "false" ]] && $COMPOSE exec -T backend curl -sf http://localhost:8000/health/ >/dev/null 2>&1 && ok "Backend healthcheck OK"

info "Verificando endpoint público /core/info/..."
URL=$(grep -E '^FRONTEND_URL=' .env | cut -d'=' -f2- || echo "http://localhost")
if command -v curl >/dev/null && curl -sf "${URL}/api/core/info/" >/dev/null 2>&1; then
    ok "API pública responde"
else
    err "No se pudo alcanzar ${URL}/api/core/info/"
fi

info "Verificando login de director..."
DIRECTOR_PASS=$(grep -E '^DIRECTOR_PASSWORD=' .env | cut -d'=' -f2-)
if $COMPOSE exec -T backend curl -sf http://localhost:8000/api/auth/login/ \
    -H "Content-Type: application/json" \
    -d '{"username":"director","password":"'"${DIRECTOR_PASS}"'"}' >/dev/null 2>&1; then
    ok "Login director funciona"
else
    err "Login director falló"
fi

info "Verificando email backend..."
BACKEND=$(grep -E '^EMAIL_BACKEND=' .env | cut -d'=' -f2-)
if [[ "$BACKEND" == *"smtp"* ]]; then
    ok "Email backend SMTP configurado"
else
    echo "    Email en modo consola (no se enviarán correos reales)"
fi

info "Verificando backup programado..."
if crontab -l 2>/dev/null | grep -q "edumwork-backup"; then
    ok "Cron de backup activo"
else
    err "No hay cron de backup"
fi

if [[ $ERR -eq 0 ]]; then
    echo ""
    ok "QA de instalación: TODO OK"
else
    echo ""
    err "QA de instalación: REVISAR ERRORES ARRIBA"
fi
exit $ERR
