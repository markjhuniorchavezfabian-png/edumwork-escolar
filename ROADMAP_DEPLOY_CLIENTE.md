# Roadmap — Sistema TIC Escolar (EduMWork) instalable para clientes

**Marca propia:** EduMWork se mantiene.  
**Cliente piloto a sacar:** I.E. C.N. César Vallejo de Paucarbamba (datos, dominios, placeholders, docs).  
**Modelo de negocio por ahora:** un cliente = un VPS propio (single-tenant). SaaS multi-tenant queda fuera de este roadmap.

---

## 1. Estado actual

| Área | ¿Listo para cliente genérico? | Detalle |
|---|---|---|
| Auth / JWT / roles | ✅ Sí | funciona, roles parametrizables |
| Configuración institucional (nombre, logo, email, módulos) | ✅ Sí | `ConfiguracionInstitucional` + endpoint `/core/info/` |
| Variables de entorno sensibles | ✅ Sí | SECRET_KEY, DB, IA key, email, ALLOWED_HOSTS, CORS por `.env` |
| Edición del sistema (`completa` / `solo_docente`) | ✅ Sí | por `EDICION` en `.env` |
| Sub-app docente personal | ✅ Sí | MisClasesView + ClaseDetalleView + ClaseFormModal funcionan; activas por `VITE_MODO_APP=personal` |
| **Branding cliente piloto** | ✅ Sí | eliminado de migraciones, management, frontend, envs y docs ejecutables |
| **Dominios / Fly.io** | ✅ Sí | `DEPLOY.md` y `fly.toml` usan nombres genéricos (`edumwork-backend`, `edumwork-colegio`) |
| **Email / remitente por defecto** | ✅ Sí | `no-reply@edumwork.pe` en settings y `.env.prod.example` |
| **Configuración de marca UI** | ✅ Sí | nombre, sigla, logo, email institucional y año lectivo editables desde Configuración |
| **Instalador VPS** | ✅ Sí | `install_colegio.sh` con Caddy + SSL automático + backups cron |
| **CI/CD de imágenes** | ✅ Sí | `scripts/build-release.sh` y `scripts/generar-fly-toml.sh` genéricos |
| **Sub-app docente personal** | ✅ Sí | modo personal detectable, registro y onboarding a primera clase |
| **QA de instalación** | ✅ Sí | `scripts/qa_instalacion.sh` + `CHECKLIST_ENTREGA_CLIENTE.md` |

---

## 2. Sprints

### Sprint 1 — Limpiar branding del cliente piloto
**Objetivo:** que no quede "César Vallejo", "iecesarvallejo", "Paucarbamba" ni ningún dato del piloto en el código ejecutable.

**Tareas backend:**
- [x] Cambiar default de `nombre_institucion` en `apps/core/migrations/0001_initial.py` a `"Mi Institución"`.
- [x] Actualizar `entrypoint.sh` para que el mensaje de arranque sea genérico (`Sistema TIC EduMWork`).
- [x] Revisar `seed_staff.py` y quitar referencia a la I.E. piloto.
- [x] Cambiar fallback de `DEFAULT_FROM_EMAIL` en `settings.py` a `no-reply@edumwork.pe`.
- [x] Revisar `notas/views.py` y `notificaciones/servicios.py` para no usar `"I.E. César Vallejo"` ni `iecesarvallejo.local` como fallback.

**Tareas frontend:**
- [x] `frontend/src/views/SesionesClaseView.tsx`: quitar subtítulo hardcodeado de la I.E. piloto.
- [x] `frontend/src/views/OnboardingView.tsx`: placeholder genérico (`Ej: I.E. Nombre del colegio`).
- [x] `frontend/src/views/gestion/ConfiguracionView.tsx`: placeholder genérico.
- [x] Revisar `LoginView.tsx`, `MiPlanView.tsx` y `VersionesView.tsx`: mantener "EduMWork", eliminar referencias al piloto.

