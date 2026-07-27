# Deploy — EduMWork Sistema TIC Escolar

Esta guía cubre dos rutas de deploy:

- **Ruta A: Fly.io** (recomendado para empezar — con Docker nativo)
- **Ruta B: Servidor propio o VPS** (cuando la I.E. adquiera hardware)

Ambas usan **los mismos Dockerfiles** — la migración de A → B es literalmente cambiar el `docker-compose` y actualizar DNS.

---

## Preparación (una sola vez)

### 1. Instalar Docker en tu máquina local (para probar antes de deployar)

```bash
# Ubuntu
sudo apt install docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Probar el stack de producción en local

```bash
cd ~/WORKFULL/dev/p_03_ie_cesar_vallejo
cp .env.prod.example .env.prod
# Editar .env.prod y llenar SECRET_KEY, POSTGRES_PASSWORD, IA_ENCRYPTION_KEY

docker compose -f docker-compose.prod.yml --env-file .env.prod up --build
```

Abrir <http://localhost> — debería verse el frontend.

### 3. Crear el seed inicial

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_usuarios --produccion
# El comando genera credenciales_seed.csv en el contenedor. Copiar:
docker compose -f docker-compose.prod.yml cp backend:/app/credenciales_seed.csv .
# GUARDAR ESE CSV EN LUGAR SEGURO Y BORRARLO DEL SERVIDOR
```

---

## Ruta A: Deploy en Fly.io

### Paso 1 — Instalar flyctl

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth signup     # o auth login si ya tenés cuenta
```

Fly.io free tier:
- 3 VMs shared-cpu-1x con 256 MB RAM cada una (nosotros usamos 512 MB en 1 sola VM)
- 3 GB de volumen persistente
- Bandwidth ilimitado
- **Suficiente para arrancar** con hasta ~1000 usuarios ligeros.

### Paso 2 — Crear la app y la DB

```bash
cd ~/WORKFULL/dev/p_03_ie_cesar_vallejo

# Crear la app (edita fly.toml con tu nombre de app antes de este paso)
flyctl launch --no-deploy --copy-config --name edumwork-backend

# Postgres gestionado (US$ 0-5/mes free tier de Fly)
flyctl postgres create --name edumwork-db --region scl --initial-cluster-size 1
flyctl postgres attach edumwork-db --app edumwork-backend
# Esto setea la variable DATABASE_URL automáticamente

# Volumen persistente para /media
flyctl volumes create media_data --region scl --size 1 --app edumwork-backend
```

### Paso 3 — Definir secrets

```bash
# Generar valores
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))"
python3 -c "from cryptography.fernet import Fernet; print('IA_ENCRYPTION_KEY=' + Fernet.generate_key().decode())"

# Setear en Fly (nunca en fly.toml, siempre como secrets)
flyctl secrets set SECRET_KEY='...'
flyctl secrets set IA_ENCRYPTION_KEY='...'
flyctl secrets set DEFAULT_FROM_EMAIL='no-reply@edumwork.pe'
flyctl secrets set ALLOWED_HOSTS='edumwork-backend.fly.dev'
```

### Paso 4 — Deploy

```bash
flyctl deploy
flyctl logs           # ver que arrancó bien
flyctl open           # abre el navegador
```

### Paso 5 — Frontend en Cloudflare Pages (gratis)

Cloudflare Pages es **más rápido y más barato** que Fly.io para servir el frontend estático. Free tier permanente:
- Bandwidth ilimitado
- 500 builds/mes
- CDN global

```bash
cd frontend
npm install -g wrangler
wrangler pages deploy dist --project-name=edumwork-colegio
# Configurar la variable VITE_API_URL=https://edumwork-backend.fly.dev/api en el panel Cloudflare
```

O más simple: subir carpeta `dist/` desde el panel web de Cloudflare Pages.

### Paso 6 — Dominio propio (opcional)

Cuando compres `cesarvallejo.edu.pe`:

```bash
# Certificado SSL automático de Fly.io
flyctl certs create sistema.tu-colegio.edu.pe --app edumwork-backend
# Después agregar registros DNS que muestra el comando
```

---

## Ruta B: Servidor propio de la I.E.

Cuando la I.E. compre un servidor (o VPS DigitalOcean/Contabo/Hostinger).

### Paso 1 — Preparar el servidor (Ubuntu 22.04+)

```bash
ssh usuario@ip-del-servidor
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git nginx certbot python3-certbot-nginx

# Clonar el repo (con acceso deploy)
git clone https://github.com/TU_ORG/edumwork.git
cd edumwork
```

### Paso 2 — Configurar `.env.prod`

```bash
cp .env.prod.example .env.prod
nano .env.prod
# Llenar todos los valores
```

### Paso 3 — Levantar el stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml logs -f backend  # verificar arranque
```

### Paso 4 — Reverse proxy Nginx + SSL Let's Encrypt

Si querés dominio con HTTPS gratis:

```bash
sudo tee /etc/nginx/sites-available/edumwork <<'EOF'
server {
    listen 80;
    server_name sistema.tu-colegio.edu.pe;
    location / {
        proxy_pass http://localhost:80;  # o el HTTP_PORT que hayas puesto
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/edumwork /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS gratis con Let's Encrypt
sudo certbot --nginx -d sistema.tu-colegio.edu.pe
# Se auto-renueva cada 90 días
```

