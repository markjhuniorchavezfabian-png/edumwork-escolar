# QA Plan — EduMWork Sistema TIC Escolar

Playbook para probar toda la app **gastando pocos tokens**.
Diseño: Opus define, Sonnet (o Haiku) ejecuta.

---

## 0. Regla de oro para no gastar en vano

**Antes de cualquier sesión de QA:**

1. Levantar el stack UNA vez y dejarlo corriendo (`docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`)
2. Correr **seed** UNA vez para tener datos consistentes: `docker exec edumwork-backend-1 python manage.py seed_usuarios`
3. Guardar los tokens JWT de cada rol en variables (evita hacer login 20 veces)
4. Correr los flujos en batch y **anotar bugs, no arreglarlos** — arreglos van al final, en una sola sesión
5. Cerrar sesión al terminar (para no dejar contexto colgado)

**NO usar QA para descubrir features nuevos.** Este plan solo verifica lo existente.

---

## 1. División de trabajo por modelo (clave para ahorrar)

| Tarea | Modelo | Por qué |
|---|---|---|
| Ejecutar flujo scripted (login, crear, verificar) | **Sonnet/Haiku** | Mecánico, seguí instrucciones exactas |
| Llenar formularios y validar respuestas HTTP | **Sonnet/Haiku** | Solo comparar códigos y strings |
| Correr smoke tests (endpoints responden) | **Haiku** | Trivial: curl + status code |
| Comparar UI antes/después con screenshot | **Sonnet** con browser MCP | Ojos + verificación mecánica |
| Reportar bugs siguiendo un template | **Sonnet** | Template fijo, solo llenar |
| Detectar bugs obvios (error 500, botón roto) | **Sonnet** | Reconocimiento de patrones |
| Diseñar escenarios de edge cases | **Opus** (esta sesión) | Requiere pensar como atacante |
| Analizar bug raro sin causa clara | **Opus** cuando se atore Sonnet | Root cause analysis |
| Evaluar UX subjetivamente | **Opus** al final del QA | Juicio de valor |
| Priorizar bugs (¿bloquea launch?) | **Opus** al final | Juicio estratégico |
| Refactor de arquitectura | **Opus** | Diseño |

**Flujo recomendado:** Opus diseña este plan → Sonnet ejecuta secciones 3-5 → Opus revisa reporte final y decide qué arreglar.

---

## 2. Setup previo (una vez, ~10 min)

### 2.1 Verificar stack arriba

```bash
docker ps --format "{{.Names}} {{.Status}}" | grep edumwork
# Esperado: backend healthy, frontend up, db healthy
curl -s http://localhost:8095/api/health/  # → {"status": "ok"}
```

### 2.2 Obtener tokens JWT (guardar como variables de sesión)

```bash
# Director
TK_DIR=$(curl -s -X POST http://localhost:8095/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"director","password":"director2026"}' | jq -r .access)

# Docente
TK_DOC=$(curl -s -X POST http://localhost:8095/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"docente1","password":"docente2026"}' | jq -r .access)

# Admin TIC
TK_TIC=$(curl -s -X POST http://localhost:8095/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"tic1","password":"tic2026"}' | jq -r .access)

# Verificar
for T in $TK_DIR $TK_DOC $TK_TIC; do
  curl -s http://localhost:8095/api/auth/me/ -H "Authorization: Bearer $T" | jq -c '{username,rol}'
done
```

Si algún token falla → **STOP**, arreglar auth antes de continuar.

---

## 3. Suites de test (ejecutable por Sonnet)

Cada suite es una lista de pasos con:
- Comando exacto
- Resultado esperado
- Qué anotar si falla

### Suite A — Auth y sesión (smoke, 5 min)

