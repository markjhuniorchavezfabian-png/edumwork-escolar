# Sub-App Docente V3 — Completar el CORE (asistencia + notas + exportar)

**Estado actual (bug):** las tabs "Asistencia", "Notas" y "Exportar" del detalle de clase (`/mis-clases/:id`) son placeholders vacíos (`EmptyState` con texto "estará disponible en el siguiente paso"). Los modelos backend `AsistenciaClasePersonal` y `NotaClasePersonal` existen, las migraciones están aplicadas, pero NO hay endpoints y NO hay UI.

**Objetivo de V3:** completar el CORE de la sub-app para que un docente independiente pueda:
1. Pasar lista diaria de sus alumnos
2. Registrar notas por bimestre y competencia
3. Exportar Excel compatible con SIAGIE

Después de V3, la sub-app queda **lista para vender** — cubre 100% del flujo diario del docente.

---

## Reglas del implementador

- **NO tocar** nada del mundo institucional: `apps/asistencia/`, `apps/notas/`, `apps/usuarios/`, `Seccion`, `Estudiante`, `RegistroAsistencia`, `Nota`, ni ninguna vista institucional del frontend.
- **SÍ tocar** exclusivamente `apps/clases_personales/` (backend) y `frontend/src/views/clases/` (frontend).
- Estilos: `card`, `tabla-incidencias`, `btn`, `form-input`, `page-title`. **No añadir librerías**.
- Toast: `useToast()` de `components/ui/Toast`.
- Confirm: `useConfirm()` de `components/ui/Confirm`.
- API calls: `services/api.ts` (axios con JWT interceptor).
- Referencia visual: mirar cómo se ve `TabAlumnos` dentro de `ClaseDetalleView.tsx` — mismo estilo.

---

## Referencias del mundo institucional (SOLO PARA LEER, no copiar código directo)

Para inspirarse en la lógica y UX (pero adaptándola a los modelos personales):

- `frontend/src/views/asistencia/DocenteAsistenciaView.tsx` → cómo se pinta el grid de pasar lista
- `frontend/src/views/CargarNotasView.tsx` → cómo se pinta el grid de notas por bimestre
- `backend/apps/asistencia/views.py` → endpoints institucionales de asistencia (referencia lógica)
- `backend/apps/notas/views.py` → endpoints institucionales de notas (referencia lógica)

**NO importar código de esos archivos**. Solo mirar para entender el patrón.

---

## FASE 1 — Asistencia personal (pasar lista)

### 1.1. Backend: action `asistencia` en `ClasePersonalViewSet`

Archivo: `backend/apps/clases_personales/views.py`

Agregar dentro del `ClasePersonalViewSet` (antes del final):

```python
@action(detail=True, methods=["get", "post"], url_path="asistencia")
def asistencia(self, request, pk=None):
    """
    GET  ?fecha=YYYY-MM-DD → lista asistencia del día (o today si no viene fecha)
    POST body: {"fecha": "YYYY-MM-DD", "registros": [{"alumno_id": 1, "estado": "presente"}, ...]}
    """
    from datetime import date as _date
    from .models import AsistenciaClasePersonal
    from .serializers import AsistenciaClasePersonalSerializer

    clase = self.get_object()

    if request.method == "GET":
        fecha_str = request.query_params.get("fecha") or _date.today().isoformat()
        registros = AsistenciaClasePersonal.objects.filter(
            alumno__clase=clase, fecha=fecha_str
        ).select_related("alumno")
        # Devolver también alumnos sin registro aún (para armar el grid completo)
        alumnos = clase.alumnos.filter(activo=True).order_by("orden", "nombre_completo")
        map_registros = {r.alumno_id: r.estado for r in registros}
        data = [
            {
                "alumno_id": a.id,
                "nombre_completo": a.nombre_completo,
                "estado": map_registros.get(a.id, ""),
            }
            for a in alumnos
        ]
        return Response({"fecha": fecha_str, "alumnos": data})

    # POST
    fecha = request.data.get("fecha") or _date.today().isoformat()
    registros = request.data.get("registros", [])
    if not isinstance(registros, list):
        return Response({"detail": "registros debe ser lista"}, status=400)

    ids_alumnos_clase = set(clase.alumnos.values_list("id", flat=True))
    for r in registros:
        alumno_id = r.get("alumno_id")
        estado = r.get("estado")
        if alumno_id not in ids_alumnos_clase:
            continue
        if estado not in ("presente", "tardanza", "ausente", "justificado"):
            continue
        AsistenciaClasePersonal.objects.update_or_create(
            alumno_id=alumno_id, fecha=fecha,
            defaults={"estado": estado},
        )
    return Response({"guardados": len(registros), "fecha": fecha})


@action(detail=True, methods=["get"], url_path="asistencia/resumen")
def asistencia_resumen(self, request, pk=None):
    """Resumen mensual por alumno: presentes/ausentes/tardanzas del mes indicado.
    ?anio=2026&mes=6"""
    from datetime import date as _date
    from django.db.models import Count, Q
    from .models import AsistenciaClasePersonal

    clase = self.get_object()
    anio = int(request.query_params.get("anio") or _date.today().year)
    mes = int(request.query_params.get("mes") or _date.today().month)

    resumen = []
    for alumno in clase.alumnos.filter(activo=True).order_by("orden"):
        agg = AsistenciaClasePersonal.objects.filter(
            alumno=alumno, fecha__year=anio, fecha__month=mes,
        ).aggregate(
            presente=Count("id", filter=Q(estado="presente")),
            tardanza=Count("id", filter=Q(estado="tardanza")),
            ausente=Count("id", filter=Q(estado="ausente")),
            justificado=Count("id", filter=Q(estado="justificado")),
        )
        resumen.append({
            "alumno_id": alumno.id,
            "nombre": alumno.nombre_completo,
            **agg,
        })
    return Response({"anio": anio, "mes": mes, "alumnos": resumen})
```

