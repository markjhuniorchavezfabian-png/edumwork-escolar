# Migrar un docente de EduMWork Docente al institucional

Un docente que ya venía usando **EduMWork Docente** (`p_04`, la app individual)
se muda al sistema del colegio sin perder nada: sus clases, sus alumnos, la
asistencia que tomó y las notas que puso.

Es el argumento de venta del producto individual — *"cuando tu colegio se
digitalice, tu trabajo se muda con vos"* — así que conviene hacerlo delante del
director la primera vez.

---

## Los 4 pasos

### 1. El docente descarga sus datos

En su app: **Mi perfil → Descargar mis datos**. Baja un `.json` con todo lo suyo.
(Equivale a `GET /api/migracion/exportar/`.)

### 2. Crear al docente en el institucional

Gestión → Usuarios → nuevo usuario con **rol docente**. Anotá su `username`.
Si el docente todavía no existe, el importador se niega a seguir: las clases
tienen que quedar asignadas a alguien real.

### 3. Preview (no escribe nada)

```bash
docker compose -f docker-compose.prod.yml exec -T backend \
  python manage.py importar_docente /ruta/export.json --docente ana
```

Muestra cuántas secciones, alumnos, matrículas, notas y asistencias entrarían,
qué alumnos ya existían, y los avisos. **Leelo antes de aplicar** — sobre todo
los avisos de alumnos duplicados o secciones que ya tenían otro docente.

### 4. Aplicar

```bash
docker compose -f docker-compose.prod.yml exec -T backend \
  python manage.py importar_docente /ruta/export.json --docente ana --aplicar
```

Corre en una transacción: entra todo o no entra nada. Al final imprime las
credenciales iniciales de los alumnos nuevos (todos con cambio de contraseña
obligatorio en el primer ingreso).

Opciones: `--anio 2026` importa un solo año lectivo.

---

## Qué pasa con cada cosa

| En la app del docente | En el institucional |
|---|---|
| Clase (`1ro A - Comunicación`) | `Sección 1ro A` + asignación del área Comunicación al docente |
| Horario de la clase | Horario de la asignación |
| Estudiante | Usuario con rol estudiante + su ficha |
| Estudiante inscrito en la clase | Matrícula del año lectivo en esa sección |
| Asistencia por clase y día | Asistencia diaria (se colapsa, ver abajo) |
| Nota por competencia | Nota por competencia, con el curso como área |
| Sesión de aprendizaje | **No se importa todavía** (ver abajo) |

## Las tres cosas que conviene saber antes

**Se puede correr dos veces sin miedo.** Los alumnos se reconocen por un código
interno, y si es la primera vez, por DNI o por nombre + fecha de nacimiento. Si
la secretaría ya había cargado al alumno, se vincula en vez de duplicarlo — y el
comando lo dice en los avisos.

Cuando un alumno viene **sin DNI y sin fecha de nacimiento** no hay con qué
cotejarlo: se crea nuevo y queda un aviso pidiendo revisar si está duplicado.
Vale la pena que el docente complete los DNI en su app **antes** de exportar.

**La asistencia se colapsa a una por día.** En la app del docente hay un registro
por clase (si le da dos cursos al mismo alumno, hay dos ese día); en el
institucional hay uno por día. Se resuelve por presencia real: si asistió a
alguna clase, el día cuenta como asistido — presente > tardanza > justificado >
ausente. El comando informa cuántos registros colapsó.

**Nunca pisa datos del colegio.** Una nota ya cargada en el institucional no se
sobrescribe (solo se rellenan las vacías), y si la sección ya estaba asignada a
otro docente, se respeta y se avisa.

## Sesiones de aprendizaje

El institucional todavía no las guarda: las genera con IA al momento. Para que
el docente no las pierda, el comando las deja en un archivo `.sesiones.json` al
lado del que importaste. Cuando el institucional tenga el modelo, se cargan
desde ahí.

## Si el formato cambia

El JSON es un contrato entre los dos productos, definido en
`p_04_docente_solo/backend/apps/tenants/exportacion.py`. Lleva número de versión
y el importador **rechaza** versiones que no conoce en vez de importar mal. Si
tocás el exportador, subí `VERSION` y actualizá
`apps/usuarios/management/commands/importar_docente.py` + el fixture
`apps/usuarios/tests/fixtures/export_docente_v1.json`.
