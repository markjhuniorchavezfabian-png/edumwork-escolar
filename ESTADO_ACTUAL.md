# Estado actual del proyecto (2026-07-26)

> Archivo de contexto para retomar trabajo en un chat nuevo con Claude.

---

## ⚠️ DECISIÓN 2026-07-26 — Sub-app docente SUSPENDIDA

**Estado:** paused / archivada. NO seguir tocando el mundo `apps/clases_personales/` ni `frontend/src/views/clases/` hasta rediseño.

**Motivo:** intentar meter la sub-app en el mismo repo que el sistema institucional se volvió muy complejo. Convivencia de modos (`VITE_MODO_APP=personal` vs `institucional`, `EDICION=solo_docente` vs `completa`) mezcla lógica, filtros condicionales en Sidebar/Dashboard, y modelos paralelos (`ClasePersonal` vs `Seccion`) que duplican código y hacen difícil mantener ambos productos limpios.

**Lo que quedó implementado (por si se rescata después):**
- Backend: modelos `ClasePersonal`, `AlumnoClasePersonal`, `AsistenciaClasePersonal`, `NotaClasePersonal`, `SesionClasePersonal` + migraciones aplicadas + endpoints CRUD parciales.
- Frontend: `MisClasesView`, `ClaseDetalleView` con tabs (Alumnos, Sesiones, Asistencia, Notas, Alertas, Exportar) — Alumnos/Sesiones/Alertas funcionan; Asistencia/Notas/Exportar fueron implementadas por OpenCode V3 pero no se validaron por decisión de suspender.
- Planes escritos que se pueden reutilizar como referencia: `SUBAPP_DOCENTE.md`, `SUBAPP_V2_PLAN.md`, `SUBAPP_V3_CORE_PLAN.md`.

**Plan para próxima sesión:**
- Sesión limpia (nuevo chat) — planificar sub-app docente desde cero como **producto separado**:
  - Repo propio (fork mínimo) o subproyecto claramente aislado
  - **Sin lógica condicional** por modo — la sub-app solo hace lo suyo, sin ramas `ES_MODO_PERSONAL`
  - Backend propio con solo los modelos que necesita, sin arrastrar 18 apps del institucional
  - Frontend propio sin filtros de Sidebar ni Dashboard alternativos
- **Requisito no negociable:** debe integrarse a la app institucional cuando la IE adopte el sistema (flujo "reclamar clases" con matching por nombre/DNI/código SIAGIE). Diseñar el contrato de datos ahora para que la migración sea trivial después.
- La app institucional (`EDICION=completa`) sigue siendo el producto principal y **NO debe verse afectada** por la sub-app.

**Producto principal (institucional) sigue vivo y listo para vender.** Ver secciones abajo.

---

## Objetivo actual

**Vender la licencia de Sistematic a colegios peruanos con modelo de instalación asistida.**

Modelo de negocio (actualizado 2026-07-24):
- Cliente paga **licencia + setup** una sola vez (S/300 setup, S/80/mes servicio)
- Cliente contrata su propio **VPS peruano** (SitioHost, HostPerú) y **API IA** (BYOK)
- Cliente **NO recibe código** — Mark hace la instalación por SSH al VPS del cliente
- Actualizaciones: **parches gratis**, **features mayores de pago** (control por versión)
- Docker Hub y GitHub del sistema son **privados** — nunca se distribuyen públicos

Ver flujo completo en `docs/GUIA_INSTALACION_ASISTIDA.md`.

---

## Cambios recientes (sesión 2026-07-24)

### Sesiones de aprendizaje (docente)
- Panel de sesión con IA rediseñado: plantilla siempre visible, editable, con botón "Rellenar con IA" por campo o "Sugerir tema" (chips)
- Nuevo campo **"¿Qué necesitamos hacer antes de la sesión?"** entre Desempeño y Propósito (según MINEDU Cartilla de Planificación)
- Duración auto-detectada del horario del docente (`hora_fin - hora_inicio`)
- Persistencia local (localStorage) del borrador
- Exportación: 2 botones separados **"Ver PDF"** (pestaña editable) y **"Descargar"** (dispara diálogo de impresión)
- Iconos lucide-react (Printer, Download, Clipboard, Save, Trash2)
- IA usa DeepSeek: modelos `deepseek-v4-flash` / `deepseek-v4-pro` (no `deepseek-chat` que fue deprecado)

### Backend IA
- `_SISTEMA_SESION` devuelve JSON con 9 campos: `titulo, desempeno, preparacion, proposito, inicio, desarrollo, cierre, materiales, evaluacion`
- Endpoints nuevos: `/api/ia/sugerir-temas/`, `/api/ia/completar-campo/`, `/api/ia/sesion/`

### Ediciones del sistema (NUEVO — para vender más barato a colegios chicos)
- Setting `EDICION=completa | solo_docente` desde env (default `completa`)
- `Usuario.es_administrador` (campo nuevo, migración 0012) — signal auto-marca True para director/admin_tic y para el primer docente creado en modo `solo_docente`
- Endpoint `/api/core/info/` expone `edicion`
- Login bloquea con 403 si `EDICION=solo_docente` y rol ≠ docente
- Frontend: hook `useInstitucion` extendido con `edicion` — sidebar filtra dinámicamente
- Docente admin en modo `solo_docente` ve items de administración (como si fuera director)
- Grupo "Familia" oculto en modo `solo_docente`

### Eliminado / renombrado
- **`/mi-plan` ELIMINADO** de la app real (era VPS shopping — solo para demo/landing)
- **"Costos de IA" → "Consumo de IA"** (deja claro que es tu medidor, no cobro extra)