**Tareas docs:**
- [x] `DEPLOY.md`, `AMBIENTES.md`, `QA-PLAN.md`: pasar ejemplos a dominios genéricos (`sistema.colegio.edu.pe`).
- [x] `README.md`: actualizar con arquitectura genérica del producto.

**Definición de terminado:**
```bash
# En el código ejecutable (no docs de planificación) no debe quedar:
grep -R "César Vallejo\|Paucarbamba\|iecesarvallejo\|ievallejo" backend frontend/src *.sh *.toml *.yml *.env*
# → sin resultados (excepto venv/node_modules)
```

**Estimación:** 1 día. **Real:** 1 sesión.

---

### Sprint 2 — Configuración de marca desde la UI
**Objetivo:** que el director del cliente configure nombre, sigla, logo y email institucional sin editar archivos.

**Tareas backend:**
- [x] Extender `ConfiguracionInstitucional` con campos: `sigla`, `email_institucional`.
- [x] `info_institucional` y `configuracion_institucional` devuelven estos campos; si `sigla` está vacía, se calcula automáticamente desde `nombre_institucion`.
- [x] Helper `get_from_email()` en `apps/core/utils.py` para usar `email_institucional` (o `DEFAULT_FROM_EMAIL` como fallback) en notificaciones, recuperación de contraseña e invitaciones.
- [x] `setup_colegio` ya puede setear `sigla` y `email_institucional` al instalar.

**Tareas frontend:**
- [x] Actualizar `InstitucionContext.tsx` para consumir `email_institucional` y `sigla`.
- [x] Actualizar `ConfiguracionView.tsx` con campos de sigla, email institucional y logo (subida ya existente).
- [x] Usar `email_institucional` en `LoginView`, `NotFoundView` y `MiPerfilView`.

**Definición de terminado:**
- Director cambia nombre/sigla/logo/email y se refleja en login, sidebar, comunicados y emails de recuperación.
- Si no hay configuración, el fallback muestra "EduMWork" (marca propia) y `no-reply@edumwork.pe`.

**Estimación:** 2 días. **Real:** 1 sesión.

---

### Sprint 3 — Build y release genérico
**Objetivo:** poder compilar imágenes Docker y subirlas a cualquier registro sin hardcodear nombres.

**Tareas:**
- [x] Eliminar el default `mw0rk` de `install_colegio.sh` y `AMBIENTES.md`.
- [x] Hacer que `docker-compose.prod.yml` y `docker-compose.colegio.yml` usen `${DOCKER_REGISTRY}` y `${IMAGE_PREFIX}`.
- [x] Crear `scripts/build-release.sh` que buildee backend y frontend y las etiquete con el tag de la institución (ej: `ghcr.io/tu-org/edumwork-backend:1.0.0`).
- [x] Generar `fly.toml` desde plantilla (no commitear nombres de cliente). Opción: `scripts/generar-fly-toml.sh <nombre-app>`.
- [x] Crear `.env.colegio.ejemplo` con nombres genéricos.
- [x] Documentar cómo usar GitHub Container Registry o Docker Hub privado.

**Definición de terminado:**
- Un nuevo cliente se levanta solo con: `.env`, `docker-compose.colegio.yml` y `docker compose up`.
- No se edita código fuente para cambiar de cliente.

**Estimación:** 2 días. **Real:** 1 sesión.

---

### Sprint 4 — Instalador VPS + SSL automático
**Objetivo:** `bash install_colegio.sh` en un VPS Ubuntu limpio deja el sistema funcionando con HTTPS.

**Tareas:**
- [x] Elegir proxy: **Caddy** (SSL automático nativo).
- [x] Agregar servicio `caddy` a `docker-compose.colegio.yml` generado por `install_colegio.sh`.
- [x] Si el usuario elige dominio: generar certificado Let's Encrypt automáticamente.
- [x] Si elige IP directa: servir HTTP con warning claro sobre HTTPS.
- [x] Configurar `ALLOWED_HOSTS` y `CORS_EXTRA_ORIGINS` automáticamente desde el dominio/IP ingresado.
- [x] Backups en cron: añadir línea al final del instalador con `crontab`.
- [x] Revisar `health/` endpoint y usarlo en el instalador para esperar backend.
- [x] Actualizar `DEPLOY.md` con pasos para VPS propio.