### Paso 5 — Backups automáticos

Ya tenés el comando `backup_db.py`. Configurar cron:

```bash
sudo crontab -e
# Backup diario 3 AM, alerta convivencia 7 AM, rotación QR
0 3 * * * cd /root/p_03_ie_cesar_vallejo && docker compose -f docker-compose.prod.yml exec -T backend python manage.py backup_db
0 7 * * * cd /root/p_03_ie_cesar_vallejo && docker compose -f docker-compose.prod.yml exec -T backend python manage.py alertar_casos_vencer
0 3 1 * * cd /root/p_03_ie_cesar_vallejo && docker compose -f docker-compose.prod.yml exec -T backend python manage.py rotar_qr_campanas
```

Los backups se guardan en `/app/backups/` dentro del contenedor (montarlo como volumen si querés que sobrevivan).

---

## Actualizar (cualquiera de las 2 rutas)

```bash
# Fly.io
git pull && flyctl deploy

# Servidor propio
git pull && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Zero-downtime: docker recrea el contenedor solo cuando el nuevo está listo (`restart: always`).

---

## Migrar de Fly.io → servidor propio (cuando llegue el momento)

**Es literalmente 1 día de trabajo:**

1. Exportar la DB de Fly:
   ```bash
   flyctl postgres connect -a edumwork-db
   # o pg_dump con conexión directa
   flyctl proxy 5432 -a edumwork-db &
   pg_dump -h localhost -U postgres edumwork > backup.sql
   ```
2. En el servidor propio, seguir Ruta B pasos 1-3.
3. Importar la DB:
   ```bash
   cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U edumwork edumwork
   ```
4. Copiar `/media` desde Fly (via `flyctl ssh sftp`).
5. Cambiar DNS al nuevo servidor.
6. Verificar y apagar Fly.io app.

Todo funciona igual porque **el mismo Dockerfile y docker-compose corren en ambos lados**.

---

## Costos estimados

| Etapa | Plataforma | Costo/mes | Cuándo |
|---|---|---|---|
| Demo / piloto | Fly.io free + Cloudflare Pages | **US$ 0** | Ahora |
| Piloto con 50 usuarios reales | Fly.io mínimo pago | **US$ 5-7** | Fase de prueba con IE |
| Producción 500-1000 usuarios | Fly.io o Contabo VPS | **US$ 6-15** | Adopción oficial |
| Migración a servidor IE | Hardware propio + hosting compartido | **S/ 30-50/mes** | Cuando UGEL/IE apruebe presupuesto |
| Dominio `.edu.pe` | Registro oficial RENIEC/RED.PE | **~S/ 130/año** | Al pasar a producción |

---

## Instalación en VPS propio (recomendado para clientes reales)

```bash
# En el VPS del cliente (Ubuntu 22.04+ como root)
curl -fsSL https://raw.githubusercontent.com/TU_ORG/edumwork/main/install_colegio.sh -o install_colegio.sh
bash install_colegio.sh
```

El instalador:
- Pregunta datos del colegio, director y dominio/IP.
- Descarga imágenes desde tu registry (`DOCKER_REGISTRY` / `IMAGE_PREFIX`).
- Levanta PostgreSQL, Redis, backend, frontend, Caddy (con SSL automático) y Watchtower.
- Configura `ALLOWED_HOSTS` y `CORS` automáticamente.
- Programa backups diarios en cron.
- Crea el usuario `director` inicial.

Verificar instalación:
```bash
cd /opt/edumwork
bash scripts/qa_instalacion.sh
```

## Sub-app personal para docentes independientes

Build del frontend en modo personal:
```bash
cd frontend
VITE_MODO_APP=personal VITE_API_URL=https://api-personal.edumwork.pe/api npm run build
```

Requisitos backend:
- `CORS_EXTRA_ORIGINS` debe incluir el dominio de la sub-app personal.
- El endpoint `/api/auth/registro-personal/` debe estar activo.
- Los emails usan `email_institucional` o `DEFAULT_FROM_EMAIL`.

## Build y release de imágenes

```bash
# Docker Hub
export DOCKER_REGISTRY=docker.io IMAGE_PREFIX=edumwork VERSION=1.0.0
PUSH=true bash scripts/build-release.sh

# GitHub Container Registry
export DOCKER_REGISTRY=ghcr.io IMAGE_PREFIX=edumwork VERSION=1.0.0
PUSH=true bash scripts/build-release.sh
```

Generar `fly.toml` para un cliente sin hardcodear:
```bash
bash scripts/generar-fly-toml.sh edumwork-backend-cliente-a
```

## Contacto y soporte

- Repositorio: `~/WORKFULL/dev/p_03_ie_cesar_vallejo/`
- Documentación técnica: `CLAUDE.md`, `README.md`, `AMBIENTES.md`
- Checklist de entrega: `CHECKLIST_ENTREGA_CLIENTE.md`
- Roadmap: `ROADMAP.md`, `ROADMAP_DEPLOY_CLIENTE.md`