| # | Paso | Esperado | Si falla |
|---|---|---|---|
| A1 | `POST /api/auth/login/` con credenciales válidas | HTTP 200 + `access` + `refresh` | Bug crítico |
| A2 | `POST /api/auth/login/` con password mal | HTTP 401 | Anota si devuelve otra cosa |
| A3 | `GET /api/auth/me/` con token válido | HTTP 200 + user | Bug crítico |
| A4 | `GET /api/auth/me/` sin token | HTTP 401 | Anota si es otra cosa |
| A5 | `POST /api/auth/refresh/` con refresh válido | HTTP 200 + nuevo access | Anota |
| A6 | 5 logins mal seguidos → verificar axes lock | HTTP 403 después del 5° | Confirma que anti-bruteforce funciona |

### Suite B — Multi-tenancy (crítica, 15 min)

Prueba que docente personal no ve datos de otros.

| # | Paso | Esperado |
|---|---|---|
| B1 | Signup personal: `POST /api/auth/registro-personal/` con `{username:test_juan, password:Juan2026!, first_name:Juan, last_name:P, email:juan@t.com}` | HTTP 201 + access token |
| B2 | Con TK_JUAN: crear Seccion `POST /api/usuarios/secciones/ {nombre:5A, grado:5to, letra:A}` | HTTP 201, tiene `owner=juan_id` |
| B3 | Signup otro personal: `test_maria` con password `Maria2026!` | HTTP 201 |
| B4 | Con TK_MARIA: `GET /api/usuarios/secciones/` | Lista vacía (NO ve la sección de Juan) — **CRÍTICO** |
| B5 | Con TK_JUAN: `GET /api/usuarios/secciones/` | Ve solo su sección |
| B6 | Con TK_DIR (institucional): `GET /api/usuarios/secciones/` | Ve TODAS las secciones (incluidas las de Juan y María) |

**Si B4 falla → data leak grave, marcar como BLOQUEANTE.**

### Suite C — Integración docente ↔ IE (10 min)

| # | Paso | Esperado |
|---|---|---|
| C1 | Con TK_DIR: `POST /api/auth/invitar-docente/ {email:juan@t.com}` | HTTP 201 + token de invitación |
| C2 | `GET /api/auth/invitacion/<token>/` | HTTP 200, `valida:true`, `existe_cuenta_previa:true` |
| C3 | Con TK_JUAN: `POST /api/auth/aceptar-invitacion/ {token:<token>}` | HTTP 200, mensaje "cuenta personal ahora es parte del colegio" |
| C4 | `GET /api/auth/mi-cuenta/` con Juan | `modo_cuenta:institucional`, `integrado_a_ie_en:<fecha>` |
| C5 | Con TK_JUAN post-integración: `GET /api/usuarios/secciones/` | Ve la sección que creó + las de la IE |
| C6 | Con TK_DIR: `GET /api/auth/invitaciones/` | Ve la invitación como `aceptada` |

### Suite D — SIAGIE (con templates simulados, listo para correr)

**Templates disponibles en** `backend/tests/fixtures/siagie/`:
- `template_secundaria_5to.xlsx` (sin conclusiones, 4 competencias)
- `template_primaria_5to.xlsx` (con conclusiones, 3 competencias)
- `template_inicial_5anios.xlsx` (con conclusiones, 2 competencias)

Cada uno tiene 5 alumnos con DNIs falsos (72345678, 73456789, etc.) y columnas vacías.

| # | Paso | Esperado |
|---|---|---|
| D1 | `POST /api/notas/siagie/analizar/` sin archivo | HTTP 400 |
| D2 | Analizar `template_secundaria_5to.xlsx` | HTTP 200, `nivel:secundaria`, `metodo:cache` (2ª+ vez) o `heuristica` (1ª) |
| D3 | Analizar los 3 templates → cada uno con hash único | 3 registros distintos en `SiagieMapeo` |
| D4 | Preview con bimestre=1 y sección de test | HTTP 200 + conteos (probablemente 0 se rellenarán, no hay notas para esos DNIs) |
| D5 | Rellenar y descargar | HTTP 200 + blob Excel |
| D6 | Verificar `SiagieRellenoLog` en admin | Registros con acción `analizar`, `preview`, `rellenar` |
| D7 | Verificar el bug de patrones heurísticos (ver SUG-04) | Documentar cuántas columnas se mapean por template |

