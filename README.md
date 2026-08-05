# EduMWork — Sistema TIC Escolar

App web de gestión TIC para instituciones educativas. Cada colegio se instala en su propio VPS (single-tenant) y configura su nombre, logo, módulos y roles desde la interfaz.

## Stack

| Componente | Tecnología |
|---|---|
| Backend | Django 5 + DRF 3.15 + simplejwt |
| Base de datos | PostgreSQL 16 |
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| Auth | JWT con 6 roles (TOGAF Fase B) |

## Inicio rápido

### 1. Levantar servicios

```bash
docker-compose up -d db backend
```

### 2. Migrar base de datos

```bash
docker exec -it p03_backend python manage.py migrate
```

### 3. Crear usuarios de prueba

```bash
docker exec -it p03_backend python manage.py seed_usuarios
```

### 4. Frontend

```bash
cd frontend
# Si usas Mullvad VPN:
NODE_OPTIONS='--dns-result-order=ipv4first' npm install
npm run dev
```

Abrir: http://localhost:5173

### 5. Login de prueba

Usuario: `director` / Contraseña: `director2026`

### 6. Tests

```bash
cd backend
pytest
```

## Roles del sistema

| Rol | Código | Fase |
|---|---|---|
| Director | director | 1 |
| Docente | docente | 1 |
| Administrador TIC | admin_tic | 1 |
| Padre de Familia | padre | 2 |
| Estudiante | estudiante | 2 |
| UGEL / DRE | ugel | 2 |

## Instalación en VPS de cliente

Modelo vigente: **instalación asistida**. El código no se distribuye — Mark entra
por SSH al VPS del cliente y corre el instalador, que clona este repo privado y
construye desde el fuente. Paso a paso en `docs/GUIA_INSTALACION_ASISTIDA.md`.

```bash
# En el VPS del cliente (Ubuntu 22.04+ como root), con tu token de GitHub
export TU_TOKEN="ghp_XXX"
curl -sSL -H "Authorization: token $TU_TOKEN" \
  https://raw.githubusercontent.com/etdherhwrahaerherahetar/sistema-tic-escolar/main/deploy/install_colegio.sh \
  -o install.sh
sudo bash install.sh
```

El `install_colegio.sh` de la raíz es **legacy** (bajaba imágenes de Docker Hub,
eliminadas el 2026-07-24) y aborta si lo corrés.

## Endpoints API

| Método | Ruta | Permiso |
|---|---|---|
| POST | /api/auth/login/ | Público |
| POST | /api/auth/refresh/ | Público |
| GET | /api/auth/me/ | Autenticado |
| GET | /api/usuarios/ | Director / Admin TIC |
| POST | /api/usuarios/ | Director |
| GET/PATCH | /api/usuarios/{id}/ | Autenticado |
