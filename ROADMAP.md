# ROADMAP — EduMWork Sistema TIC Escolar

> Actualizado: 2026-07-07
> Compilación de features pendientes para instituciones educativas peruanas.
> Basado en investigación de dolores de IE peruanas + normativa MINEDU/SIAGIE + inspiración internacional (Estonia/UK/Finlandia/etc.).

## Estado actual — implementado ✅

- **Incidencias TI** (con IA: clasificación, sugerencia, resumen ejecutivo, reporte Word)
- **Asistencia** (marcado con lista + escáner QR + panel padres + KPIs director)
- **Inventario TI** (equipos + Excel institucional)
- **Control de visitas** (registro + gafete QR + KPIs)
- **Auditoría** (bitácora ISO 9001 con signals automáticos)
- **Gestión de Usuarios** (11 roles: director/subdirector/docente/admin_tic/secretaria/auxiliar/psicologa/conserje/padre/estudiante/ugel)
- **Gestión de Secciones** (con tutor + docentes M2M)
- **Comunicados** (con confirmación de lectura + KPIs de alcance)
- **Convivencia / SíseVe** (casos + timeline 30 días + alerta plazo legal)
- **Vinculación padres ↔ hijos**
- **Consentimiento Ley 29733** (para padres)
- **Cambio de contraseña** propia + reset por staff
- **Config IA** (BYOK: DeepSeek, Claude, OpenAI, Ollama local)

---

## Nivel 1 — Sprint del padre/apoderado (siguiente prioridad)

**Continuación directa del Bloque D. ~9 h de trabajo restante.**
Cierra la brecha detectada por el research: **la app hoy es invisible
para el 85% de los stakeholders (padres + estudiantes).**

### 1.1 Bandeja de justificaciones de inasistencia
- Padre reporta ausencia desde el celular con motivo + foto opcional de constancia médica
- Tutor/auxiliar aprueba o rechaza
- Queda ligado al registro de asistencia (con estado "justificado")
- **Inspiración:** Arbor Parent App (UK) — 15 000 escuelas
- **Estimación:** 12-16 h
- **Cierra dolor:** cuaderno de control firmado a mano

### 1.2 Trámites en línea con IA
- Padre solicita: constancia de estudios, matrícula, permiso para salir temprano, etc.
- Secretaría aprueba/rechaza
- IA rellena la plantilla Word institucional automáticamente (reutiliza infra Word que ya tenemos)
- **Inspiración:** e-Estonia
- **Estimación:** 14-20 h
- **Diferencial:** frente a IE que aún imprime FUT

### 1.3 Dashboard familiar móvil (PWA)
- Un solo panel para padres: asistencia hoy, últimas notas, comunicados nuevos, próximas fechas, logros
- PWA con push notifications (no requiere app nativa en Play Store)
- **Inspiración:** Alexia Familia
- **Estimación:** 10-14 h

### 1.4 [WOW] Reporte semanal narrativo generado por IA
- Cada domingo, la IA lee asistencia + comunicados + eventos + participación de la semana y redacta un párrafo humano al padre en **español coloquial peruano (o quechua)**
- Ejemplo: *"Esta semana Juan asistió los 5 días. Se destacó por participación en Matemáticas. Recordarle: reunión de padres el sábado."*
- Enviado por WhatsApp Business API (opcional en fase 1: solo en la app)
- **Ningún SIS occidental lo hace en 2026** — diferenciador radical
- **Estimación:** 24-32 h (con WhatsApp) o ~10 h (solo en app)

---

## Nivel 2 — Diferenciadores internacionales (post-primer deploy)

Features que sistemas maduros de otros países usan y **son factibles** en 1-3 días cada una.

### 2.1 Registro de logros / kudos (contrapeso positivo a Incidencias)
- Docente premia con clic: "liderazgo", "puntualidad", "solidaridad", "esfuerzo"
- Padre lo ve en su dashboard familiar
- Contrapeso al módulo Incidencias (hoy solo registrás lo malo)
- **Inspiración:** ClassDojo — evidencia: baja conducta disruptiva, sube engagement
- **Estimación:** 12-16 h

### 2.2 Reservas de recursos (AIP, laboratorio, proyector, cañón)
- Calendario compartido tipo Google Calendar interno
- Docente reserva "2 horas del AIP el jueves 3-5 pm"
- **Inspiración:** Fedena / Gibbon
- **Cierra dolor peruano real:** se pelean el proyector por WhatsApp
- **Estimación:** 8-12 h

