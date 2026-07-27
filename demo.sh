#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# demo.sh — Modo demo: levanta EduMWork como se vería en producción
#
# Uso: bash demo.sh
#
# Qué hace:
#   1. Apaga otros stacks Docker que peleen por puertos 80/8000
#   2. Levanta el stack de producción (docker-compose.prod.yml)
#   3. Resetea axes (por si estás bloqueado de intentos previos)
#   4. Arranca ngrok si no está corriendo
#   5. Te muestra la URL pública
# ═══════════════════════════════════════════════════════════════════════════

set -e

cd "$(dirname "$0")"

VERDE="\033[0;32m"; AMARILLO="\033[1;33m"; ROJO="\033[0;31m"; CYAN="\033[0;36m"; NC="\033[0m"
ok()   { echo -e "${VERDE}✓${NC} $1"; }
info() { echo -e "${AMARILLO}→${NC} $1"; }

echo ""
echo -e "${CYAN}════════ MODO DEMO — EduMWork ════════${NC}"
echo ""

# ── 1. Apagar stacks conflictivos ────────────────────────────────────────────
info "Apagando stacks que usan puertos 80 / 8000..."
for c in gpt-researcher-gpt-researcher-1 mi-cv ntfy p03_backend p03_postgres p02_postgres; do
    docker stop "$c" >/dev/null 2>&1 && echo "    apagado: $c" || true
done

# ── 2. Levantar stack de producción local ────────────────────────────────────
info "Levantando stack de producción..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
sleep 5
ok "Contenedores arriba"

# ── 3. Reset axes ────────────────────────────────────────────────────────────
info "Reseteando bloqueos de login..."
docker exec $(docker ps --format '{{.Names}}' | grep "p_03.*db") \
    psql -U edumwork -d edumwork -c "DELETE FROM axes_accessattempt;" >/dev/null 2>&1 && \
    ok "Login desbloqueado" || echo "    (no había bloqueos)"

# ── 4. Ngrok ─────────────────────────────────────────────────────────────────
if pgrep -f "ngrok start sistematic" >/dev/null; then
    ok "ngrok ya está corriendo"
else
    info "Arrancando ngrok..."
    # Asegurar que el config apunta al puerto correcto (80)
    sed -i 's/addr: [0-9]*/addr: 80/' ~/.config/ngrok/ngrok.yml
    nohup ngrok start sistematic --config ~/.config/ngrok/ngrok.yml >/tmp/ngrok-demo.log 2>&1 &
    sleep 3
    ok "ngrok arrancado"
fi

# ── 5. Mostrar URL ───────────────────────────────────────────────────────────
sleep 2
URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | \
      python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null || echo "")

echo ""
echo -e "${VERDE}════════════════════════════════════════════════════${NC}"
if [[ -n "$URL" ]]; then
    echo -e "  ${CYAN}URL pública:${NC} $URL"
else
    echo -e "  ${AMARILLO}URL local:${NC} http://localhost"
    echo "  (ngrok no respondió, revisa /tmp/ngrok-demo.log)"
fi
echo ""
echo "  Usuarios de prueba:"
echo "    director / director2026"
echo "    docente1 / docente2026"
echo "    tic1     / tic2026"
echo -e "${VERDE}════════════════════════════════════════════════════${NC}"
echo ""
echo "  Para apagar: docker compose -f docker-compose.prod.yml down"
echo ""
