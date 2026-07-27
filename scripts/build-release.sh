#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# scripts/build-release.sh — Build de imágenes Docker para backend y frontend.
#
# Uso:
#   DOCKER_REGISTRY=ghcr.io IMAGE_PREFIX=edumwork VERSION=1.0.0 bash scripts/build-release.sh
#
# Defaults:
#   DOCKER_REGISTRY=docker.io
#   IMAGE_PREFIX=edumwork
#   VERSION=latest
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

REGISTRY="${DOCKER_REGISTRY:-docker.io}"
PREFIX="${IMAGE_PREFIX:-edumwork}"
VERSION="${VERSION:-latest}"
PUSH="${PUSH:-false}"

# Normalizar: no doble slash si registry ya incluye dominio
if [[ "$REGISTRY" != "docker.io" && ! "$REGISTRY" =~ /$ ]]; then
    REGISTRY="${REGISTRY}/"
fi

if [[ "$REGISTRY" == "docker.io" ]]; then
    BACKEND_IMAGE="${PREFIX}/edumwork-backend:${VERSION}"
    FRONTEND_IMAGE="${PREFIX}/edumwork-frontend:${VERSION}"
else
    BACKEND_IMAGE="${REGISTRY}${PREFIX}/edumwork-backend:${VERSION}"
    FRONTEND_IMAGE="${REGISTRY}${PREFIX}/edumwork-frontend:${VERSION}"
fi

echo "▶ Registro:  ${REGISTRY:-docker.io}"
echo "▶ Prefijo:   ${PREFIX}"
echo "▶ Versión:   ${VERSION}"
echo "▶ Backend:   ${BACKEND_IMAGE}"
echo "▶ Frontend:  ${FRONTEND_IMAGE}"

info() { echo -e "\033[1;34m→\033[0m $1"; }
ok()   { echo -e "\033[1;32m✓\033[0m $1"; }

info "Build backend..."
docker build -t "${BACKEND_IMAGE}" ./backend
ok "Backend image built: ${BACKEND_IMAGE}"

info "Build frontend..."
docker build -t "${FRONTEND_IMAGE}" ./frontend
ok "Frontend image built: ${FRONTEND_IMAGE}"

if [[ "$PUSH" == "true" ]]; then
    info "Push images..."
    docker push "${BACKEND_IMAGE}"
    docker push "${FRONTEND_IMAGE}"
    ok "Images pushed"
else
    echo ""
    echo "PUSH no está activado. Para subir: PUSH=true bash scripts/build-release.sh"
fi