**Modo "beta" del feature:** cuando un colegio real lo use por primera vez, mostrar un aviso en la UI:
> ⚠️ Feature en beta. Verifica el resultado antes de subir a SIAGIE.
> Si el mapeo detectado no es correcto, edítalo manualmente (icono ✏️) o re-analiza (↻).

### Suite E — Frontend visual (con browser MCP)

**Usar `browsermcp` (ya instalado)** que abre Chromium con la cuenta del usuario.
Alternativa si no disponible: `playwright` requiere `sudo apt install chromium-browser`.

| # | Ruta | Chequeos |
|---|---|---|
| E1 | `/login` (institucional) | Ver "Bienvenido/a", campos usuario+password, link "Recuperar código" |
| E2 | `/login` (VITE_MODO_APP=personal) | Ver "Tu registro de notas...", link "Crea tu cuenta gratis" |
| E3 | Login como director → `/` | Dashboard carga, sidebar muestra grupos Académico/Administración |
| E4 | Sidebar → click cada item | Cada ruta carga sin error blank/red |
| E5 | `/invitar-docente` | Header, botón "Nueva invitación", tabla vacía o con invitaciones |
| E6 | Enviar invitación → verificar en lista | Aparece con estado "Pendiente", botón copiar link |
| E7 | Abrir link invitación en incógnito | Carga `AceptarInvitacionView`, formulario apropiado |
| E8 | `/mi-perfil` como docente | Ve Card "Mi cuenta y datos" si modo=personal |
| E9 | Cambiar contraseña propia | Toast OK, próximo login con nueva funciona |
| E10 | Cargar notas → grilla | Estudiantes filtrados sin trasladados/retirados |

### Suite F — Roles y permisos (10 min)

| # | Con | Endpoint | Esperado |
|---|---|---|---|
| F1 | TK_DOC | `POST /api/auth/invitar-docente/` | HTTP 403 (solo director/tic) |
| F2 | TK_TIC | `POST /api/notas/siagie/rellenar/` | Depende de ROLES_PUEDEN_CARGAR |
| F3 | TK_DOC | `GET /api/notas/siagie/mapeos/` | Lo que permite el rol |
| F4 | TK_DOC | `PATCH /api/notas/siagie/mapeos/<hash>/` | HTTP 403 (solo director/subdirector/admin_tic) |
| F5 | Sin token | `GET /api/auth/mi-backup/` | HTTP 401 |

---

## 4. Repositorio de sugerencias UX (llenar durante QA, NO implementar)

Formato por sugerencia:

```
### [SUG-NN] Título corto
- **Vista:** /ruta
- **Actual:** qué hace hoy
- **Sugerencia:** qué mejoraría
- **Prioridad:** alta / media / baja
- **Esfuerzo:** trivial / medio / grande
```

**Ejemplos ya observados durante desarrollo (ya identificados por Opus):**

### [SUG-01] Sidebar: agrupar rutas de gestión IE vs personal
- **Vista:** Sidebar
- **Actual:** "Invitar docentes" cuelga de grupo Administración con muchos items
- **Sugerencia:** Nueva sección "Docentes" con: Asignaciones, Invitar/integrar, Fichas docentes
- **Prioridad:** media
- **Esfuerzo:** trivial

### [SUG-02] Login modo personal: hero muestra sigla IE genérica
- **Vista:** /login con VITE_MODO_APP=personal
- **Actual:** Muestra `institucion.sigla` como logo por defecto (queda "IE")
- **Sugerencia:** En modo personal usar icono School neutro
- **Prioridad:** baja
- **Esfuerzo:** trivial

### [SUG-03] MiPerfilView: ordenar tarjetas por importancia
- **Vista:** /mi-perfil
- **Actual:** Datos personales, cambiar password, mi cuenta, consentimiento — orden algo arbitrario
- **Sugerencia:** 1) Mi cuenta (info) 2) Cambiar password 3) Backup 4) Consentimiento
- **Prioridad:** baja
- **Esfuerzo:** trivial