### Docker Hub — LIMPIEZA
- Repos `mw0rk/edumwork-frontend` y `mw0rk/edumwork-backend` **ELIMINADOS** (estaban públicos = riesgo de regalar la app)
- Decisión: **NO usar Docker Hub** por ahora. Modelo asistido con SSH es más simple y seguro.

### Deploy
- `install_colegio.sh` extendido con opción 1/2 para elegir Edición Completa o Docente
- Si elige Docente: pregunta datos del primer docente admin y lo crea directo (no corre `seed_usuarios` completo)
- `.env.prod.example` documenta `EDICION=completa|solo_docente`

### Documentación
- Nueva guía `docs/GUIA_INSTALACION_ASISTIDA.md` con flujo paso-a-paso 25 min
- Memoria `sistema_tic_comercial.md` actualizada con modelo asistido + eliminación Docker Hub

### Seguridad verificada
- 0 API keys hardcodeadas en el código (grep completo limpio)
- 0 repos GitHub públicos bajo `etdherhwrahaerherahetar`
- API keys BYOK cifradas Fernet en BD (`Usuario.LLMConfig.api_key_cifrada`)
- Tests: 11/11 pasan

---

## Ediciones y precios propuestos

| Edición | Roles habilitados | Setup | Mensual | Público objetivo |
|---|---|---|---|---|
| **Completa** | director, docente, admin_tic, padre, estudiante, ugel | S/300 | S/80 | Colegios grandes (>100 alumnos) |
| **Docente** | solo docente (con `es_administrador` para el jefe) | S/200 | S/50 | Colegios chicos (unidocente / multigrado / 1-10 docentes) |

Ambas incluyen: sesiones, notas, boletas, IA (BYOK), asistencia QR, ficha estudiante.
La Docente NO incluye: incidencias TI, portal padres/estudiantes, reportes UGEL.

---

## Flujo de venta y cobro

### Cobro
- **Yape**: 988 783 411
- O transferencia BCP/Interbank con factura RUC
- Cobrar la licencia ANTES de instalar

### Servidor recomendado al cliente
1. **SitioHost.pe** (primera opción): pago en soles, Yape/transferencia, soporte español, ~S/55–70/mes con dominio incluido
2. **HostPerú** (opción económica): ~S/35/mes
3. **Hetzner** (tarjeta): CX22 ~€4/mes (el más barato)

El cliente crea la cuenta, paga, te pasa acceso SSH (IP + root, o mejor tu clave SSH pública).

### Instalación (~25 min)
```bash
ssh root@IP_DEL_COLEGIO
export TU_TOKEN="ghp_XXX"  # tu token GitHub personal
curl -sSL -H "Authorization: token $TU_TOKEN" \
  https://raw.githubusercontent.com/etdherhwrahaerherahetar/sistema-tic-escolar/main/deploy/install_colegio.sh \
  -o install.sh
sudo bash install.sh
```

El script pide: nombre corto/completo, **Edición (1/2)**, dominio, SMTP, (si Docente) datos del primer docente admin.

### Entrega
- URL del sistema (con HTTPS si hay dominio) + credenciales al director
- Director cambia contraseña en primer login (`debe_cambiar_password=True`)
- Capacitación remota con **RustDesk** (visual, gratis)

### Actualizaciones
- **Parches (gratis)**: SSH → `git pull` + rebuild (5 min)
- **Versiones mayores (pago)**: nueva rama/tag, cliente confirma pago, reinstalás

---

## Pendientes por orden de prioridad

### Bloqueantes para vender
1. **Verificar/asegurar repo `sistema-tic-escolar` PRIVADO en GitHub**
2. **Crear Personal Access Token** con permiso `repo` para usar en `install_colegio.sh`
3. **Grabar video demo con Loom** (3-4 min) — sin esto la landing no convierte
4. **Actualizar landing/COTIZADOR.md** con precios Completa vs Docente
5. **Armar lista de 10 directores** a contactar esta semana

### Para próxima sesión (marcado como PENDIENTE)
- **Sistema de actualizaciones/notificaciones dentro de la app**: cómo el cliente se entera de nueva versión disponible, banner en topbar con "Nueva versión X.Y disponible", historial de cambios visible, botón "Solicitar actualización" que abre WhatsApp con mensaje preformateado. Requiere: endpoint que consulte tu servidor con la última versión, comparación con versión instalada local (`.env.prod: VERSION_INSTALADA=1.0.0`), modal con changelog.
- **Vista de supervisión para director**: ver sesiones de todos los docentes en el colegio
- **Templates SIAGIE**: necesita 3 Excel reales (inicial, primaria, secundaria 2-5)
- **Migración Docker Hub** cuando llegue a 20+ clientes

### NO hacer
- No agregar features que no vendan (la app está funcional)
- No abrir repos GitHub al público
- No pushear a Docker Hub público
- No Vercel para backend Django
- No refactorizar a multi-tenant sin consultar

---

## Contacto y repositorio
- Mark Chávez Fabián · cmarkjhunior@gmail.com · +51 988 783 411
- GitHub: `etdherhwrahaerherahetar` (0 repos públicos verificado)
- Docker Hub: `mw0rk` (0 repos, todos eliminados)
- Proyecto: `~/WORKFULL/dev/p_03_ie_cesar_vallejo/`

---

## Cómo retomar en un chat nuevo

> "Estoy trabajando en el proyecto Sistema TIC Escolar en `~/WORKFULL/dev/p_03_ie_cesar_vallejo/`. Lee `ESTADO_ACTUAL.md` para ver dónde quedamos y `docs/GUIA_INSTALACION_ASISTIDA.md` para el modelo de venta."
