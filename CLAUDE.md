# p_03_ie_cesar_vallejo — EduMWork Sistema TIC Escolar

Producto base de gestión TIC para instituciones educativas peruanas.  
Cliente piloto: I.E. C.N. César Vallejo de Paucarbamba (Amarilis, Huánuco) — `~/WORKFULL/clientes/ie_cesar_vallejo/`.
Grand Map: `~/WORKFULL/clientes/ie_cesar_vallejo/00_master_plan/grand_map.md`

**Estado:** cliente piloto deshardcodeado del código fuente. El sistema es ahora genérico e instalable en VPS por cliente.  
**Roadmap de instalación:** `ROADMAP_DEPLOY_CLIENTE.md`.

## Stack
Backend: Django 5 + DRF + simplejwt + PostgreSQL 16
Frontend: React 18 + Vite 5 + TypeScript 5
Auth: JWT con roles múltiples

## Modelo de usuario — 6 roles (TOGAF Fase B)
director | docente | admin_tic | padre | estudiante | ugel
- Fase 1 (demo curso): director + docente + admin_tic
- Fase 2+ (post-curso): padre + estudiante + ugel

## Comandos frecuentes

```bash
# Levantar BD + backend (dev)
docker compose up -d db backend

# Migrar BD
docker exec p03_backend python manage.py migrate

# Crear usuarios de prueba
docker exec p03_backend python manage.py seed_usuarios

# Frontend dev
cd frontend && npm run dev   # http://localhost:5173

# Build frontend
npm run build  # en ./frontend

# Tests
cd backend && pytest

# Build y release de imágenes
DOCKER_REGISTRY=docker.io IMAGE_PREFIX=edumwork VERSION=1.0.0 PUSH=true bash scripts/build-release.sh

# Generar fly.toml para un cliente
bash scripts/generar-fly-toml.sh edumwork-backend-cliente-a

# Instalar en VPS del cliente (el de la raíz es legacy y aborta)
sudo bash deploy/install_colegio.sh

# QA de instalación
bash scripts/qa_instalacion.sh
```

## Credenciales de prueba
| Usuario | Password | Rol |
|---|---|---|
| director | director2026 | Director |
| docente1 | docente2026 | Docente |
| tic1 | tic2026 | Admin TIC |
| padre1 | padre2026 | Padre |
| estudiante1 | estu2026 | Estudiante |
| ugel1 | ugel2026 | UGEL |

## Reglas
- NO modificar `~/WORKFULL/dev/p_02_automatizacion/` — solo lectura como referencia
- Estilos y patrones axios/JWT se reciclan de p_02; código de negocio no
- Español en toda la documentación
- Sin commits sin confirmación explícita
- Leer archivo antes de modificarlo

## Fase de implementación actual
- Fase 1: scaffolding + auth (tasks #6, #7) completados.
- Módulos implementados: incidencias, asistencia, inventario, visitas, auditoría, usuarios, secciones, comunicados, convivencia, notas, ambientes, aula virtual, calendario.
- Sprints de instalación completados:
  - Sprint 1: branding del cliente piloto removido del código ejecutable.
  - Sprint 2: configuración de marca (nombre, sigla, logo, email) desde la UI.
  - Sprint 3: build y release genérico con `scripts/build-release.sh` y `scripts/generar-fly-toml.sh`.
  - Sprint 4: instalador VPS con Caddy + SSL automático + backups cron.
  - Sprint 5: ~~sub-app docente personal~~ suspendida y código eliminado 2026-07-26 (planes viejos en `docs/archivo/SUBAPP_*.md`). La edición reducida vigente es `EDICION=solo_docente` en el mismo sistema institucional.
  - Sprint 6: QA de instalación y checklist de entrega.
- Próximo: validación en VPS real (según disponibilidad del usuario).
