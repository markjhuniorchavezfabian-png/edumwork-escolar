#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# scripts/generar-fly-toml.sh — Genera fly.toml para el backend en Fly.io.
#
# Uso:
#   bash scripts/generar-fly-toml.sh <nombre-app> [region] [memoria]
# Ejemplo:
#   bash scripts/generar-fly-toml.sh edumwork-backend-cliente-a
#
# No commitear fly.toml generado con nombres de clientes.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_NAME="${1:-}"
REGION="${2:-scl}"
MEMORY="${3:-512mb}"

if [[ -z "$APP_NAME" ]]; then
    echo "Uso: bash scripts/generar-fly-toml.sh <nombre-app> [region] [memoria]"
    echo "Ejemplo: bash scripts/generar-fly-toml.sh edumwork-backend-demo"
    exit 1
fi

cat > fly.toml <<EOF
# ═══════════════════════════════════════════════════════════════════════════
# fly.toml — generado por scripts/generar-fly-toml.sh
# NO commitear este archivo con nombres de clientes reales.
# ═══════════════════════════════════════════════════════════════════════════

app = "${APP_NAME}"
primary_region = "${REGION}"

[build]
  dockerfile = "backend/Dockerfile"

[deploy]
  release_command = "python manage.py migrate --noinput"

[env]
  PORT = "8000"
  DJANGO_SETTINGS_MODULE = "proyecto_api.settings"
  DEBUG = "False"
  GUNICORN_WORKERS = "3"

[[services]]
  protocol = "tcp"
  internal_port = 8000
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

  [[services.http_checks]]
    interval = "30s"
    grace_period = "20s"
    method = "get"
    path = "/health/"
    protocol = "http"
    timeout = "5s"

[mounts]
  source = "media_data"
  destination = "/app/media"

[[vm]]
  size = "shared-cpu-1x"
  memory = "${MEMORY}"
EOF

echo "✓ fly.toml generado para app: ${APP_NAME} (region: ${REGION}, memoria: ${MEMORY})"
