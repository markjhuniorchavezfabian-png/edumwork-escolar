# Cotizador — cómo poner precio a cada colegio

## Regla base

**Precio = mensualidad × 12 + setup + extras**

Todo por colegio, ellos pagan lo del hosting (o vos lo intermedias con margen).

---

## Tabla de mensualidad por tamaño

| Alumnos | Plan | Mensualidad | Setup |
|---|---|---|---|
| Hasta 200 | Básico | S/ 80 | S/ 300 |
| 201 – 600 | Estándar | S/ 150 | S/ 400 |
| 601 – 1 500 | Grande | S/ 250 | S/ 500 |
| 1 501 – 3 000 | XL | S/ 400 | S/ 700 |
| Más de 3 000 | Enterprise | Consultar | Consultar |

---

## Costos reales que tenés vos

Necesitás saber tus costos para no vender bajo el punto de equilibrio:

| Item | Costo mensual real |
|---|---|
| VPS SitioHost 2 GB | **S/ 35** |
| Dominio (proporcional S/ 130/año ÷ 12) | S/ 11 |
| Tiempo de soporte estimado (1 hora/mes × S/ 30) | S/ 30 |
| **Costo tuyo por colegio** | **~S/ 76/mes** |

**Margen por plan:**
| Plan | Cobrás | Costo | Margen | Margen % |
|---|---|---|---|---|
| Básico | 80 | 76 | 4 | 5 % (mala) |
| Estándar | 150 | 76 | 74 | 49 % (buena) |
| Grande | 250 | 76 | 174 | 70 % (muy buena) |
| XL | 400 | 90 | 310 | 78 % |

**Conclusión:** el plan Básico casi no da margen. Solo lo usás como puerta de entrada para colegios chicos. La plata real está en Estándar y Grande.

---

## Setup — qué incluye y por qué cuesta

El setup no es "instalar el sistema". Es:

- Contratar y configurar el servidor VPS (30 min)
- Instalar el sistema con el script (25 min)
- Configurar dominio + SSL (30 min)
- Migrar el padrón desde Excel del colegio (1-3 h según cantidad)
- Crear cuentas iniciales de directores/docentes clave (30 min)
- Personalizar (nombre, logo, código modular, colores) (30 min)
- Capacitación de 2 h al equipo directivo (2 h)

**Total tiempo tuyo:** 5-7 horas.

**Al cobrar S/ 300-500 estás cobrando S/ 50-100 la hora**, lo cual es razonable para trabajo técnico personalizado en Perú.

---

## Extras cotizables aparte

| Extra | Precio | Cuándo cobrarlo |
|---|---|---|
| Dominio propio `.pe` | S/ 130/año | Si quieren `sistema.colegio.pe` en vez de `colegio.sistematic.pe` |
| Dominio `.edu.pe` (trámite RED.PE) | S/ 200 + S/ 130/año | Si son IE oficial y quieren dominio educativo |
| Migración desde otro sistema (SIAGIE Excel u otro) | S/ 200 - 800 | Depende de la calidad de los datos que traen |
| Capacitación presencial en el colegio | S/ 150/hora | Solo si te queda cerca físicamente |
| Capacitación online (Zoom) | S/ 100/hora | Después de las 2 h iniciales incluidas |
| Módulo custom (pedido del colegio) | Cotización | Ej: integración con biometría, sistema de pagos |
| Soporte prioritario (respuesta 4 h) | +S/ 100/mes | Colegios que quieren tranquilidad |
| Reunión mensual de seguimiento (1 h) | +S/ 50/mes | Colegios que quieren acompañamiento |

---

## Descuentos permitidos

Usá con cuidado. Cada descuento sale de tu margen.

