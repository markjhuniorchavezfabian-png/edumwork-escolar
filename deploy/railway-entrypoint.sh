#!/usr/bin/env bash
set -e

echo "▶ EduMWork — Sistema TIC Escolar (Railway Unified)"

cd /app/backend

# 1. Espera de base de datos y migraciones
echo "▶ Aplicando migraciones de base de datos..."
python manage.py migrate --noinput

echo "▶ Verificando parámetros institucionales..."
python - <<'EOF'
import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proyecto_api.settings")
django.setup()
from apps.core.models import ConfiguracionInstitucional
cfg = ConfiguracionInstitucional.get_solo()
nombres_piloto = {
    "thales", "colegio thales", "césar vallejo", "cesar vallejo",
    "colegio césar vallejo", "colegio cesar vallejo",
    "i.e. césar vallejo", "i.e. cesar vallejo",
}
if not cfg.nombre_institucion or cfg.nombre_institucion.strip().lower() in nombres_piloto:
    cfg.nombre_institucion = "Institución Educativa"
    cfg.sigla = "I.E."
    cfg.save()
    print("✔ Nombre institucional asegurado: Institución Educativa")
EOF

# 2. Archivos estáticos de Django
echo "▶ Recolectando archivos estáticos de Django..."
python manage.py collectstatic --noinput

# 3. Creación opcional de superusuario inicial si se definen variables
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
    echo "▶ Verificando superusuario institucional..."
    python - <<'EOF'
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "proyecto_api.settings")
django.setup()

from apps.usuarios.models import Usuario

u = os.environ.get("DJANGO_SUPERUSER_USERNAME")
p = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
e = os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@edumwork.pe")

if u and p:
    if not Usuario.objects.filter(username=u).exists():
        Usuario.objects.create_superuser(
            username=u,
            password=p,
            email=e,
            rol="director",
            first_name="Director",
            last_name="General",
        )
        print(f"✔ Superusuario {u} inicializado correctamente.")
    else:
        print(f"ℹ Superusuario {u} ya existe en la base de datos.")
EOF
fi

# 4. Configurar Nginx para el puerto asignado por Railway
PORT_HTTP="${PORT:-8080}"
echo "▶ Configurando Nginx para escuchar en puerto ${PORT_HTTP}..."
mkdir -p /etc/nginx/conf.d
export PORT="${PORT_HTTP}"
envsubst '${PORT}' < /etc/nginx/templates/railway.conf.template > /etc/nginx/conf.d/default.conf

# 5. Arrancar Gunicorn en segundo plano (localhost:8000)
WORKERS="${GUNICORN_WORKERS:-2}"
TIMEOUT="${GUNICORN_TIMEOUT:-60}"
echo "▶ Arrancando Gunicorn (${WORKERS} workers, timeout ${TIMEOUT}s en 127.0.0.1:8000)..."
gunicorn proyecto_api.wsgi:application \
    --bind "127.0.0.1:8000" \
    --workers "$WORKERS" \
    --timeout "$TIMEOUT" \
    --access-logfile - \
    --error-logfile - &
GUNICORN_PID=$!

# 6. Arrancar Nginx en primer plano
echo "▶ Arrancando Nginx en primer plano en puerto ${PORT_HTTP}..."
nginx -g "daemon off;" &
NGINX_PID=$!

trap "echo 'Apagando servicios...'; kill -TERM $GUNICORN_PID $NGINX_PID" SIGTERM SIGINT
wait -n $GUNICORN_PID $NGINX_PID
