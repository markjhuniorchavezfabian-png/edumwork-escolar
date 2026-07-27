# Normativas MINEDU vigentes que afectan a nuestra app

Fecha actualización: 2026-07-23
Objetivo: identificar TODA la normativa vigente 2024-2026 que afecte los módulos de nuestra app.

---

## 📌 Normativas VIGENTES relevantes (actualizado)

### Evaluación (módulo Notas)
| Norma | Vigencia | Impacto |
|---|---|---|
| **RVM 094-2020-MINEDU** | Base vigente | Registro y evaluación de competencias |
| **RVM 048-2024-MINEDU** | Vigente (modifica 094) | Conversión letra→puntos, promoción automática, conclusiones obligatorias por nivel |

### Año escolar (módulos Asistencia, Calendario)
| Norma | Vigencia | Impacto |
|---|---|---|
| **RM 556-2024-MINEDU** | Vigente 2025 | 160 días lectivos, 8 semanas gestión, prioridades bienestar/inclusión |
| **RM 2026** | ⚠️ Por publicar | Verificar cuando salga (~diciembre 2025) |

### Convivencia y violencia (módulos Convivencia, Incidencias)
| Norma | Vigencia | Impacto |
|---|---|---|
| **RM 383-2025-MINEDU** | ✅ Vigente | **7 protocolos** actualizados de violencia escolar, integración SíseVe |
| **RVM 046-2025-MINEDU** | ✅ Vigente | Elección Comité Escolar de Aula |
| **DS 004-2018-MINEDU** | Vigente | Base: Lineamientos convivencia escolar |
| **Ley 29719** | Vigente | Ley que promueve la convivencia sin violencia |
| **Ley 30364** | Vigente | Prevenir/sancionar violencia contra mujeres y familia |
| **Ley 30403** | Vigente | Prohibición castigo físico y humillante |

### Currículo (módulo Curricula)
| Norma | Vigencia | Impacto |
|---|---|---|
| **RM 281-2016 + modificatorias** | Vigente | CNEB (base — ya seedeado en app) |

### Matrícula (módulo Matrícula)
| Norma | Vigencia | Impacto |
|---|---|---|
| Instructivo Matrícula EBR 2025 | Vigente | Proceso, validación, sync SIAGIE |

---

## 🔥 RM 383-2025 — Detalle de los 7 protocolos

### Protocolos oficiales

| # | Protocolo | Plazo atención | Definición |
|---|---|---|---|
| **01** | Violencia física y/o psicológica **entre estudiantes** | 30 días hábiles | Daño intencional a integridad corporal o daño psicológico |
| **02** | Acoso entre estudiantes (**bullying y ciberbullying**) | 30 días hábiles | Hostigamiento reiterado presencial o digital (redes, IA, apps) |
| **03** | Violencia con **uso de armas** | 20 días hábiles | Armas de fuego o blancas para intimidar, amenazar, agredir |
| **04** | Violencia sexual entre estudiantes | 30 días hábiles | Violación, tocamientos, actos libidinosos, acoso sexual |
| **05** | Castigo físico y humillante (personal IE) | 30 días hábiles | Docente/directivo aplica castigo prohibido |
| **06** | Hostigamiento sexual (personal IE a estudiante) | 30 días hábiles | Violencia sexual por parte de personal educativo |
| **07** | Violencia por **entorno familiar/comunitario** | Del día del hecho | Denuncia a comisaría/fiscalía en el mismo día |

### Actores obligatorios en el Comité de Gestión de Bienestar (CGB)
- **Director de la IE**
- **Responsable de convivencia escolar**
- **Coordinador de tutoría**
- **Responsable de inclusión** (si involucra estudiante con discapacidad)

### Instrumentos oficiales requeridos
1. **Libro de Registro de Incidencias** (obligatorio)
2. **Portal SíseVe** (siseve.minedu.gob.pe) — reporte obligatorio
3. **Actas** de reuniones (con el CGB, con padres, con tutores)
4. **Plan de actividades** de prevención
5. **Informes bimestrales** de seguimiento

### Timeline estándar (para protocolos 01, 02, 04, 05, 06)

| Día | Acción | Responsable |
|---|---|---|
| Día 01 (hecho) | Docente/tutor identifica el hecho e informa al director | Cualquiera |
| Día 02 | Reunión con CGB, medidas de protección + medidas correctivas | Director + Resp. Convivencia |
| Día 02 | Primera reunión con padres/apoderados de involucrados | Director + Resp. Convivencia |
| Día 03 | **Registro en Libro + Portal SíseVe** | Director + Resp. Convivencia |
| Día 04-19 | Actividades prevención + seguimiento tutorías | Docente + tutor |
| Día 04-29 | Reunión evaluación acciones socioemocionales | Director + tutores |
| Cada bimestre | **Informe bimestral** | Director + Resp. Convivencia |

### Timeline Protocolo 03 (armas — más rápido)
- Día 01: informa al director
- Día 02: reunión CGB + retención del arma + comunicación policía
- Día 03: registro Libro + SíseVe
- 20 días hábiles: cierre

### Timeline Protocolo 07 (entorno familiar)
- **En el día**: director denuncia a comisaría/fiscalía/juzgado + informa al padre no involucrado
- Contacto: Línea 100 para orientación
- Registro SíseVe posterior

---

## 🎯 Impacto en nuestro módulo Incidencias/Convivencia

### Gap 1: Estructura de tipos según protocolos oficiales
Hoy nuestro módulo Incidencias tiene tipos genéricos. Necesitamos:
- Enum de **7 tipos** basados en RM 383-2025
- Cada tipo asigna un protocolo específico
- Timeline (día 1, 2, 3, ...) auto-calculado desde fecha del hecho

