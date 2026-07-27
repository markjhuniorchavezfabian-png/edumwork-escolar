# Roadmap Sprint 3 (versión futura de la app)

Fecha planificación: 2026-07-23
Base normativa: RM 556-2024-MINEDU + RVM 046-2025-MINEDU + Ley 30797 (inclusión)

## Objetivo Sprint 3

Diferenciar la app del SIAGIE oficial agregando features pedagógicas que MINEDU **recomienda pero no exige**, y que los docentes/directores necesitan pero no tienen en el sistema oficial.

## Alcance

**Duración estimada:** 3-4 semanas de desarrollo full-time.

### Feature 1 — Bienestar socioemocional (12-15 días)

**Motivación:** RM 556-2024 prioriza el "bienestar socioemocional" como línea de acción del año 2025, pero no proporciona herramientas. Los docentes/tutores hoy hacen esto en cuadernos personales sin trazabilidad.

**Backend:**
- Modelo `EncuestaBienestar`:
  - `titulo`, `descripcion`
  - `dimensiones`: emocional, social, académica, familiar
  - `preguntas` (JSON con opciones tipo Likert 1-5 o emojis 😊 😐 😢)
  - `frecuencia`: semanal, bimestral, ondemand
  - `nivel_aplicable`: inicial | primaria | secundaria
- Modelo `RespuestaBienestar`:
  - `estudiante`, `encuesta`, `fecha`, `respuestas` (JSON)
  - `score_emocional`, `score_social`, etc. (calculado)
  - `alerta_generada` bool
- Endpoint `POST /bienestar/responder/`
- Endpoint `GET /bienestar/panel-tutor/?seccion=X` — heatmap por estudiante
- Endpoint `GET /bienestar/alertas/` — estudiantes con caída brusca
- Algoritmo: si score < 2.5/5 → alerta ámbar; si < 1.5/5 → alerta roja + notif tutor
- Vinculación con `convivencia.CasoConvivencia` → auto-crear caso si signals fuertes de bullying/violencia

**Frontend:**
- Vista `/bienestar` para estudiante (llenar encuesta desde app o link enviado por WhatsApp)
- Vista `/bienestar/tutor` con heatmap sección × estudiante × dimensión (colores del más rojo al más verde)
- Vista `/bienestar/director` con evolución por sección
- Modal alerta cuando estudiante marca respuestas críticas (ideación suicida, violencia hogar)

### Feature 2 — Comité Escolar de Aula (3-5 días)

**Motivación:** RVM 046-2025-MINEDU obliga elegir Comité Escolar de Aula al inicio del año. Hoy los colegios lo hacen a mano en papel.

**Backend:**
- Modelo `ComiteAula`:
  - `seccion`, `anio_lectivo`, `activo`
  - `estado`: preparacion | eleccion_activa | electo | disuelto
- Modelo `Cargo` (Presidente, Vicepresidente, Secretario, Vocal 1, Vocal 2)
- Modelo `Candidato`:
  - `comite`, `estudiante`, `cargo`, `plan_trabajo` (texto)
- Modelo `Voto`:
  - `comite`, `elector` (estudiante), `candidato`, `cargo`, `timestamp`
  - Voto secreto (hash + salt en almacenamiento)
- Modelo `MiembroComite` (resultado final)

- Endpoint `POST /comite/abrir-eleccion/` (docente/tutor)
- Endpoint `POST /comite/votar/`
- Endpoint `POST /comite/cerrar-eleccion/` (auto-calcula ganadores)
- Endpoint `GET /comite/{seccion}/miembros/` (los electos)

**Frontend:**
- Vista tutor: abrir elección, inscribir candidatos, cerrar
- Vista estudiante: seleccionar candidato por cargo (validar solo 1 voto por cargo)
- Vista pública: miembros electos con foto + plan de trabajo
- Vinculación con módulo Convivencia (los presidentes/vocales participan en el CGB para casos de aula)

### Feature 3 — Educación inclusiva (5-7 días)