| Descuento | Cuándo aplicar | Efecto en margen |
|---|---|---|
| **Pago anual adelantado** | Cliente paga 12 meses juntos | 10 % OFF (equivale a "un mes gratis"). Ganás cash flow. |
| **Primer colegio piloto** | Es tu primer cliente pagante | 25 % primeros 6 meses. A cambio te dan referencia + testimonio. |
| **Recomendado por cliente existente** | Un director te recomienda a otro | 10 % descuento al nuevo + 10 % de crédito al que refirió |
| **IE pública en zona rural** | Contexto social | 20 % OFF sin condición extra. Es tu aporte. |
| **Contrato multianual** | 3 años firmados | 15 % OFF cada año. Ganás estabilidad. |

**NO descontar por:**
- *"Es caro"* sin justificación — sostené el precio
- Chantaje emocional sin contraparte
- Promesas vagas de "traer más colegios"

---

## Ejemplos de cotización

### Ejemplo 1: I.E. pública pequeña (Huánuco rural, 150 alumnos)

| Item | Cantidad | Precio |
|---|---|---|
| Plan Básico | 12 meses | 12 × 80 = 960 |
| Setup único | 1 | 300 |
| Descuento IE pública rural (20 %) | — | -252 |
| **Total año 1** | | **S/ 1 008** |
| Total año 2 en adelante | | S/ 768 |

### Ejemplo 2: I.E. estándar (500 alumnos, medio urbano)

| Item | Cantidad | Precio |
|---|---|---|
| Plan Estándar | 12 meses | 12 × 150 = 1 800 |
| Setup único | 1 | 400 |
| Dominio `.edu.pe` | 1 | 200 |
| Capacitación extra 2 h | 2 | 300 |
| Descuento pago anual (10 %) | — | -180 |
| **Total año 1** | | **S/ 2 520** |
| Total año 2 en adelante | | S/ 1 800 |

### Ejemplo 3: I.E. privada grande (1 200 alumnos, Lima)

| Item | Cantidad | Precio |
|---|---|---|
| Plan Grande | 12 meses | 12 × 250 = 3 000 |
| Setup único | 1 | 500 |
| Migración desde sistema anterior | 1 | 600 |
| Dominio propio `.pe` | 1 | 130 |
| Soporte prioritario | 12 meses | 12 × 100 = 1 200 |
| **Total año 1** | | **S/ 5 430** |
| Total año 2 en adelante | | S/ 4 200 |

---

## Comparación con competencia peruana (para tu argumentario)

| Producto | Mensualidad estándar | Módulos |
|---|---|---|
| **Sistematic (nosotros)** | S/ 150 | 17 |
| Nubetec Escolar | ~S/ 200 | ~12 |
| Yachay | ~S/ 400 | ~15 |
| Colegium | ~US$ 200 (S/ 760) | ~20 |
| Software Escolar Perú | ~S/ 250 | ~10 |

**Nuestro pitch:** *"Menos que la competencia y con IA integrada que ningún otro tiene."*

---

## Flujo de venta paso a paso

```
1. Demo (20 min) → GUIA_DEMO.md
2. Cotización enviada por email (24 h después) → este documento
3. Follow-up llamada telefónica (1 semana después)
4. Contrato firmado + adelanto 50 % → CONTRATO_MODELO.md
5. Instalación en 15 días
6. Entrega + pago 50 % restante
7. Capacitación 2 h
8. Facturación mensual automática
9. Follow-up trimestral para renovación anticipada
```

---

## Cuándo decir "no" a un colegio

Sí, hay colegios que no conviene aceptar.

- **Piden funcionalidades muy custom** sin pagar el desarrollo → *"Podemos hacerlo, cotizo aparte. Cuesta S/ X."*
- **Regatean hasta bajarte 40 %** → *"El precio ya es competitivo. No puedo hacer descuento así."*
- **Demoran meses en firmar** → dejalos ir, no persigas. Concentrate en los interesados.
- **El director es difícil desde el primer contacto** → probablemente será el peor cliente después. No vale la pena.
- **No pagan puntualmente el adelanto** → no arranques el trabajo. Cero excepciones.