### [SUG-04] Reader SIAGIE: patrones heurísticos débiles (BUG confirmado)
- **Vista:** backend, `siagie_reader.py:PATRONES_HEURISTICA`
- **Actual:** No mapea columnas con nombres SIAGIE reales:
  - "Competencia 01 - NL" → NO detecta como `nota_nl_1` (regex actual `r"^nl$"` es muy estricto)
  - "Apellidos y Nombres" → NO detecta como `nombres` (regex `r"^nombre"` empieza-con)
  - "Nº" → NO detecta como `orden` (regex `r"^n[°º]?\s*$"` no matchea "N")
- **Sugerencia:** ampliar patrones:
  ```python
  "orden":     [r"^n[°º]?\.?\s*$", r"^ord", r"^item"],
  "apellidos": [r"apellido", r"apellidos.*y.*nombres"],
  "nombres":   [r"\bnombre", r"apellidos.*y.*nombres"],
  "nota_nl":   [r"^nl$", r"nivel\s*log", r"calificac", r"competencia.*nl", r"comp.*\d+.*nl"],
  "conclusion":[r"conclus", r"descripci[oó]n", r"competencia.*conclus"],
  ```
- **Prioridad:** ALTA — sin esto, la heurística casi no funciona
- **Esfuerzo:** trivial (10 líneas)
- **Descubierto en:** smoke test con `template_secundaria_5to.xlsx` — solo mapeó 4 de 9 columnas

### [SUG-05] Detección de "Apellidos y Nombres" como columna unificada
- **Vista:** backend `siagie_reader.py`
- **Actual:** SIAGIE típico tiene UNA columna "Apellidos y Nombres" (combinado), no dos separadas
- **Sugerencia:** agregar campo `nombre_completo` al mapeo, y en `_notas_por_dni` armar apellidos+nombres = nombre_completo si no hay campos separados
- **Prioridad:** media
- **Esfuerzo:** medio

---

## 5. Reporte final (al terminar QA)

Sonnet genera un archivo `QA-REPORT-YYYYMMDD.md` con:

```markdown
# QA Report — {{fecha}}

## Resumen
- Suites corridas: N/6
- Tests pasados: X/Y
- Bugs encontrados: N (X bloqueantes, Y menores)
- Sugerencias UX capturadas: N

## Bugs bloqueantes
### [BUG-01] {{título}}
- **Suite:** X.NN
- **Reproducción:** pasos exactos
- **Esperado vs Actual:**
- **Impacto:**

## Bugs menores
...

## Sugerencias capturadas
...

## Suites no ejecutadas
- Suite D: falta template SIAGIE real
- Suite E parcial: falta Chrome instalado
```

## 6. Triage post-QA (requiere Opus)

Al recibir el reporte, Opus:

1. Prioriza bugs por (impacto × frecuencia × esfuerzo de fix)
2. Descarta sugerencias UX de baja prioridad
3. Propone plan de fixes en 1 sesión (por batch, no uno por uno)
4. Marca lo que necesita rebuild vs solo restart

---

## 7. Cómo lanzar QA con Sonnet (copia-pega)

**Prompt para agente Sonnet:**

```
Ejecuta el QA-PLAN.md del proyecto en /home/mark/WORKFULL/dev/p_03_ie_cesar_vallejo/.

Instrucciones:
1. Lee todo QA-PLAN.md primero
2. Ejecuta las secciones 2 (setup) y 3 (suites A-F en orden)
3. Anota TODO bug o desviación en formato del reporte (sección 5)
4. NO arregles nada, solo reporta
5. Si un test necesita input externo (ej: archivo SIAGIE) marca como "pendiente" y sigue
6. Al terminar, escribe QA-REPORT-<fecha>.md en el proyecto

No hagas exploración fuera de lo que el plan pide. Solo ejecuta y reporta.
```

Este prompt hace que Sonnet no gaste en explorar de más.

---

## Notas de mantenimiento

- Este plan se actualiza cuando se agregan features nuevos
- Suites A, B, F son las **críticas** — no se pueden saltar antes de deploy
- Suites C, D, E se pueden saltar en QA rápido
- Sugerencias en sección 4 se acumulan hasta que valga la pena una sesión "UX polish"