**Motivación:** RM 556-2024 prioriza inclusión + Ley 30797 exige ajustes razonables para estudiantes con discapacidad.

**Backend:**
- Nuevos campos en `Estudiante` (o modelo relacionado `PerfilInclusivo`):
  - `necesita_apoyo_educativo`: bool
  - `tipo_discapacidad`: choice (visual, auditiva, motora, cognitiva, comunicacion, otro, ninguna)
  - `dificultad_aprendizaje`: text (dislexia, TDAH, etc.)
  - `ajustes_razonables`: text (más tiempo en evaluaciones, materiales adaptados, etc.)
  - `apoyo_profesional_externo`: bool (psicólogo, terapista de lenguaje)
  - `plan_educativo_personalizado`: FileField (PDF)

- Endpoint `GET /inclusion/mis-estudiantes/?seccion=X` (docente ve solo los suyos)
- Endpoint `GET /inclusion/estadisticas/` (director) — nro por tipo, por sección
- Auto-notificar al docente al inicio de bimestre: "Tenés N estudiantes con apoyo educativo en tu sección"

**Frontend:**
- Nueva sección en `Ficha del estudiante` con campos de inclusión (colapsable por default)
- Badge visual en la lista de estudiantes / registro de notas cuando tienen apoyo
- Cuando el docente abre panel de nota de estudiante con apoyo, mostrar tarjeta con:
  - Tipo de discapacidad
  - Ajustes razonables sugeridos
  - Recomendaciones automáticas de la IA (opcional)
- Filtro en boletas: agregar comentario específico automático por tipo de apoyo

### Extras (si sobra tiempo del sprint)

**Feature 4 — Reglas automáticas de promoción (1 semana):**
- Al cierre del bimestre 4, calcular situación de cada estudiante según RVM 048-2024
- Panel del director: estudiantes en promoción / permanencia / recuperación
- Alertas anticipadas (bimestre 3): "N estudiantes en riesgo de permanencia"

**Feature 5 — Export SIAGIE compliant real (1 semana):**
- Generar `.xls` (no .xlsx) con nombre estricto `RegNotasFinales_...`
- Hoja `Generalidades` obligatoria
- Hoja `NF` con estructura exacta MINEDU
- Docente lo descarga y sube directo a SIAGIE sin re-tipear

**Feature 6 — Acta consolidada oficial (2 semanas):**
- PDF por sección con formato MINEDU exacto
- Aplicación automática de reglas de promoción
- Sello del director + fecha de emisión
- Vista previa antes de generar oficial

## Priorización sugerida cuando llegue el momento

1. **Educación inclusiva** primero (cumplimiento legal + fácil)
2. **Comité Escolar de Aula** después (obligatorio anual, poco esfuerzo)
3. **Bienestar socioemocional** al final (diferenciador comercial)
4. Extras 4-5-6 según necesidad del colegio piloto

## Cambios en la infraestructura

Nada crítico. Solo:
- Considerar migración a base de datos separada para bienestar (privacidad reforzada de datos socioemocionales)
- Backup automático en la nube para PDFs de planes educativos personalizados
- Auditoría reforzada en accesos a datos inclusivos (loguear quién ve qué)

## Costos externos estimados

- Bienestar socioemocional podría requerir asesoría psicopedagógica ~S/2000 para validar el cuestionario
- Diseño gráfico de las encuestas para estudiantes ~S/500

## KPIs de éxito Sprint 3

- 90% de estudiantes con encuesta de bienestar respondida al menos 1 vez/bimestre
- 100% de aulas con Comité Escolar elegido al inicio del año
- 100% de estudiantes con apoyo educativo identificado y con ajustes razonables documentados

---

## Sprint 4+ (más futuro)

- Módulo Aula Virtual completo (LMS con clases grabadas)
- Comunicación bidireccional padres-docentes (chat vs solo comunicados)
- Analytics predictivo con IA para riesgo académico
- Multi-institución (SaaS para varios colegios en un solo despliegue)
- App mobile nativa (React Native / Flutter)
- Integración con GLPI (mesa de ayuda TIC)
