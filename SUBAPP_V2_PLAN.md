# Sub-App Docente V2 — Sesiones + Alertas Tempranas Personales

**Objetivo:** añadir dos features útiles al docente independiente:
1. **Sesiones de clase** — registrar cada sesión que dicta (fecha, tema, competencia, evidencias)
2. **Alertas tempranas** — detectar automáticamente alumnos en riesgo (asistencia baja, notas bajas)

Ambas features son "solo mundo personal" — no tocan modelos institucionales.

---

## Contexto para el implementador

- Sistema: **EduMWork** — plataforma escolar Django 5 + React 18 + PostgreSQL.
- Sub-app docente = misma BD, se activa con `VITE_MODO_APP=personal`.
- **NO tocar** el mundo institucional (`Seccion`, `Estudiante`, `Nota`, `RegistroAsistencia`).
- **SÍ trabajar** sobre modelos ya existentes: `ClasePersonal`, `AlumnoClasePersonal`, `AsistenciaClasePersonal`, `NotaClasePersonal` en `apps/clases_personales/`.
- Cada cambio va bajo `ES_MODO_PERSONAL` en frontend cuando es visible.
- Estilos: `card`, `tabla-incidencias`, `btn`, `form-input`, `page-title`. No añadir librerías.

---

## FASE 1 — Sesiones personales

### 1.1. Modelo Django (backend/apps/clases_personales/models.py)

Añadir al final del archivo:

```python
class SesionClasePersonal(models.Model):
    """Registro de una sesión de clase dictada por el docente independiente.
    No confundir con apps.aula_virtual.SesionClase (institucional)."""

    clase = models.ForeignKey(
        ClasePersonal, on_delete=models.CASCADE, related_name="sesiones"
    )
    fecha = models.DateField()
    titulo = models.CharField(max_length=200)
    competencia = models.CharField(max_length=200, blank=True)  # texto libre por ahora
    descripcion = models.TextField(blank=True)
    evidencias = models.TextField(
        blank=True,
        help_text="Notas sobre trabajos, tareas o productos entregados en esta sesión.",
    )
    creada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "clases_personales_sesion"
        ordering = ["-fecha", "-id"]
        indexes = [models.Index(fields=["clase", "-fecha"])]

    def __str__(self):
        return f"{self.clase.nombre} · {self.fecha}: {self.titulo}"
```

Crear migración: `docker exec p03_backend python manage.py makemigrations clases_personales`
Aplicar: `docker exec p03_backend python manage.py migrate`

### 1.2. Serializer (backend/apps/clases_personales/serializers.py)

Añadir:

```python
class SesionClasePersonalSerializer(serializers.ModelSerializer):
    class Meta:
        model = SesionClasePersonal
        fields = ["id", "clase", "fecha", "titulo", "competencia",
                  "descripcion", "evidencias", "creada_en"]
        read_only_fields = ["creada_en"]
```

Importar `SesionClasePersonal` al inicio.

### 1.3. ViewSet (backend/apps/clases_personales/views.py)

Añadir:

```python
class SesionClasePersonalViewSet(viewsets.ModelViewSet):
    serializer_class = SesionClasePersonalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SesionClasePersonal.objects.filter(clase__docente=self.request.user)

    def perform_create(self, serializer):
        clase = serializer.validated_data["clase"]
        if clase.docente_id != self.request.user.id:
            raise permissions.PermissionDenied("No es tu clase.")
        serializer.save()
```

Importar `SesionClasePersonal` y `SesionClasePersonalSerializer`.

### 1.4. Ruta (backend/apps/clases_personales/urls.py)

Registrar el ViewSet en el `DefaultRouter`:

```python
router.register(r"sesiones", SesionClasePersonalViewSet, basename="sesion-clase-personal")
```

Verificar que quede en `/api/clases-personales/sesiones/`.

### 1.5. Frontend — servicio (frontend/src/services/clasesPersonales.ts)

Añadir funciones `listarSesiones(claseId)`, `crearSesion(datos)`, `editarSesion(id, datos)`, `eliminarSesion(id)`.

### 1.6. Frontend — tipos (frontend/src/types/clasesPersonales.ts)

```typescript
export interface SesionClasePersonal {
  id: number;
  clase: number;
  fecha: string;         // YYYY-MM-DD
  titulo: string;
  competencia: string;
  descripcion: string;
  evidencias: string;
  creada_en: string;
}
```

### 1.7. Frontend — nueva tab "Sesiones" en ClaseDetalleView

Editar `frontend/src/views/clases/ClaseDetalleView.tsx`:
- Cambiar tipo `Tab` para incluir `"sesiones"`
- Añadir `{ id: "sesiones", label: "Sesiones" }` al array `TABS`
- Añadir `{tab === "sesiones" && <SesionesTab claseId={clase.id} />}`

### 1.8. Frontend — componente SesionesTab

Nuevo archivo `frontend/src/views/clases/SesionesTab.tsx`:
- Tabla con fecha, título, competencia, botones editar/eliminar
- Botón "Nueva sesión" abre modal
- Modal `SesionFormModal.tsx` con campos: fecha, título, competencia (texto libre), descripción, evidencias
- Estilos consistentes con AlumnosTab existente

