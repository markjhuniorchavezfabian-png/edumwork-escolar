# Checklist para arrancar HOY (100% gratis)

Tiempo total: **2-3 horas**.
Costo: **S/ 0**.

---

## 1. Landing en Cloudflare Pages (15 min)

- [ ] Crear cuenta en https://dash.cloudflare.com (gratis)
- [ ] Click en "Workers & Pages" (menú izquierdo)
- [ ] Click en "Create" → "Pages" → "Upload assets"
- [ ] Nombre del proyecto: `sistematic`
- [ ] Arrastrar el archivo `comercial/landing/index.html`
- [ ] Deploy
- [ ] ✅ Ya tenés online: `https://sistematic.pages.dev`

**Nota:** si querés dominio propio después, solo comprás `sistematic.pe` en https://punto.pe (S/ 130/año) y en Cloudflare vas a "Custom domains" → "Set up a custom domain".

---

## 2. Video demo con Loom (30 min)

- [ ] Crear cuenta en https://loom.com (gratis, 25 videos de 5 min c/u)
- [ ] Instalar extensión de Chrome
- [ ] Prepará el sistema abriendo `http://localhost:8095` en un browser incógnito
- [ ] Cerrá todas las otras pestañas y silenciá WhatsApp
- [ ] Click en el ícono de Loom → "Record screen and camera"
- [ ] Grabá siguiendo esta guía corta:

### Guion de 3 minutos

**0:00 – 0:15 — Intro**
*"Hola, soy Mark. Te muestro Sistematic, sistema web para colegios peruanos, en 3 minutos."*

**0:15 – 0:45 — IA reportando incidencia**
- Login como `docente1 / docente2026`
- Reportar incidencia escribiendo *"el proyector del aula 5A no anda desde ayer"*
- Mostrar cómo la IA la clasifica

**0:45 – 1:15 — Panel del padre en mobile**
- F12 → toggle device toolbar → iPhone 12
- Login como `padre1 / padre2026`
- Mostrar asistencia del hijo + botón "Justificar"

**1:15 – 1:45 — Boleta PDF**
- Login como `director / director2026`
- Sidebar → Notas → "Generar boletas" → descargar ZIP
- Abrí un PDF y mostralo

**1:45 – 2:15 — Modo simple/completo**
- Toggle en el sidebar footer
- Mostrar la diferencia

**2:15 – 3:00 — Cierre**
*"17 módulos integrados. Precio desde S/ 80 al mes. Servidor en Perú, cumple MINEDU. Contactame por email o WhatsApp."*

- [ ] Guardar el video
- [ ] Copiar el link de Loom
- [ ] Editar `comercial/landing/index.html` → agregar link al video

---

## 3. Convertir README a PDF (10 min)

Opción más fácil:
- [ ] Abrir https://docs.google.com/document/d/create
- [ ] Copiar contenido de `comercial/README_VENTA.md`
- [ ] Pegar en el documento
- [ ] Menú File → Download → PDF Document (.pdf)
- [ ] Guardar como `Sistematic_Presentacion.pdf`

Opción rápida por terminal (si tenés pandoc):
```bash
cd ~/WORKFULL/dev/p_03_ie_cesar_vallejo/comercial
pandoc README_VENTA.md -o Sistematic_Presentacion.pdf
```

---

## 4. Lista de 10 directores conocidos (30 min)

Anotá en un archivo simple:

| # | Nombre | Colegio | Teléfono / email | Relación | Estado |
|---|---|---|---|---|---|
| 1 | | | | | pendiente |
| 2 | | | | | pendiente |
| ... | | | | | |

Fuentes de contactos:
- Directores conocidos por familia
- Directores del colegio donde estudiaste
- Amigos que sean docentes o directores
- Contactos de Facebook/LinkedIn en educación
- Grupos de WhatsApp de UNEHVAL con exalumnos que ahora dirigen colegios
- Directores mencionados en el curso de Arquitectura de TI

**Objetivo:** 10 nombres con contacto real. No importa si algunos son lejanos.

---

## 5. Mensaje inicial listo para copiar (5 min)

Redactá tu mensaje en 3 versiones:

### Versión WhatsApp corta

> Hola [nombre], espero estés bien. Desarrollé un sistema web para colegios con inteligencia artificial. Está gustando mucho — asistencia, notas, comunicados, incidencias, todo integrado. Precio 46 soles al mes para colegios chicos. ¿Te muestro cómo funciona en 20 minutos por Google Meet? Sin compromiso. Acá te dejo el link con detalles: https://sistematic.pages.dev

### Versión email formal

> Asunto: Sistema web para gestión escolar — S/ 80/mes para su colegio
>
> Estimado/a director/a [apellido],
>
> Me llamo Mark Chávez Fabián, ingeniero de sistemas de la Universidad Nacional Hermilio Valdizán. Desarrollé un sistema web integral para la gestión de colegios peruanos que incluye 17 módulos integrados: asistencia con GPS y QR, notas con boletas PDF automáticas, aula virtual, comunicados, panel para padres, incidencias con inteligencia artificial y más.
>
> El sistema cumple con la normativa MINEDU (RVM 094-2020, protocolo SíseVe, Ley 29733) y está pensado para directores no técnicos: hay un "modo simple" con botones grandes.
>
> Precio desde S/ 80/mes según cantidad de alumnos, todo incluido.
>
> ¿Le interesaría una demo en línea de 20 minutos sin compromiso? Puedo coordinar cuando le venga bien.
>
> Le adjunto el resumen del producto.
>
> Cordiales saludos,
> Mark Chávez Fabián
> [tu teléfono]
> cmarkjhunior@gmail.com

### Versión LinkedIn / grupos

> Directores y subdirectores de I.E. peruanas: si están buscando un sistema web para gestionar su colegio (asistencia, notas, comunicados, padres, etc.) desarrollé uno que puede interesarles. Incluye IA para clasificar incidencias, panel para padres desde el celular, cumple MINEDU. Desde S/ 80/mes. Detalles: https://sistematic.pages.dev

---

## 6. Enviar el primer mensaje (10 min)

- [ ] Elegir 3 contactos de la lista (los más cercanos, los más "seguros")
- [ ] Mandarles el mensaje personalizado
- [ ] NO mandes a los 10 el mismo día — mandá 3 hoy, 3 mañana, 3 pasado, para poder gestionar las respuestas

---

## Resultado esperado en 1 semana

- ✅ Landing online funcionando
- ✅ Video demo grabado y en la landing
- ✅ PDF de presentación listo para adjuntar en emails
- ✅ 10 directores contactados
- ✅ 2-3 demos agendadas

**Ese es el punto de partida real del negocio.**

---

## Lo que NO hacer en esta fase

- ❌ NO comprar dominio hasta cerrar el primer colegio
- ❌ NO pagar por hosting hasta cerrar el primer colegio
- ❌ NO tramitar INDECOPI hasta cerrar el primer colegio
- ❌ NO seguir agregando features al sistema
- ❌ NO hacer landing "más bonita" — la que hay ya vende

**Foco absoluto en HABLAR CON DIRECTORES.**
