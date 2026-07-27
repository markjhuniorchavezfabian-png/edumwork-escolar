# Kit Comercial — Sistematic

Este directorio contiene todo lo que necesitás para vender Sistematic a colegios peruanos.

## 📁 Contenido

| Archivo | Cuándo usarlo |
|---|---|
| **[README_VENTA.md](README_VENTA.md)** | Documento principal del producto. Convertí a PDF y mandalo por email al director. |
| **[landing/index.html](landing/index.html)** | Landing web de 1 página. Subí a Cloudflare Pages o Vercel gratis en 5 min. |
| **[GUIA_DEMO.md](GUIA_DEMO.md)** | Script de qué mostrar en 20 min de demo con el director. Con manejo de objeciones. |
| **[CONTRATO_MODELO.md](CONTRATO_MODELO.md)** | Plantilla de contrato. Revísalo con abogado antes del primer cliente. |
| **[COTIZADOR.md](COTIZADOR.md)** | Cómo calcular precio según tamaño del colegio + ejemplos concretos. |

También:
- **[../deploy/GUIA_COLEGIO.md](../deploy/GUIA_COLEGIO.md)** — guía técnica para el director sobre qué servidor comprar
- **[../deploy/install_colegio.sh](../deploy/install_colegio.sh)** — script de deploy 1-comando

## 🚀 Cómo arrancar a vender (día por día)

### Semana 1 — Preparación

**Día 1-2: Landing online**
```bash
cd comercial/landing
# Subir a Cloudflare Pages (gratis)
npm install -g wrangler
wrangler pages deploy . --project-name=sistematic
# En 5 minutos tenés: https://sistematic.pages.dev
```

Comprá dominio `sistematic.pe` en https://punto.pe (S/ 130/año) y apuntalo a Cloudflare.

**Día 3: PDF de venta**
Convertí `README_VENTA.md` a PDF con `pandoc` o subilo a Google Docs → Descargar PDF.

**Día 4: Grabá video demo**
- Usá OBS o Loom (gratis)
- 3-5 minutos, sin editar mucho
- Mostrá los 6 flujos de `GUIA_DEMO.md` acortados
- Subí a YouTube (no listado) y enlazá en la landing

**Día 5: Contrato revisado**
Andá a un abogado peruano con `CONTRATO_MODELO.md`. Consulta suele costar S/ 100-150. Volvés con el contrato pulido.

### Semana 2 — Primer contacto

**Lista de 10 directores** que conozcas (personales, universidad, contactos de familia).

Mensaje inicial (WhatsApp o email):

> Hola [nombre], espero estés bien. Desarrollé un sistema web integral para colegios con inteligencia artificial que resuelve asistencia, notas, comunicados y más. Está muy bien recibido — el precio es 46 soles al mes para colegios chicos. ¿Te interesa que te lo muestre en una demo de 20 min por Google Meet? Sin compromiso.

De 10 mensajes esperá:
- 4 no responden
- 3 dicen "no gracias"
- 2 aceptan demo
- 1 se convierte en cliente

**Es matemática, no talento.** Necesitás cantidad de intentos, no perfeccionar el mensaje.

### Semana 3-4 — Demos y cierres

Seguí `GUIA_DEMO.md` en cada reunión. Después mandá `README_VENTA.md` en PDF y `COTIZADOR.md` con cotización personalizada.

## 🎯 Objetivo del primer trimestre

**3 colegios cerrados = ~S/ 500/mes de ingreso recurrente + ~S/ 1 200 de setup.**

Con eso ya validaste que el mercado paga.

## ⚠ Cosas importantes que NO hacer

1. **NO bajar el precio antes de mostrar** — vas a atraer clientes que no valoran, después te van a exigir mucho por poco.
2. **NO prometer features que no existen** — te va a explotar en la cara al mes 2. Vendé solo lo que ya está funcionando.
3. **NO firmar sin adelanto del 50 %** — el que no paga adelanto tampoco paga después.
4. **NO obsesionarte con perfeccionar el producto** — cada semana sin vender es plata perdida. Feature nueva ≠ venta nueva.
5. **NO ofrecer soporte 24/7 gratis** — vas a terminar odiando el proyecto. Definí horarios y respetalos.

## ✅ Chequeo antes de la primera venta

- [ ] Landing online con dominio propio o subdominio
- [ ] Video demo grabado y subido
- [ ] README_VENTA.md convertido a PDF
- [ ] Contrato revisado por abogado
- [ ] Cuenta bancaria BCP o Interbank a nombre tuyo con RUC (o al menos tarjeta de recibir)
- [ ] Cotizador personal claro en la cabeza
- [ ] 10 nombres de directores a los que contactar

Cuando tengas esos 7 puntos, salí a vender. **No antes.**
