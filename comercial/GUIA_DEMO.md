# Guía de demo al director

## Cómo mostrar Sistematic en 20 minutos

Esta guía es tu script para mostrarle el sistema a un director de colegio (público o privado) en una demo online o presencial. Estructurada para maximizar el impacto emocional y minimizar el "no entiendo".

---

## Antes de la reunión (5 minutos)

Prepará:

- [ ] Sistema corriendo en `http://localhost:8095` (o en la URL demo si ya tenés servidor)
- [ ] **Ventana incógnito** — evita que tus contraseñas guardadas confundan
- [ ] **Zoom del browser al 110-125 %** — el director probablemente tiene 50+ años
- [ ] **Cerrá pestañas irrelevantes** — solo el sistema y el email
- [ ] **Silencia notificaciones** — nada de WhatsApp saltando
- [ ] Ten a mano: **README_VENTA.md**, este documento, calculadora de precios

---

## Estructura de la demo (20 min)

### 🎬 Apertura (2 min)

**Qué decir:** *"Director, le voy a mostrar un sistema web que resuelve 5 dolores típicos de un colegio peruano: asistencia, notas, incidencias, comunicados y padres desconectados. Todo en 1 plataforma. Le tomo 20 minutos y usted me pregunta lo que quiera al final."*

**Por qué:** anclás el tiempo (no divaga), presentás la promesa concreta (5 dolores), le das permiso a interrumpir.

---

### 🚪 Escena 1 · Ingreso del director (1 min)

1. Login con `director / director2026`
2. **Señalá el dashboard**: *"Esto es lo primero que ve el director cada mañana. Panel con lo que le importa: cuántas incidencias abiertas, cuántas ausencias hoy, alertas."*

**Punto clave:** *"¿Ve estos 4 atajos grandes? Son los flujos que más se usan. Un click y está adentro."*

---

### 🤖 Escena 2 · Reportar una incidencia CON IA (3 min)

**El gancho más fuerte del sistema.**

1. Logout director → Login con `docente1 / docente2026`
2. Sidebar → **Incidencias TI** → **"+ Nueva incidencia"**
3. En el campo grande, escribí en voz alta mientras tipeás:
   *"El proyector del aula quinto A no muestra imagen desde ayer. La lámpara se enciende pero la pantalla queda negra."*
4. Click en **"Continuar (analizar con IA)"**
5. **PAUSA dramática 2 segundos.**
6. La IA autocompletó título, descripción, ubicación, tipo (proyector), prioridad (media).

**Qué decir:** *"Fíjese que el docente no llenó ningún formulario. Solo contó lo que le pasó como si le hablara a un colega. La IA extrajo todo. Esto lo tienen colegios con sistemas de 300 dólares al mes en Estados Unidos. Nosotros lo damos por 46 soles."*

**Reacción esperada:** cara de sorpresa. Ríe. Dice *"¿y eso funciona en serio?"*.

---

### 📱 Escena 3 · Panel del padre desde el celular (3 min)

1. Cambiá el browser a modo mobile (F12 → toggle device toolbar → iPhone 12)
2. Login como `padre1 / padre2026`
3. Recorrido rápido:
   - **Ver asistencia del hijo** — mostrá los KPIs (% asistencia, ausencias)
   - **Botón "Justificar"** en una falta → llenar → enviar
   - **Ver notas** del bimestre
   - **Descargar boleta PDF** — click en "Bimestre 1" → descarga el PDF
   - **Abrí el PDF** — muéstrele el formato oficial MINEDU (cabecera, notas, firmas)

**Qué decir:** *"El 92 % de padres de familia peruanos usan solo celular. Nada de esperar que vayan al colegio a pedir la boleta. Se la descargan en su casa a las 10 de la noche. La secretaría ya no atiende reclamos por eso."*

---

### 🎓 Escena 4 · Aula virtual (2 min)

1. Volver a desktop
2. Login como `docente1`
3. Sidebar → **Aula Virtual** → click en el curso demo
4. Mostrar: **una lección con video de YouTube embebido** + **una tarea con fecha de entrega**
5. Cambiar a `estudiante1 / estu2026` → sidebar → Aula Virtual → mismo curso → botón **"Entregar tarea"** → adjuntar archivo

**Qué decir:** *"El docente sube un video de YouTube en 30 segundos. El estudiante lo ve cuando quiera desde su celular. Y si tiene tarea, la sube desde acá. Nada de WhatsApp con imágenes borrosas."*

---

### 📊 Escena 5 · Descarga de boletas oficiales bimestrales (2 min)

1. Login como `director`
2. Sidebar → Notas → botón **"Generar boletas"**
3. Elegir sección + bimestre → **Descargar ZIP**
4. Abrí el ZIP frente al director. 30 PDFs bien formateados.

**Qué decir:** *"Antes: la secretaría hacía 500 boletas a mano en Word cada 3 meses. 60 horas de trabajo. Ahora: 1 clic, 30 segundos, 500 PDFs listos para imprimir o enviar. Solo esta feature amortiza el sistema en el primer bimestre."*

---

### 👨‍👦 Escena 6 · Cambiar entre Modo Simple y Completo (2 min)

**Esto es el diferenciador que nadie más tiene.**

