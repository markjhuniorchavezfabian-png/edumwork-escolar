# Sub-App Docente Independiente — Plan de implementación

## Concepto

Sub-aplicación standalone para docentes que **no tienen una IE con sistema digital todavía**.
El docente se registra solo, gestiona sus clases con una lista de alumnos propia, y cuando
su colegio adopte EduMWork el director "reclama" sus clases y los datos se integran sin perder nada.

No es un producto separado — es el mismo backend/DB con modelos adicionales para el mundo "personal".
La distinción en frontend es `VITE_MODO_APP=personal` que activa las rutas y vistas de la sub-app.

---

## Dos modos del mismo sistema

| | Docente en IE | Docente independiente |
|---|---|---|
| Alta | Admin TIC lo agrega | Se registra solo |
| Alumnos | Modelo institucional `Estudiante` | Lista propia `AlumnoClasePersonal` |
| Secciones | `Seccion` institucional | `ClasePersonal` propia |
| Asistencia | `RegistroAsistencia` institucional | `AsistenciaClasePersonal` propia |
| Notas | `Nota` institucional | `NotaClasePersonal` propia |
| Exportar | Consolidado IE | Excel para llenar SIAGIE manual |
| Integración | — | Director reclama sus clases |

El frontend detecta si el docente tiene clases institucionales (`secciones_asignadas`) o solo clases personales,
y muestra las vistas correspondientes.

---

## Estado actual (antes de implementar)

- `VITE_MODO_APP=personal` activa la sub-app pero comparte vistas institucionales
- `/registro-personal` existe pero no crea clases personales
- El link "Crea tu cuenta docente gratis" en el login funciona pero lleva a un flujo incompleto
- La sub-app muestra vistas institucionales que requieren admin TIC para tener datos

---

## Backend — modelos nuevos

App Django: `apps/clases_personales/`

```python
# ClasePersonal — la "sección" del docente independiente
class ClasePersonal(models.Model):
    docente = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name="clases_personales")
    nombre = models.CharField(max_length=100)          # ej: "3°A 2026"
    grado = models.CharField(max_length=50)            # ej: "3ro Secundaria"
    area_principal = models.CharField(max_length=100)  # área CNEB que dicta
    anio = models.IntegerField(default=2026)
    activa = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    # Cuando la IE la reclama
    seccion_institucional = models.ForeignKey(
        "secciones.Seccion", null=True, blank=True, on_delete=models.SET_NULL
    )
    reclamada_en = models.DateTimeField(null=True, blank=True)

# AlumnoClasePersonal — lista de nombres, sin cuenta de usuario
class AlumnoClasePersonal(models.Model):
    clase = models.ForeignKey(ClasePersonal, on_delete=models.CASCADE, related_name="alumnos")
    nombre_completo = models.CharField(max_length=200)
    codigo = models.CharField(max_length=20, blank=True)  # código SIAGIE opcional
    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)

    # Cuando la IE lo reclama
    estudiante_institucional = models.ForeignKey(
        "usuarios.Estudiante", null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        ordering = ["orden", "nombre_completo"]

# AsistenciaClasePersonal
class AsistenciaClasePersonal(models.Model):
    alumno = models.ForeignKey(AlumnoClasePersonal, on_delete=models.CASCADE, related_name="asistencias")
    fecha = models.DateField()
    estado = models.CharField(max_length=20, choices=[
        ("presente", "Presente"),
        ("tardanza", "Tardanza"),
        ("ausente", "Ausente"),
        ("justificado", "Justificado"),
    ])

    class Meta:
        unique_together = ["alumno", "fecha"]

# NotaClasePersonal
class NotaClasePersonal(models.Model):
    alumno = models.ForeignKey(AlumnoClasePersonal, on_delete=models.CASCADE, related_name="notas")
    area = models.CharField(max_length=100)
    bimestre = models.IntegerField()       # 1, 2, 3, 4
    competencia = models.CharField(max_length=200, blank=True)
    nota = models.CharField(max_length=5)  # AD, A, B, C
    observacion = models.TextField(blank=True)
```

### Endpoints (ViewSets)

```
GET/POST   /api/clases-personales/                    → lista y crea clases
GET/PATCH  /api/clases-personales/{id}/               → detalle y edita clase
GET/POST   /api/clases-personales/{id}/alumnos/       → lista y añade alumnos
PATCH/DEL  /api/clases-personales/{id}/alumnos/{aid}/ → edita o elimina alumno
POST       /api/clases-personales/{id}/alumnos/bulk/  → importa lista en bulk (pega Excel)

GET/POST   /api/clases-personales/{id}/asistencia/    → asistencia del día (fecha=?)
GET        /api/clases-personales/{id}/asistencia/resumen/ → conteo mensual

GET/POST   /api/clases-personales/{id}/notas/         → notas por bimestre/área
GET        /api/clases-personales/{id}/notas/exportar/ → Excel SIAGIE

POST       /api/clases-personales/{id}/reclamar/      → director vincula clase a sección oficial
```

