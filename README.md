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

```bash
# En el VPS (Ubuntu 22.04+ como root)
curl -fsSL https://raw.githubusercontent.com/TU_ORG/edumwork/main/install_colegio.sh -o install_colegio.sh
bash install_colegio.sh
```

Verificación:
```bash
cd /opt/edumwork
bash scripts/qa_instalacion.sh
```

## Endpoints API

| Método | Ruta | Permiso |
|---|---|---|
| POST | /api/auth/login/ | Público |
| POST | /api/auth/refresh/ | Público |
| GET | /api/auth/me/ | Autenticado |
| GET | /api/usuarios/ | Director / Admin TIC |
| POST | /api/usuarios/ | Director |
| GET/PATCH | /api/usuarios/{id}/ | Autenticado |