### 1.2. Backend: serializer `AsistenciaClasePersonalSerializer`

Archivo: `backend/apps/clases_personales/serializers.py`

Agregar:
```python
class AsistenciaClasePersonalSerializer(serializers.ModelSerializer):
    class Meta:
        model = AsistenciaClasePersonal
        fields = ["id", "alumno", "fecha", "estado"]
```

Importar `AsistenciaClasePersonal` al inicio del archivo.

### 1.3. Frontend: tipos

Archivo: `frontend/src/types/clasesPersonales.ts`

Agregar:
```typescript
export type EstadoAsistenciaClase = "" | "presente" | "tardanza" | "ausente" | "justificado";

export interface AsistenciaDiaAlumno {
  alumno_id: number;
  nombre_completo: string;
  estado: EstadoAsistenciaClase;
}

export interface AsistenciaDiaResponse {
  fecha: string;
  alumnos: AsistenciaDiaAlumno[];
}
```

### 1.4. Frontend: servicio

Archivo: `frontend/src/services/clasesPersonales.ts`

Agregar:
```typescript
export async function obtenerAsistenciaDia(claseId: number, fecha: string): Promise<AsistenciaDiaResponse> {
  const { data } = await api.get(`/clases-personales/${claseId}/asistencia/?fecha=${fecha}`);
  return data;
}

export async function guardarAsistenciaDia(
  claseId: number,
  fecha: string,
  registros: { alumno_id: number; estado: EstadoAsistenciaClase }[],
): Promise<void> {
  await api.post(`/clases-personales/${claseId}/asistencia/`, { fecha, registros });
}
```

### 1.5. Frontend: componente `AsistenciaTab`

Archivo nuevo: `frontend/src/views/clases/AsistenciaTab.tsx`

Estructura:
- Selector de fecha (input type="date", default = hoy)
- Botones "Todos presentes" · "Todos ausentes" · "Limpiar día"
- Tabla:
  - Columna 1: nombre alumno
  - Columna 2: 4 botones toggle (Presente / Tardanza / Ausente / Justificado) que resaltan el activo
  - Alternativa mobile: dropdown con los 4 estados
- Botón "Guardar" abajo — deshabilitado si no hay cambios
- Toast de éxito al guardar

Comportamiento:
- Al montar y al cambiar fecha → `obtenerAsistenciaDia`
- Estado local: `Map<alumno_id, estado>` con lo cargado
- Al hacer click en un estado → actualiza el Map y marca "dirty"
- Al guardar → `guardarAsistenciaDia` con solo los cambios

### 1.6. Frontend: reemplazar EmptyState en `ClaseDetalleView`

En `frontend/src/views/clases/ClaseDetalleView.tsx`:
- Importar `AsistenciaTab`
- Reemplazar el bloque de la tab asistencia:

```tsx
{tab === "asistencia" && <AsistenciaTab claseId={clase.id} />}
```

### 1.7. Verificación fase 1

```bash
docker compose restart backend
# En navegador (localhost:5174), login juan_fix / docente2026
# Ir a Mis clases → alguna clase con alumnos → tab Asistencia
# Cambiar estados, guardar, refrescar la página → deben persistir
# Comprobar con curl:
curl -H "Authorization: Bearer XXX" \
  "http://localhost/api/clases-personales/6/asistencia/?fecha=2026-07-26"
```

---

## FASE 2 — Notas personales

### 2.1. Backend: action `notas` en `ClasePersonalViewSet`

```python
@action(detail=True, methods=["get", "post"], url_path="notas")
def notas(self, request, pk=None):
    """
    GET  ?bimestre=1&area=Matemática → lista notas del bimestre y área para todos los alumnos
    POST body: {"bimestre": 1, "area": "Matemática", "registros": [
      {"alumno_id": 1, "competencia": "Resuelve problemas", "nota": "A", "observacion": ""},
      ...
    ]}
    """
    from .models import NotaClasePersonal
    from .serializers import NotaClasePersonalSerializer

    clase = self.get_object()

    if request.method == "GET":
        bimestre = int(request.query_params.get("bimestre") or 1)
        area = request.query_params.get("area") or clase.area_principal
        notas = NotaClasePersonal.objects.filter(
            alumno__clase=clase, bimestre=bimestre, area=area,
        )
        alumnos = clase.alumnos.filter(activo=True).order_by("orden")
        # Devolver todos los alumnos con su nota (o vacía)
        map_notas = {n.alumno_id: n for n in notas}
        data = []
        for a in alumnos:
            n = map_notas.get(a.id)
            data.append({
                "alumno_id": a.id,
                "nombre_completo": a.nombre_completo,
                "competencia": n.competencia if n else "",
                "nota": n.nota if n else "",
                "observacion": n.observacion if n else "",
            })
        return Response({
            "bimestre": bimestre, "area": area,
            "alumnos": data,
        })

    # POST
    bimestre = request.data.get("bimestre")
    area = request.data.get("area", "").strip()
    registros = request.data.get("registros", [])
    if not bimestre or not area or not isinstance(registros, list):
        return Response({"detail": "faltan bimestre/area/registros"}, status=400)

    ids_alumnos_clase = set(clase.alumnos.values_list("id", flat=True))
    guardados = 0
    for r in registros:
        alumno_id = r.get("alumno_id")
        if alumno_id not in ids_alumnos_clase:
            continue
        nota_val = (r.get("nota") or "").strip().upper()
        if nota_val and nota_val not in ("AD", "A", "B", "C"):
            continue
        # Si nota vacía → borra registro
        if not nota_val:
            NotaClasePersonal.objects.filter(
                alumno_id=alumno_id, bimestre=bimestre, area=area,
            ).delete()
            continue
        NotaClasePersonal.objects.update_or_create(
            alumno_id=alumno_id, bimestre=bimestre, area=area,
            defaults={
                "competencia": (r.get("competencia") or "").strip(),
                "nota": nota_val,
                "observacion": (r.get("observacion") or "").strip(),
            },
        )
        guardados += 1
    return Response({"guardados": guardados, "bimestre": bimestre, "area": area})
```

### 2.2. Backend: serializer `NotaClasePersonalSerializer`

Agregar en `serializers.py`:
```python
class NotaClasePersonalSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotaClasePersonal
        fields = ["id", "alumno", "area", "bimestre", "competencia", "nota", "observacion"]
```

Importar `NotaClasePersonal`.

### 2.3. Frontend: tipos + servicio

Tipos:
```typescript
export type CalificacionCNEB = "" | "AD" | "A" | "B" | "C";

export interface NotaAlumnoBimestre {
  alumno_id: number;
  nombre_completo: string;
  competencia: string;
  nota: CalificacionCNEB;
  observacion: string;
}

export interface NotasBimestreResponse {
  bimestre: number;
  area: string;
  alumnos: NotaAlumnoBimestre[];
}
```