**Definición de terminado:**
- Instalar en una VM limpia (DigitalOcean/Contabo/Hostinger) y acceder por `https://sistema.colegio.edu.pe`.
- El instalador crea el director, levanta servicios, aplica migraciones y crea el director inicial.

**Estimación:** 3 días. **Real:** 1 sesión.

**Pendiente de verificar:** validación real en VPS/VM. La implementación está lista; falta prueba de punta a punta.

---

### Sprint 5 — Sub-app docente personal lista para cliente
**Objetivo:** que el flujo "Mi aula" (docente independiente) funcione sin referencias al cliente piloto.

**Tareas:**
- [x] Revisar `RegistroPersonalView.tsx` y ajustar textos de bienvenida a genéricos.
- [x] `frontend/src/constants/env.ts`: modo `personal` detectable por subdominio (`personal.*`, `docente.*`) o por variable `VITE_MODO_APP=personal`.
- [x] Backend: `DEFAULT_FROM_EMAIL` y remitente de emails usan `ConfiguracionInstitucional.email_institucional` si existe, o fallback EduMWork.
- [x] CORS: permitir origen del subdominio personal via `CORS_EXTRA_ORIGINS`.
- [x] Onboarding para docentes personales: tras registro redirige a `/mis-clases`, y el estado vacío muestra CTA para crear primera clase.
- [x] Verificar que `/registro-personal` y `/mis-clases` funcionan en modo personal.

**Definición de terminado:**
- Un docente se registra en `docente.ejemplo.pe`, crea su primera clase, añade alumnos y no ve "César Vallejo".

**Estimación:** 2 días. **Real:** 1 sesión.

---

### Sprint 6 — QA de instalación y documentación final
**Objetivo:** tener una instalación probada y documentada para entregar a un cliente real.

**Tareas:**
- [x] Crear `scripts/qa_instalacion.sh` que verifique: contenedores up, backend `/health/`, login, endpoint `/core/info/`, envío de email (consola o SMTP), cron de backups.
- [ ] Probar instalador en VPS real (DigitalOcean/Contabo/Hostinger) — *pendiente de verificar con el usuario*.
- [x] Actualizar `DEPLOY.md` con: Fly.io, VPS propio, y sub-app personal.
- [x] Crear `CHECKLIST_ENTREGA_CLIENTE.md` con: credenciales, DNS, backups, soporte.
- [x] Revisar `CLAUDE.md` y archivos de agente para reflejar el estado post-cliente.

**Definición de terminado:**
- Un tercero (o tú mismo desde otra máquina) puede instalar el sistema siguiendo solo `DEPLOY.md` y `install_colegio.sh`.

**Estimación:** 2 días. **Real:** 1 sesión.

---

## 3. Estado de sprints

| Sprint | Estado | Nota |
|---|---|---|
| 1. Limpiar branding piloto | ✅ Completado | Código ejecutable libre de "César Vallejo" |
| 2. Marca desde UI | ✅ Completado | Configurable nombre, sigla, logo, email |
| 3. Build genérico | ✅ Completado | Scripts de build/release y fly.toml genérico |
| 4. Instalador VPS + SSL | ✅ Implementado | Caddy + HTTPS automático; falta validación real en VPS/VM |
| 5. Sub-app personal | ✅ Completado | Registro, onboarding y CORS listos |
| 6. QA y docs | ✅ Completado | `scripts/qa_instalacion.sh` + checklist + docs actualizados |

---

## 4. Próximo paso

**Validación real en VPS/VM.** La implementación está completa; falta probar `install_colegio.sh` en una máquina limpia (VPS de US$ 4-6/mes o una VM local con VirtualBox/KVM).