### Gap 2: Integración SíseVe
- Botón "Reportar a SíseVe" con estado
- Alerta cada día que se acerque al plazo sin registrar
- Bloqueo de cierre del caso si no se registró en SíseVe

### Gap 3: Actores del CGB
- Definir en configuración institucional:
  - Quién es el Responsable de Convivencia Escolar
  - Quién es el Coordinador de Tutoría
  - Quién es el Responsable de Inclusión
- Asignar automáticamente a los casos según protocolo

### Gap 4: Instrumentos requeridos
- Generar automáticamente los **actas** oficiales (docx/pdf con formato)
- Generar el **plan de actividades** con plantilla
- Generar el **informe bimestral** de seguimiento

### Gap 5: Confidencialidad
- Roles con acceso restringido a casos sensibles (Protocolos 03, 04, 06)
- Auditoría de acceso a cada caso

### Gap 6: Alertas y plazos
- Countdown de plazo hábil por protocolo
- Notificaciones al director al aproximarse el plazo
- Escalado a UGEL si vence sin cierre

### Gap 7: Reporte oficial a UGEL/DRE
- Informe bimestral con indicador: "% de casos con atención oportuna según protocolos RM 383-2025"

---

## 🎯 Impacto de RM 556-2024 (año escolar 2025)

### Módulo Calendario/Asistencia (nuevo o mejora)
- Precargar calendario con:
  - **160 días lectivos** mínimos
  - **30 días de gestión** distribuidos en 8 semanas
  - Feriados nacionales (auto-actualizar por año)
  - Bloques de "Semana de Gestión" visibles en el calendario
- Alertas al director si el año escolar no cumple mínimos

### Nuevas prioridades pedagógicas (módulos posibles)
1. **Bienestar socioemocional**:
   - Encuestas periódicas al estudiante
   - Registro de "acompañamiento socioafectivo" por tutor
   - Panel al director con indicadores de bienestar
2. **Educación inclusiva**:
   - Campo en ficha estudiante: "necesita apoyo educativo?"
   - Reporte al docente al inicio de bimestre

### PAT (Plan Anual de Trabajo)
- Módulo para el director gestione el PAT
- Include: calendarización, prioridades, actividades por bimestre

---

## 🎯 Impacto de RVM 046-2025 (Comité Escolar de Aula)

Nuevo requerimiento vigente 2025:
- Cada aula debe **elegir su Comité Escolar** al inicio del año
- Estudiantes eligen representantes (por votación)
- El comité participa en decisiones de convivencia

Módulo posible:
- **Elecciones de Comité de Aula**:
  - Votación electrónica desde app
  - Registro de miembros del comité
  - Vinculación con módulo Convivencia (los representantes participan)

---

## 📊 Impacto priorizado — resumen

| Prioridad | Norma | Módulo | Esfuerzo | Impacto |
|---|---|---|---|---|
| **P1** | RVM 048-2024 | Notas | 2-3 sem | ⚠️ Alto (cumplimiento evaluación) |
| **P1** | RM 383-2025 | Incidencias/Convivencia | 3 sem | ⚠️ Alto (legal, plazos hábiles) |
| **P2** | RM 556-2024 | Calendario | 1-2 sem | Medio |
| **P2** | Instructivo Matrícula | Matrícula | 1 sem | Medio |
| **P3** | Bienestar (RM 556-2024) | Nuevo módulo | 3-4 sem | Alto diferenciador |
| **P3** | RVM 046-2025 | Nuevo (Comité Aula) | 1 sem | Bajo (nice to have) |
| **P3** | Educación inclusiva | Ficha estudiante | 1 sem | Medio |

---

## ⚠️ Cambios que NO hay que hacer (normas superadas)

- No usar RVM 193-2020 ni RVM 334-2021 (emergencia COVID, superadas)
- No usar escala vigesimal 11-20 para AD/A/B/C (post-2020 letras para todo)
- No usar la conversión AD=19, A=15, B=12, C=8 (usar la oficial 048-2024: AD=4, A=3, B=2.5, C=1)
- No basar promoción en "área aprobada con 11" (usar reglas por competencia RVM 048-2024)

---

## 🎓 Recomendación estratégica

**Sprint 1 (próximas 4 semanas)** — Cumplimiento legal
1. Implementar RVM 048-2024 en Notas (Prioridad 1 anterior)
2. **Implementar RM 383-2025 en Incidencias** — protocolos + SíseVe + plazos

**Sprint 2 (siguientes 3 semanas)** — Alineamiento operacional
3. RM 556-2024 en Calendario (semanas lectivas + gestión + feriados)
4. Instructivo Matrícula → validaciones + sync SIAGIE

**Sprint 3 (opcional)** — Diferenciación
5. Módulo Bienestar (dashboards, encuestas, alertas)
6. RVM 046-2025 Comité Escolar de Aula
7. Educación inclusiva

**Al final del año 2026** — verificar si sale nueva RM del año escolar 2027 y ajustar el módulo Calendario.

---

## 🔗 Fuentes verificadas

- RVM 094-2020: gob.pe/institucion/minedu/normas-legales/541161
- RVM 048-2024: cepmm.edu.pe/images/doc2024/RVM0048-2024-EDModificaNormaEvaluacion.pdf
- RM 383-2025: drelp.gob.pe/RM-383-2025-minedu.pdf (protocolos completos en ugelchucuito.edu.pe)
- RM 556-2024: repositorio.minedu.gob.pe/handle/20.500.12799/10756
- SíseVe: siseve.minedu.gob.pe