### 2.3 Chat interno docente ↔ tutor ↔ director
- Estilo Slack simplificado con canales por aula/grado
- Hilos por estudiante (histórico institucional del caso)
- **Inspiración:** Wilma (Finlandia), eKool (Estonia)
- **Reemplaza:** los 15 grupos de WhatsApp caóticos que tiene toda IE hoy
- **Estimación:** 14-18 h

### 2.4 Portafolio digital del alumno por competencia CNEB
- Tutor sube evidencias (foto/PDF/video corto) etiquetadas por competencia del Currículo Nacional
- Padre lo ve en línea
- **Encaja con evaluación formativa por competencias que exige MINEDU**
- **Inspiración:** ClassDojo Portfolios + Additio App
- **Estimación:** 16-24 h

### 2.5 Encuestas anónimas de clima escolar (mensuales)
- 5 preguntas por rol (estudiante, docente, padre)
- IA sintetiza tendencias para dirección
- Alimenta indicadores CGE (Compromiso 5: convivencia)
- **Inspiración:** Arbor Surveys
- **Estimación:** 8-10 h

### 2.6 Alertas de riesgo académico con IA
- Cron diario: si asistencia < 80% en 3 semanas o hay 2+ incidencias, IA genera alerta al tutor con recomendación
- **Literatura:** modelos AI dropout prediction 84-93% accuracy con datos que ya capturamos
- **Reutiliza:** pipeline IA existente
- **Estimación:** 10-14 h

---

## Nivel 3 — Cumplimiento normativo peruano (para presentar a UGEL/MINEDU)

### 3.1 Registro Auxiliar Digital por Competencias 2025
- Docente registra 1 vez, exporta CSV/Excel al formato SIAGIE cuando abra
- Formato oficial: registro auxiliar 2025 con competencias, evidencias, notas descriptivas
- **Cierra dolor #1 y #2 del research:** trabajar hasta madrugada por cierre bimestral SIAGIE
- **Estimación:** 20-30 h (grande — es su propio módulo)

### 3.2 Exportador a plantillas SIAGIE oficiales
- Nómina de matrícula (FUM)
- Nóminas de asistencia mensual
- Acta consolidada bimestral
- Se genera Excel con el formato exacto que SIAGIE acepta
- **Estimación:** 12-18 h

### 3.3 Informe de Semana de Gestión con IA
- Director marca actividades ejecutadas por comité (Condiciones Operativas, Pedagógico, Bienestar)
- IA arma el Word para UGEL con formato oficial
- Se ejecuta 5 veces al año
- **Reutiliza:** infra IA de reporte mensual
- **Estimación:** 8-12 h

### 3.4 Reporte trimestral a UGEL con IA
- Balance de gestión + ingresos + egresos + avance CGE
- Formato oficial que pide UGEL Huánuco
- IA redacta la narrativa
- **Estimación:** 10-14 h

### 3.5 Tablero de los 5 Compromisos de Gestión Escolar (CGE 2025-2026)
- Compromiso 1: Progreso de aprendizajes (indicador desde SIAGIE)
- Compromiso 2: Acceso y permanencia (retención) — desde asistencia
- Compromiso 3: Calendarización y gestión del tiempo — desde horas efectivas
- Compromiso 4: Acompañamiento y monitoreo docente — desde visitas subdirector
- Compromiso 5: Gestión de la convivencia escolar — desde SíseVe ✅
- **Estimación:** 12-16 h

### 3.6 Registro CONEI + APAFA
- Actas de reuniones mensuales
- Acuerdos con seguimiento
- Padres delegados vinculados
- Publicación en vitrina institucional
- **Base legal:** Ley 28628 (APAFA) + reglamento modificado 2025
- **Estimación:** 14-20 h

### 3.7 Enlace de recursos PerúEduca
- La app enlaza (no duplica) recursos de PerúEduca por área/grado
- Docente busca material desde el mismo panel
- **Estimación:** 6-8 h

---

## Nivel 4 — Diferenciadores tecnológicos avanzados

### 4.1 WhatsApp Business API para padres
- Notificaciones a padres via WhatsApp (donde ya están todos)
- Templates aprobados por Meta
- Bidireccional: padre puede responder "OK" a comunicados sin abrir la app
- **Estimación:** 20-30 h (incluye setup + aprobación Meta)
- **Costo:** ~US$ 0.05 por mensaje después de 1000 gratis/mes