1. Sidebar footer → toggle a **Modo Simple**
2. Recorré: dashboard con botones grandes, sidebar simplificado, sin gráficos.
3. Toggle a **Modo Completo**.

**Qué decir:** *"Su conserje o su auxiliar tal vez no está acostumbrado a sistemas complejos. Cambia a Modo Simple con 1 click y ve solo lo que necesita: botones grandes, sin números. Su subdirector que hace reportes ve el Modo Completo con KPIs, gráficos, todo. Cada usuario elige el suyo. Ninguna otra plataforma escolar en Perú tiene esto."*

---

### 🚪 Escena 7 · Portería con QR (2 min — opcional, si tenés tiempo)

1. Login como `conserje / con2026`
2. Sidebar → Visitas → mostrar visitas del día
3. Explicar el flujo del auto-registro con QR pegado en portería

**Qué decir:** *"El visitante escanea el QR de la puerta con su celu, llena su DNI, motivo, a quién visita. La secretaría recibe una notificación. Menos cola, menos papel."*

---

### 🚀 Escena 8 · Deploy en 1 comando (1 min)

**Solo si el director es técnico o pregunta cómo se instala.**

Mostrar el archivo `deploy/GUIA_COLEGIO.md`. Explicar:
- Servidor peruano SitioHost: S/ 35/mes
- Un comando y en 25 minutos está corriendo
- Backup diario automático, HTTPS gratis

**Qué decir:** *"No necesita esperar meses de proyecto ni pagar consultora cara. En 1 tarde queda instalado. Su admin TIC puede hacerlo solo o yo lo hago por usted como parte del setup."*

---

### 💰 Cierre — Precio y siguiente paso (2 min)

**Qué decir:**

*"Le hago un resumen:*
*- 17 módulos, integrados entre sí*
*- IA integrada real*
*- Padres desde el celular*
*- Boletas PDF automáticas cada bimestre*
*- Modo simple para usuarios no técnicos*
*- Cumple MINEDU, SIAGIE, SíseVe, Ley 29733*
*- Servidor en Perú, datos en Perú*

*Su colegio tiene [X] alumnos → plan [Básico/Estándar/Grande] → S/ [precio]/mes.*
*Setup único: S/ [monto].*

*Le propongo:*
*- Le mando un contrato simple por email*
*- Le doy 15 días de prueba gratis con datos reales del colegio*
*- Si le convence, arrancamos. Si no, sin cargo."*

---

## Objeciones comunes y cómo responder

### *"Ya tenemos SIAGIE"*

*"SIAGIE es obligatorio para MINEDU. Nosotros no lo reemplazamos, lo complementamos. SIAGIE es donde ustedes reportan a UGEL. Sistematic es donde ustedes hacen la operación diaria: asistencia, comunicados, incidencias. Las notas que ingresan acá se exportan al formato SIAGIE con un clic."*

### *"Es muy caro"*

*"S/ 46 al mes es menos de lo que gasta el colegio en tinta y hojas cada mes. Solo generar las boletas automáticamente le ahorra a la secretaría 60 horas por bimestre. Si su secretaria gana S/ 10 la hora, se paga solo."*

### *"Y si algo se rompe?"*

*"Tres respuestas: (1) el sistema hace backup diario automático, no se pierde nada, (2) yo doy soporte por email con respuesta 24-48h, (3) si algo urgente, tengo un teléfono."*

### *"No tenemos internet estable"*

*"Los docentes hacen la mayoría de las acciones desde su celular con datos móviles. La app funciona en 4G perfecto. Y si el internet se cae, cuando vuelve, el sistema sincroniza automáticamente."*

### *"Los padres no van a saber usarlo"*

*"Justamente por eso hicimos el Modo Simple. Un padre que solo sabe WhatsApp entra y ve 4 botones grandes: 'Ver asistencia', 'Ver notas', 'Justificar falta', 'Comunicados'. Ni siquiera hay menú. Se lo mostramos en 30 segundos al primer padre que venga y ya sabe."*

### *"¿Y si vos te vas?"*

*"El código es propio del colegio en la instalación. Además todo está en Docker, cualquier técnico puede mantenerlo. Si en algún momento no quieren seguir conmigo, tienen el sistema y los datos. Yo no soy prisionero suyo ni ustedes de mí."*

### *"Necesito preguntar a UGEL"*

*"Perfecto. Es un sistema propio del colegio, no reemplaza a SIAGIE ni compromete a UGEL. Le puedo ayudar a redactar un memo explicativo si quiere."*

---

## Después de la demo

Enviá por email en las siguientes 2 horas:

1. **Gracias por su tiempo**
2. **PDF con el README de venta**
3. **Cotización personalizada** (según cantidad de alumnos)
4. **Link a video demo grabado** (para que se lo pueda mostrar a su subdirector)
5. **Fecha propuesta para hacer follow-up** (una semana después)

**Ejemplo de asunto:** *"Sistematic para [Nombre del colegio] — resumen y siguiente paso"*

---

## Métrica de éxito

Objetivo mínimo por demo:
- ✅ Director dice *"esto me interesa"* → agendás segunda reunión en 1 semana
- ✅ Director pide *"mándame el contrato"* → cierre en 2-3 semanas
- ❌ Director dice *"lo pienso"* sin dar fecha → probablemente perdido, mové a otro