---

## Frontend — vistas nuevas (modo personal)

### Detección de modo (lógica en el Dashboard)

```tsx
// Si el docente tiene secciones institucionales → vistas institucionales
// Si el docente SOLO tiene clases personales → vistas personales
// Si no tiene ninguna → pantalla de bienvenida "Crea tu primera clase"
```

### Rutas nuevas en RUTAS_PERSONALES

```
/mis-clases                → lista de clases personales
/mis-clases/:id            → detalle: alumnos, asistencia, notas
/mis-clases/:id/asistencia → pasar lista de la clase personal
/mis-clases/:id/notas      → registro de notas de la clase personal
```

### Vistas

**`MisClasesView`** — lista de clases con card por cada una:
- Nombre, grado, área, cantidad de alumnos
- Botón "Nueva clase"
- Badge si está reclamada por IE

**`ClaseDetalleView`** — tabs: Alumnos | Asistencia | Notas | Exportar
- Alumnos: lista editable (nombre, código, estado activo)
- Importar lista: textarea para pegar nombres (uno por línea) o subir Excel
- Asistencia: igual al `DocenteAsistenciaView` pero sobre `AlumnoClasePersonal`
- Notas: igual al `CargarNotasView` pero sobre datos personales
- Exportar: descarga Excel compatible con SIAGIE

### Login y registro

- Login "Mi aula": si no tiene cuenta → `/registro-personal` (flujo simplificado, solo email + nombre + contraseña)
- Al registrarse: se crea usuario con `rol=docente` y `es_independiente=True`
- Primer ingreso: pantalla de bienvenida → "Crea tu primera clase"

---

## Flujo de integración cuando la IE adopta

1. Director entra al sistema institucional → sección "Reclamar clases de docentes"
2. Ve lista de docentes independientes que enseñan en su IE (los busca por nombre/email)
3. Selecciona la clase personal del docente → la vincula con una `Seccion` oficial
4. El sistema hace matching de alumnos por nombre/código SIAGIE
5. Los registros de asistencia y notas migran al modelo institucional
6. El docente ahora ve sus secciones en el modo institucional

---

## Orden de implementación

1. **Backend**: modelos + migraciones + ViewSets básicos (`ClasePersonal`, `AlumnoClasePersonal`)
2. **Backend**: endpoints asistencia personal
3. **Backend**: endpoints notas personales + exportar Excel SIAGIE
4. **Frontend**: `MisClasesView` + `ClaseDetalleView` (tab Alumnos)
5. **Frontend**: tab Asistencia (reutiliza lógica de `DocenteAsistenciaView`)
6. **Frontend**: tab Notas (reutiliza lógica de `CargarNotasView`)
7. **Frontend**: tab Exportar (Excel SIAGIE)
8. **Frontend**: ajustar Dashboard modo personal + pantalla bienvenida
9. **Backend + Frontend**: flujo de integración/reclamo

---

## Archivos clave del sistema actual

```
backend/
  apps/
    usuarios/models.py          ← modelo Usuario (rol, es_administrador)
    usuarios/views.py           ← registro personal (RegistroPersonalView)
    asistencia/models.py        ← RegistroAsistencia institucional
    notas/models.py             ← Nota institucional
    notas/views.py              ← CargarNotasViewSet (referencia para reutilizar lógica)
  proyecto_api/
    urls.py                     ← añadir path("api/clases-personales/", ...)
    settings.py                 ← CORS, INSTALLED_APPS

frontend/src/
  constants/env.ts              ← ES_MODO_PERSONAL, MODO_APP
  components/layout/Sidebar.tsx ← RUTAS_PERSONALES (añadir /mis-clases)
  views/asistencia/
    DocenteAsistenciaView.tsx   ← referencia para vista asistencia personal
  views/
    CargarNotasView.tsx         ← referencia para vista notas personal
    GestionNotasView.tsx        ← referencia para vista notas personal
```

---

## Stack y convenciones

- Backend: Django 5 + DRF + simplejwt + PostgreSQL 16
- Frontend: React 18 + Vite 5 + TypeScript 5
- Estilos: clases CSS propias (`card`, `tabla-incidencias`, `btn`, `form-input`, etc.)
- API calls: axios con interceptor JWT en `src/services/api.ts`
- Toast: `useToast()` de `components/ui/Toast`
- Estado: useState/useCallback, sin Redux
- No usar librerías nuevas sin confirmar

## Credenciales de prueba (BD actual)

| Usuario | Password | Rol |
|---|---|---|
| director | director2026 | Director |
| juan_fix | docente2026 | Docente (recién creado para pruebas) |

## Puertos locales

| Puerto | Servicio |
|---|---|
| 80 | Frontend Docker (modo institucional) |
| 5174 | Frontend dev (modo personal, activo) |
| 8000 | GPT Researcher (NO es el backend Django) |
| El backend Django está en Docker sin puerto expuesto al host — acceder vía localhost:80/api |