### 4.2 Chatbot para padres 24/7 en español peruano
- Padre pregunta "¿cuándo es la reunión?" y la IA responde consultando la BD
- Sin colas ni tiempos de espera
- **Estimación:** 12-16 h

### 4.3 Firma digital simple con QR de verificación
- Constancias emitidas por la app llevan QR
- Escaneás el QR y valida contra la BD
- **NO tiene validez legal RENIEC** — pero sirve para uso interno
- **Estimación:** 8-12 h

### 4.4 Estudiante como usuario (Fase 2)
- Panel del estudiante con: sus notas, comunicados, recursos de sus áreas, portafolio
- Cambio de contraseña, recuperación
- **Estimación:** 20-30 h

### 4.5 UGEL / DRE como consumidor (Fase 3)
- Dashboard agregado con datos de la IE
- Exportación automática a los formatos que UGEL pide
- Integración vía API con sistemas UGEL cuando existan
- **Estimación:** 20-30 h

---

## Descartar (justificado)

Cosas que suenan bien pero **no valen la pena** en el contexto de una IE pública peruana:

- ❌ **Cafetería / almuerzos gestionados** — Qali Warma reparte, no hay operación de venta. Cero ROI.
- ❌ **Transporte escolar (rutas, choferes)** — irrelevante: alumnos caminan o vienen en combi pública.
- ❌ **Firma digital RENIEC/PKI** — requiere burocracia y costo enorme, uso interno con QR (feature 4.3) es "suficientemente legal".
- ❌ **Biometría facial de asistencia** — cara, choca con Ley 29733 (dato sensible de menores).
- ❌ **LMS tipo Google Classroom** — Google Classroom es gratis, no lo reemplaces.
- ❌ **Gamificación tipo ClassDojo full** — no funciona en secundaria, docentes lo ven infantil. Kudos simples (feature 2.1) sí.
- ❌ **Módulo financiero/pensiones** — IE pública, no cobra.
- ❌ **Reemplazar SIAGIE** — obligatorio por norma MINEDU. Complementar sí, reemplazar no.

---

## Priorización estratégica sugerida

### Para el demo con Baldeón (esta semana)
Lo actual está más que suficiente. **Nada nuevo requerido.**

### Para el uso real por el director (post-demo)
Mínimo indispensable:
1. **1.1** Bandeja de justificaciones (padres reportan)
2. **1.3** Dashboard familiar (padres ven todo)
3. **3.3** Semana de Gestión con IA (5 informes al año que hoy hace a mano)

### Para presentación formal a UGEL Huánuco / GOREHCO (post-curso)
Sumar del Nivel 3:
4. **3.5** Tablero 5 CGE
5. **3.2** Exportador SIAGIE
6. **3.4** Reporte trimestral UGEL con IA

### Para diferenciar frente a competencia comercial (Alexia/Colegium)
Sumar:
7. **1.4** Reporte semanal narrativo con IA (idea wow)
8. **2.1** Kudos positivos
9. **2.3** Chat interno docente↔tutor↔director
10. **4.1** WhatsApp Business API

---

## Referencias del research (para justificar cada feature)

- **SUTEP** — SIAGIE la pesadilla del docente
- **RM 501-2025-MINEDU** — Norma Técnica Año Escolar 2026
- **RM 189-2021-MINEDU** — 5 Compromisos de Gestión Escolar
- **Ley 29733 + DS 003-2013-JUS** — Protección de datos de menores
- **Fallo PJ 2024** — Directores respondan civilmente por casos de bullying no atendidos
- **Wilma (Finlandia)** — 95% de escuelas del país
- **Arbor (UK)** — 15 000 escuelas
- **e-Estonia** — modelo digital de referencia mundial
- **ClassDojo** — evidencia académica de kudos positivos
- **Alexia (España)** — dashboard familiar
- **Fedena/Gibbon** — open source, reservas de recursos

---

*Este roadmap se debe revisar cada 2-4 semanas y ajustar según:*
- *Feedback de usuarios reales (director, docentes, padres) al usar la app*
- *Cambios normativos MINEDU*
- *Prioridades del cliente piloto (I.E. César Vallejo + Gobierno Regional Huánuco)*