Servicio:
```typescript
export async function obtenerNotasBimestre(claseId: number, bimestre: number, area: string): Promise<NotasBimestreResponse> {
  const { data } = await api.get(`/clases-personales/${claseId}/notas/`, {
    params: { bimestre, area },
  });
  return data;
}

export async function guardarNotasBimestre(
  claseId: number, bimestre: number, area: string,
  registros: Omit<NotaAlumnoBimestre, "nombre_completo">[],
): Promise<void> {
  await api.post(`/clases-personales/${claseId}/notas/`, { bimestre, area, registros });
}
```

### 2.4. Frontend: componente `NotasTab`

Archivo nuevo: `frontend/src/views/clases/NotasTab.tsx`

Estructura:
- Cabecera con dos selectores:
  - Bimestre: 1 / 2 / 3 / 4
  - Área: dropdown desde `AREAS_POR_NIVEL[nivel de la clase]` (usar `inferirNivelDesdeGrado(clase.grado)`)
- Tabla:
  - Columna 1: nombre alumno
  - Columna 2: input de competencia (opcional, texto libre) — puede colapsarse
  - Columna 3: dropdown de nota (AD/A/B/C/vacío)
  - Columna 4: observación (opcional, textarea corto)
- Botón "Guardar notas" abajo con conteo de cambios
- Toast al guardar

Comportamiento:
- Al cambiar bimestre o área → recargar datos
- Estado local del grid con dirty tracking
- Guardar envía solo los cambios

### 2.5. Frontend: reemplazar EmptyState de notas en `ClaseDetalleView`

```tsx
{tab === "notas" && <NotasTab clase={clase} />}
```

Pasar el objeto `clase` completo porque necesita `clase.grado` para inferir el nivel y filtrar áreas.

### 2.6. Verificación fase 2

- Cargar tab Notas → seleccionar bimestre 1 y área → grid de alumnos
- Poner AD, A, B, C, guardar
- Refrescar → notas persisten
- Cambiar bimestre → grid distinto
- Comprobar que Alertas Tempranas ahora detecta alumnos con ≥2 B/C

---

## FASE 3 — Exportar Excel SIAGIE

### 3.1. Backend: action `notas/exportar`

```python
@action(detail=True, methods=["get"], url_path="notas/exportar")
def notas_exportar(self, request, pk=None):
    """
    Exporta las notas de la clase en Excel con estructura SIAGIE-friendly.
    ?bimestre=1  (default: todos los bimestres en pestañas)
    """
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill
    from django.http import HttpResponse
    from .models import NotaClasePersonal

    clase = self.get_object()
    bimestre_filtro = request.query_params.get("bimestre")

    wb = Workbook()
    wb.remove(wb.active)

    bimestres = [int(bimestre_filtro)] if bimestre_filtro else [1, 2, 3, 4]

    alumnos = list(clase.alumnos.filter(activo=True).order_by("orden"))

    for b in bimestres:
        ws = wb.create_sheet(f"Bimestre {b}")
        # Cabecera
        ws["A1"] = f"{clase.nombre} — {clase.grado} — {clase.area_principal}"
        ws["A1"].font = Font(bold=True, size=13)
        ws.merge_cells("A1:E1")

        ws["A3"] = "N°"
        ws["B3"] = "Apellidos y Nombres"
        ws["C3"] = "Código SIAGIE"
        ws["D3"] = "Competencia"
        ws["E3"] = "Calificación"
        for col in "ABCDE":
            ws[f"{col}3"].font = Font(bold=True)
            ws[f"{col}3"].fill = PatternFill("solid", fgColor="D9E1F2")

        fila = 4
        for i, a in enumerate(alumnos, start=1):
            nota = NotaClasePersonal.objects.filter(
                alumno=a, bimestre=b, area=clase.area_principal,
            ).first()
            ws.cell(row=fila, column=1, value=i)
            ws.cell(row=fila, column=2, value=a.nombre_completo)
            ws.cell(row=fila, column=3, value=a.codigo or "")
            ws.cell(row=fila, column=4, value=nota.competencia if nota else "")
            ws.cell(row=fila, column=5, value=nota.nota if nota else "")
            fila += 1

        ws.column_dimensions["A"].width = 5
        ws.column_dimensions["B"].width = 40
        ws.column_dimensions["C"].width = 15
        ws.column_dimensions["D"].width = 35
        ws.column_dimensions["E"].width = 14

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    nombre_archivo = f"notas_{clase.nombre.replace(' ', '_')}_{clase.anio}.xlsx"
    response["Content-Disposition"] = f'attachment; filename="{nombre_archivo}"'
    wb.save(response)
    return response
```

