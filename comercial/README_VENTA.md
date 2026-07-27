# Sistematic — Sistema TIC Escolar

**Gestión escolar completa para I.E. peruanas — con IA integrada, código open-source y tu data bajo tu control.**

> Diseñado en Perú para colegios peruanos. Cumple normativa MINEDU, formato SIAGIE, Ley 29733 de Protección de Datos.

📱 WhatsApp: **+51 988 783 411** · 🌐 [sistematic-8z7.pages.dev](https://sistematic-8z7.pages.dev)

---

## ¿Por qué elegirlo?

- 🎯 **17+ módulos integrados** — asistencia, notas, aula virtual, comunicados, incidencias, inventario, ambientes, convivencia SíseVe, visitas, y más
- 🤖 **Inteligencia artificial incluida** — reporta incidencias hablando en tus palabras, la IA extrae los datos; genera resúmenes ejecutivos
- 🎛️ **Adaptable a tu colegio** — prendé y apagá módulos según lo que usa tu I.E. (Inicial, Primaria, Secundaria o integrado)
- 📱 **Funciona en celular** — el 92 % de padres peruanos usan solo celular. Todo el sistema es responsive
- 🔐 **Tu data bajo tu control** — botón de backup descargable + código en GitHub público (sin lock-in)
- 💰 **Calculadora de precio integrada** — el director mueve 2 sliders y ve cuánto le sale
- 🇵🇪 **Hecho para Perú** — SIAGIE, escala AD/A/B/C, RVM 094-2020, plazos SíseVe, ubicación GPS, factura SUNAT

---

## Los módulos (17 core + activables)

### Siempre activos
| Módulo | Qué hace |
|---|---|
| **Asistencia estudiantes** | Marcado por QR + GPS. Notificación automática al padre si el hijo falta. Justificaciones online. |
| **Notas + Boletas PDF** | Escala oficial AD/A/B/C. Boletas bimestrales PDF con firmas y formato MINEDU. |
| **Reportes mensuales** | Excel y PDF con membrete institucional, listas para firmar y enviar a UGEL. |
| **Comunicados** | Circular a toda la I.E., por sección, solo staff, solo padres. Confirma lectura. |
| **Incidencias TI con IA** | Docente reporta "el proyector no anda", la IA extrae los detalles y sugiere solución. |
| **Justificaciones** | Padre justifica falta con constancia médica. Tutor aprueba/rechaza. |
| **Gestión de usuarios** | 10 roles: director, subdirector, docente, admin TIC, secretaría, auxiliar, psicólog@, conserje, padre, estudiante. |
| **Fichas + Import Excel masivo** | 32 campos SIAGIE. Subes 500 estudiantes con plantilla en 1 minuto. Docentes y padres igual. |
| **Panel familiar** | Padres ven asistencia, notas, boletas PDF, comunicados. Justifican faltas online. |
| **Secciones con niveles** | Inicial / Primaria / Secundaria diferenciados (para colegios integrados). Asignación de tutor y docentes. |
| **Auditoría completa** | Cada cambio queda registrado con usuario, fecha, IP. |

### Activables según lo que usa tu I.E. (podés prenderlos o apagarlos):
| Módulo | Para quién sirve |
|---|---|
| **Aula Virtual** | Docentes que suben material y tareas online (secundaria, primaria alta) |
| **Ambientes + QR imprimible** | Colegios con aulas identificadas, labs, biblioteca |
| **Sesiones de clase (labs)** | Registro de uso de AIP y laboratorios con QR |
| **Reservas de ambientes** | Docentes que reservan lab/biblioteca/sala música |
| **Inventario TI** | Colegios con muchos equipos (proyectores, PCs, tablets) |
| **Convivencia SíseVe** | Cumple plazo legal 30 días + alerta al director |
| **Control de visitas + gafete QR** | Colegios con portería / conserje |
| **Asistente de IA** | Docentes/admin que quieren sugerencias automáticas (opcional, BYOK) |
| **Asistencia del personal** | Marca de entrada/salida de docentes y staff |

**Ejemplo:** una I.E. de inicial (3-5 años) apaga Aula Virtual, IA, Sesiones de clase, Convivencia (protocolo en papel). Queda un sistema simple con asistencia + comunicados + notas + panel familiar.

---

## Diferenciadores únicos

### 🧠 IA integrada — nadie más lo tiene
- Docente escribe *"el proyector del aula 5 no anda desde ayer"* → la IA extrae título, descripción, ubicación, tipo, prioridad
- Admin TIC pide *"cómo resuelvo esta incidencia"* → la IA le da los 6 pasos más probables ordenados
- Director pide *"resumen ejecutivo semanal"* → la IA redacta un informe de 200 palabras con KPIs y patrones

**BYOK (Bring Your Own Key):** cada docente pone su propia API key de IA (DeepSeek gratis, Claude, o OpenAI). No cuesta a la institución.

### 👁 Modo Simple / Modo Completo
- **Modo Simple:** botones grandes, iconos, sin números ni gráficos. Ideal para conserjes, auxiliares, padres que se marean con datos.
- **Modo Completo:** panel profesional con KPIs, gráficos, filtros, exportaciones.

Cada usuario elige su modo, se cambia en 1 click.

### 🔐 Bajo tu control — sin lock-in
- **Botón "Descargar backup"** en Configuración → baja toda la BD en un `.sql.gz` a tu computadora
- **Botón "Restaurar"** con confirmación destructiva → recuperás una copia anterior en 30 segundos
- **Código en GitHub público** → cualquier consultor puede continuar el mantenimiento
- **Datos en tu servidor** (Modelo D) → no viajan al exterior, cumples Ley 29733

### 💰 Calculadora integrada
Dentro del sistema, el director accede a **"Costo para mi colegio"**, mueve 2 sliders (alumnos, docentes), elige si usa videos y RUC, y ve:
- VPS recomendado (con precios reales 2026 en soles)
- Dominio sugerido
- Total mensual y anual
- Costo por alumno / mes
- Botón WhatsApp con resumen precargado

Cero fricción entre "me interesa" y "te contacto".

### 📱 Responsive real
Mobile-first. Padres consultan desde su celular. Menú tipo drawer, botones táctiles 44px, tablas con scroll, modales fullscreen.

### 🚀 Deploy en 1 comando
Un script instala todo en un VPS Ubuntu: Docker + SSL gratis + backup diario + cron jobs. En 25 minutos está funcionando. Configuración inicial guiada con **wizard interactivo** (5 pasos).

---

## Cumplimiento normativo peruano

| Norma | Cómo lo cumplimos |
|---|---|
| **RVM N° 094-2020-MINEDU** | Escala AD/A/B/C en notas, formato de boletas |
| **Ley 29733 (Protección de Datos)** | Consentimiento explícito, auditoría de accesos, cifrado, contrato de encargado |
| **Protocolo SíseVe MINEDU** | Convivencia con plazo legal 30 días + alerta automática al director |
| **SIAGIE** | Campos alineados, export/import Excel compatible |
| **Registro visita legal** | Bitácora de portería con gafete QR, DNI 8 dígitos |
| **Factura SUNAT** | Facturación electrónica con RUC (para I.E. públicas y privadas) |

---

## Modelos comerciales

Elegí cómo querés trabajar con nosotros:

| | **A — Todo administrado** | **D — Tu servidor, mantenimiento nuestro** 🌟 | **C — Independiente total** |
|---|---|---|---|
| Quién paga infra | Nosotros | Tu colegio (S/35-90/mes) | Tu colegio |
| Setup único | S/400-2000 | S/400-2000 | S/2000-4000 |
| Cuota mensual nuestra | S/80-400 (todo incluido) | S/80-150 (mantenimiento) | Solo si pedís horas |
| Backups | Automáticos | Automáticos + descargables por vos | Vos te encargás |
| Actualizaciones | Automáticas | Automáticas | Con horas contratadas |
| Data en tu servidor | No | **Sí** ✅ | Sí |
| Ley 29733 | Tuya y nuestra | **Solo tuya** ✅ | Solo tuya |
| Si dejás de pagar | Sistema cortado | Sistema sigue, sin updates | Sistema sigue |

**Recomendamos Modelo D** para la mayoría — tu data en tu servidor, sin lock-in, mantenimiento y soporte incluidos.

---

## Precios base (Modelo A o D)

| Plan | Alumnos | Suscripción Modelo A (S/mes) | Mantenimiento Modelo D (S/mes) | Setup único (S/) |
|---|---|---|---|---|
| **Básico** | Hasta 200 | 80 | 80 | 400 |
| **Estándar** | 201 – 600 | 150 | 120 | 700 |
| **Grande** | 601 – 1 500 | 250 | 150 | 1 200 |
| **XL** | Más de 1 500 | Consultar | Consultar | 2 000+ |

**En Modelo D** el colegio paga aparte su VPS (SitioHost S/70/mes recomendado) y su dominio (S/45-90/año).

**Incluido en cualquier plan:**
- Uso ilimitado de todos los módulos activos
- Actualizaciones automáticas
- Backup manual (descargable) + automático diario
- Soporte por WhatsApp Business (Lun-Vie 9-6, 24-48h respuesta)
- Wizard de instalación asistida
- Data en Perú (Modelo D con SitioHost/HostPerú)

**Ofertas de arranque:**
- 30 días de prueba gratis con datos de demo
- Setup gratis si contratás 1 año adelantado (Modelo A)
- Descuento 15 % para I.E. con menos de 100 alumnos
- Migración desde otro sistema: gratis hasta 500 registros

---

## ¿Cuánto sale para mi colegio?

3 formas de averiguarlo:

1. **Rápido:** revisa la tabla de arriba según tu cantidad de alumnos
2. **Personalizado:** entrá a la **calculadora dentro de la demo** (`/mi-plan`), mové los sliders con los datos reales de tu colegio y obtén el total exacto + botón directo a WhatsApp
3. **Detallado:** mándanos WhatsApp con: nombre I.E., alumnos, docentes, ciudad, y si usan aula virtual con videos. Te devolvemos cotización formal en 24h

📱 **+51 988 783 411** · 📧 cmarkjhunior@gmail.com

---

## Contacto

**Mark Chávez Fabián** — Ing. de Sistemas UNEHVAL

- 📱 WhatsApp: **+51 988 783 411**
- 📧 cmarkjhunior@gmail.com
- 🌐 Landing: [sistematic-8z7.pages.dev](https://sistematic-8z7.pages.dev)
- 🎮 Demo en vivo: [oblivion-expediter-atrium.ngrok-free.dev](https://oblivion-expediter-atrium.ngrok-free.dev)
- 💻 GitHub: [etdherhwrahaerherahetar](https://github.com/etdherhwrahaerherahetar)

*Solicitá una demo online sin compromiso. Te la agendo en 24h.*

*Última actualización: 2026-07-16*