---

## FASE 2 — Alertas tempranas personales

Sin nuevo modelo — se calcula en tiempo real desde `AsistenciaClasePersonal` y `NotaClasePersonal`.

### 2.1. Endpoint agregador (backend/apps/clases_personales/views.py)

Añadir action al `ClasePersonalViewSet`:

```python
@action(detail=True, methods=["get"], url_path="alertas")
def alertas(self, request, pk=None):
    """Alumnos en riesgo de esta clase — asistencia baja o notas bajas."""
    from datetime import date, timedelta
    from django.db.models import Count, Q
    clase = self.get_object()
    if clase.docente_id != request.user.id:
        raise permissions.PermissionDenied()

    hace_30 = date.today() - timedelta(days=30)
    resultado = []
    for alumno in clase.alumnos.filter(activo=True):
        asis = alumno.asistencias.filter(fecha__gte=hace_30)
        total = asis.count()
        ausentes = asis.filter(estado__in=["ausente", "tardanza"]).count()
        pct_asistencia = 100 - (ausentes * 100 // total) if total else 100

        notas_bajas = alumno.notas.filter(nota__in=["B", "C"]).count()

        motivos = []
        if pct_asistencia < 75:
            motivos.append(f"Asistencia {pct_asistencia}% (últimos 30 días)")
        if notas_bajas >= 2:
            motivos.append(f"{notas_bajas} notas B/C")

        if motivos:
            resultado.append({
                "alumno_id": alumno.id,
                "nombre": alumno.nombre_completo,
                "motivos": motivos,
                "nivel": "alto" if len(motivos) >= 2 else "medio",
            })

    return Response({"clase_id": clase.id, "alumnos": resultado, "total": len(resultado)})
```

Umbrales: asistencia < 75% en 30 días, o ≥ 2 notas B/C.

### 2.2. Frontend — nueva tab "Alertas" en ClaseDetalleView

- Añadir `"alertas"` al tipo `Tab`
- Añadir tab al array
- Componente `AlertasTab.tsx` que llama `GET /api/clases-personales/{id}/alertas/`
- Muestra lista de alumnos en riesgo con badge de nivel (rojo = alto, amarillo = medio)
- Empty state si no hay alertas: "Ningún alumno en riesgo, buen trabajo"

### 2.3. Widget en Dashboard personal (opcional)

En `DashboardPersonalView` (dentro de `frontend/src/views/DashboardView.tsx`):
- Consultar `GET /api/clases-personales/` y por cada clase `GET /alertas/`
- Mostrar contador total: "3 alumnos en riesgo" con link a la primera clase con alertas

---

## Testing

Al terminar cada fase:
1. `docker compose restart backend`
2. En `localhost:5174` con `juan_fix / docente2026`:
   - Fase 1: crear clase → crear sesión → editar → eliminar
   - Fase 2: crear alumno con 3 ausencias en últimos 5 días → verificar que aparece en Alertas

---

## Orden estricto

1. Backend fase 1 (modelo + migración + serializer + viewset + url)
2. Frontend fase 1 (tipos + servicio + tab + modal)
3. Test manual de fase 1
4. Backend fase 2 (action alertas)
5. Frontend fase 2 (tab alertas)
6. Test manual de fase 2
7. Widget dashboard (opcional)

**No mezclar fases** — cada una debe quedar completa y probada antes de pasar a la siguiente.

---

## Archivos que se van a tocar

**Backend (fase 1):**
- `backend/apps/clases_personales/models.py` — añadir SesionClasePersonal
- `backend/apps/clases_personales/serializers.py` — añadir serializer
- `backend/apps/clases_personales/views.py` — añadir ViewSet
- `backend/apps/clases_personales/urls.py` — registrar ruta
- Nueva migración `0002_sesionclasepersonal.py`

**Backend (fase 2):**
- `backend/apps/clases_personales/views.py` — añadir action `alertas`

**Frontend:**
- `frontend/src/types/clasesPersonales.ts` — tipo Sesion
- `frontend/src/services/clasesPersonales.ts` — 4 funciones sesiones + 1 alertas
- `frontend/src/views/clases/ClaseDetalleView.tsx` — 2 tabs nuevas
- `frontend/src/views/clases/SesionesTab.tsx` — nuevo
- `frontend/src/views/clases/SesionFormModal.tsx` — nuevo
- `frontend/src/views/clases/AlertasTab.tsx` — nuevo
- `frontend/src/views/DashboardView.tsx` — widget en DashboardPersonalView (opcional)

**NO tocar:**
- Ningún archivo institucional
- `apps/aula_virtual/`, `apps/asistencia/`, `apps/notas/`
- `Sidebar.tsx` — las tabs son internas a ClaseDetalleView, no rutas nuevas

---

## Credenciales de prueba

- Docente independiente: `juan_fix / docente2026`
- URL sub-app: `http://localhost:5174`