`openpyxl` YA está en `requirements.txt` — no instalar nada nuevo.

### 3.2. Frontend: componente `ExportarTab`

Archivo nuevo: `frontend/src/views/clases/ExportarTab.tsx`

Contenido simple:
- Card con explicación breve: "Descarga las notas de esta clase en formato Excel para copiar en SIAGIE."
- Selector: "Bimestre" con opciones: Todos / 1 / 2 / 3 / 4
- Botón "Descargar Excel" que hace `window.open(url, "_blank")` con la URL con token JWT en query (o mejor: usar `api.get` con `responseType: 'blob'` y forzar download)

Patrón para descarga con auth:
```typescript
const { data } = await api.get(`/clases-personales/${claseId}/notas/exportar/`, {
  responseType: "blob",
  params: bimestre ? { bimestre } : {},
});
const url = window.URL.createObjectURL(new Blob([data]));
const link = document.createElement("a");
link.href = url;
link.download = `notas_clase_${claseId}.xlsx`;
link.click();
window.URL.revokeObjectURL(url);
```

### 3.3. Frontend: reemplazar EmptyState de exportar

```tsx
{tab === "exportar" && <ExportarTab claseId={clase.id} clase={clase} />}
```

### 3.4. Verificación fase 3

- Ir a tab Exportar → seleccionar "Todos los bimestres" → Descargar
- Verificar que baje `notas_XXX_2026.xlsx`
- Abrir en LibreOffice / Excel — deben aparecer 4 pestañas, alumnos con sus notas

---

## Orden estricto de trabajo

1. **Backend fase 1** (asistencia action + serializer)
2. **Frontend fase 1** (tipos + servicio + AsistenciaTab + reemplazar EmptyState)
3. **PROBAR fase 1 manualmente** — pasar lista, refrescar, verificar
4. **Backend fase 2** (notas action + serializer)
5. **Frontend fase 2** (tipos + servicio + NotasTab + reemplazar EmptyState)
6. **PROBAR fase 2 manualmente** — cargar notas AD/A/B/C, refrescar, ver que alertas se actualiza
7. **Backend fase 3** (exportar action)
8. **Frontend fase 3** (ExportarTab + reemplazar EmptyState)
9. **PROBAR fase 3 manualmente** — descargar Excel, abrirlo

No mezclar fases. Cada una queda funcional y probada antes de la siguiente.

---

## Archivos que se tocan

**Backend (solo estos 2):**
- `backend/apps/clases_personales/views.py` — 3 actions nuevas
- `backend/apps/clases_personales/serializers.py` — 2 serializers nuevos

**Frontend (solo estos):**
- `frontend/src/types/clasesPersonales.ts` — tipos nuevos
- `frontend/src/services/clasesPersonales.ts` — 5 funciones nuevas
- `frontend/src/views/clases/ClaseDetalleView.tsx` — reemplazar 3 EmptyState por componentes reales
- `frontend/src/views/clases/AsistenciaTab.tsx` — nuevo
- `frontend/src/views/clases/NotasTab.tsx` — nuevo
- `frontend/src/views/clases/ExportarTab.tsx` — nuevo

**NO tocar bajo ningún concepto:**
- `apps/asistencia/`, `apps/notas/`, `apps/usuarios/`, `apps/aula_virtual/` (backend institucional)
- Ninguna vista fuera de `frontend/src/views/clases/`
- `Sidebar.tsx`, `App.tsx`, `DashboardView.tsx`
- Migraciones nuevas — todos los modelos que se usan ya existen (`AsistenciaClasePersonal`, `NotaClasePersonal`)

---

## Credenciales de prueba

- Docente: `juan_fix / docente2026`
- URL: `http://localhost:5174/mis-clases`
- Clase de prueba con alumnos: id=6 (verificar con GET `/api/clases-personales/`)

---

## Definición de "hecho"

V3 está completo cuando:
- ✅ El docente puede pasar lista día por día y los datos persisten
- ✅ El docente puede registrar notas AD/A/B/C por bimestre y los datos persisten
- ✅ Al meter notas B/C, las alertas tempranas los detectan
- ✅ Se descarga un Excel válido con las notas
- ✅ Ningún archivo institucional fue modificado
- ✅ La app institucional en `localhost:5173` funciona igual que antes (verificar login director)
