#!/usr/bin/env bash
# Arranque del backend en producción:
#   1. Espera a que Postgres esté listo
#   2. Corre migraciones
#   3. Recolecta estáticos
#   4. Arranca gunicorn
set -euo pipefail

echo "▶ EduMWork — Sistema TIC Escolar — arranque backend"

# 1. Migraciones
echo "▶ Aplicando migraciones..."
python manage.py migrate --noinput

# 2. Estáticos
echo "▶ Recolectando archivos estáticos..."
python manage.py collectstatic --noinput

# 3. Gunicorn — 3 workers por vCPU es un buen default para Django
WORKERS="${GUNICORN_WORKERS:-3}"
TIMEOUT="${GUNICORN_TIMEOUT:-60}"
echo "▶ Arrancando gunicorn con $WORKERS workers, timeout ${TIMEOUT}s..."

exec gunicorn proyecto_api.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "$WORKERS" \
    --timeout "$TIMEOUT" \
    --preload \
    --access-logfile - \
    --error-logfile - \
    --log-level info
