# Investigación — Formatos oficiales MINEDU / SIAGIE

Fecha: 2026-07-23
**Base normativa VIGENTE (actualizado 2024):**
- **RVM N° 094-2020-MINEDU** (base original)
- **RVM N° 048-2024-MINEDU** (MODIFICA la 094 — vigente desde 30-abr-2024)
- Anteriores (RVM 193-2020, 334-2021) eran normas de emergencia COVID, ya superadas

## 🔥 CAMBIOS CRÍTICOS con RVM 048-2024

### 1. Escala unificada AD / A / B / **C** para TODOS los niveles y grados de EBR

Antes yo pensaba que Secundaria 3°-5° usaba escala vigesimal 11-20 y que la C no existía. **Falso**. Con la modificación 2024:
- **Todos los grados** (inicial ciclo II, primaria, secundaria) usan AD/A/B/C
- La C **sí existe** y es válida
- La escala vigesimal antigua solo se mantiene para estudiantes que cursaron 2°-5° antes de 2020 (histórico)

### 2. Conclusiones descriptivas — reglas por nivel

| Nivel | Cuándo es OBLIGATORIA |
|---|---|
| **Inicial ciclo II** (3-5 años) | Si NL = A, B o C |
| **Primaria** | Si NL = B o C |
| **Secundaria** | Si NL = C |
| Cualquier caso | Opcional para los otros NL |

Regla adicional: **si un estudiante obtiene C en 2 o más periodos consecutivos**, el docente **debe sustentar en la conclusión descriptiva por qué no hay avance**.

### 3. Conversión oficial letras → puntos (para orden de mérito y calificativo)

```
C  → 1
B  → 2.5
A  → 3
AD → 4
```

**Calificativo por área** (fórmula oficial 2024):
```
calif = (Σ puntos_competencias / (n_competencias × 4)) × 10
```
Rango: **2.5 a 10** (mínimo aprobatorio equivalente a "B" en todo).

### 4. Conversión escala vigesimal antigua → nueva escala 2.5-10

Fórmula: `R = (3V/8) + 2.5`

| Vigesimal (V) | Escala 2024 (R) |
|---|---|
| 20 | 10.000 |
| 15 | 8.125 |
| 11 (mínimo aprobatorio) | 6.625 |
| 10 | 6.250 |
| 5 | 4.375 |
| 0 | 2.500 |

### 5. Reglas de promoción/permanencia (Secundaria)

**Grados 1°, 3°, 4°:**
- **Promovido**: alcanza B en la mitad o más de las competencias de cada área/taller. Puede tener C en TODAS las competencias de 1 área (subsanable hasta dic. del año siguiente).
- **Permanece**: C en la mitad o más de las competencias en 4 o más áreas/talleres.
- **Recuperación pedagógica**: no cumple promoción ni permanencia.

**Grados 2° y 5°:**
- **Promovido**: alcanza A o AD en la mitad o más de las competencias en 3 áreas Y B en las demás.
- **Permanece**: C en la mitad o más de las competencias en 4 o más áreas.

## 📄 Formato oficial del Informe de Progreso 2025 (SIAGIE)

Basado en muestra real de un colegio Ronald Fisher (Arequipa, 2025):

**Cabecera:**
- DRE (Dirección Regional de Educación)
- UGEL
- Nivel
- Código Modular
- Institución educativa
- Grado / Sección / Aula
- Apellidos y nombres del estudiante
- Código del estudiante
- DNI
- Apellidos y nombres del docente o tutor

**Tabla principal** (una fila por competencia):
- Área curricular
- Competencia
- Bimestre 1 (NL + Conclusión descriptiva)
- Bimestre 2 (NL + Conclusión descriptiva)
- Bimestre 3 (NL + Conclusión descriptiva)
- Bimestre 4 (NL + Conclusión descriptiva)
- NL alcanzado al finalizar el período lectivo

**Sección aparte de Competencias Transversales:**
- Se desenvuelve en entornos virtuales generados por las TIC
- Gestiona su Aprendizaje de manera autónoma

**Leyenda oficial de NL** (que va al pie del informe):
- **AD — LOGRO DESTACADO**: "Cuando el estudiante evidencia un nivel superior a lo esperado respecto a la competencia. Esto quiere decir que demuestra aprendizajes que van más allá del nivel esperado."
- **A — LOGRO ESPERADO**: "Cuando el estudiante evidencia el nivel esperado respecto a la competencia, demostrando manejo satisfactorio en todas las tareas propuestas y en el tiempo programado."
- **B — EN PROCESO**: "Cuando el estudiante está próximo o cerca al nivel esperado respecto a la competencia, para lo cual requiere acompañamiento durante un tiempo razonable para lograrlo."
- **C — EN INICIO**: "Cuando el estudiante muestra progreso mínimo en una competencia de acuerdo al nivel esperado. Evidencia con frecuencia dificultades en el desarrollo de las tareas, por lo que necesita mayor tiempo de acompañamiento e intervención del docente."

**Registro de Inasistencia/Tardanzas** (por bimestre):
- Justificadas
- Injustificadas

**Pie:**
- Comentario General
- Situación al finalizar el período lectivo
- Firma del Docente o Tutor(a)
- Firma y sello del Director(a)
- Fecha de Emisión
- Versión del SIAGIE: 2025.1

## 📋 Formato de plantilla Excel SIAGIE (para carga masiva)

### Nombre del archivo (RÍGIDO — no cambiar):

`RegNotasFinales_[CodModular]_[CodDC]_[Nivel]_[Año]_[Grado]_[Sección]_[NumControl].xls`

### Extensión obligatoria: `.xls` (Excel 97-2003), NO `.xlsx`

### Estructura del libro:

**Hoja 1: `Generalidades`** (read-only, con datos IE)

**Hoja 2: `NF` (Notas Finales)**:

| ID | CodEstudiante | Nombres | Comp01 NL | Comp01 Concl. | Comp02 NL | Comp02 Concl. | ... |
|---|---|---|---|---|---|---|---|

**Valores válidos en NL** (según nivel):
- Inicial 3-5 / Primaria / Secundaria: `AD`, `A`, `B`, `C`
- Inicial 0-2 años: solo comentarios

**Si el estudiante no logró desarrollar la competencia**, usar en lugar de NL:
- `Comentario 1` = No se logró realizar acciones para su desarrollo
- `Comentario 2` = No se cuenta con evidencia suficiente para determinar el nivel de logro
- `Comentario 3` = Otro

### Áreas de comunicación separadas en SIAGIE:

Nueva regla (RVM 048-2024): SIAGIE tiene 3 columnas separadas para comunicación, cada IE decide cuáles llenar según su modalidad:

a) **Comunicación en lengua materna** — castellano o lengua originaria
b) **Comunicación en segunda lengua** — castellano, lengua originaria o idioma extranjero no inglés
c) **Inglés como lengua extranjera / Inglés** — según modalidad

## 📊 Acta consolidada de evaluación

- Una acta por sección al cierre del año
- Formato PDF con sello de agua "Borrador" hasta ser oficial
- Se remite en paquetes a UGEL/DRE
- Contiene: consolidado de NL por competencia por estudiante + situación final (promovido/permanece/recuperación)
- **Reglas de promoción se aplican automáticamente** al cierre — no editable manualmente

## 🎯 Gaps y prioridades para nuestro sistema (Sistema TIC — Cesar Vallejo)

### Gap 1: Escala de calificación

| Aspecto | Nuestro sistema | Requerido MINEDU 2024 |
|---|---|---|
| AD/A/B/C | ✓ Ya lo tenemos | ✓ Correcto |
| Numérica 0-20 | ✓ Ya lo tenemos | Solo para uso interno o histórico |
| Conversión letra→puntos oficial | ❌ Usamos AD=19, A=15, B=12, C=8 | **Debemos usar AD=4, A=3, B=2.5, C=1** |
| Cálculo calificativo por área | ❌ No implementado | Fórmula oficial `(Σ/n×4) × 10` → 2.5-10 |
| Orden de mérito | ❌ No implementado | SIAGIE lo calcula automáticamente |

### Gap 2: Conclusiones descriptivas

| Regla | Nuestro sistema | Requerido MINEDU 2024 |
|---|---|---|
| Obligatoria si NL = C | ✓ | ✓ |
| Obligatoria si NL = B (primaria) | ❌ Falta validación | ⚠️ Obligatorio |
| Obligatoria si NL = A/B/C (inicial 3-5) | ❌ | ⚠️ Obligatorio |
| Sustentar si C en 2+ periodos consecutivos | ❌ | ⚠️ Obligatorio |

### Gap 3: Reglas de promoción

Actualmente el sistema no calcula automáticamente si el estudiante está promovido/permanece/recuperación. **SIAGIE lo hace**, pero podríamos anticiparlo internamente para alertar al director.

### Gap 4: Export SIAGIE

| Aspecto | Estado | Cambio requerido |
|---|---|---|
| Extensión de archivo | `.xlsx` | `.xls` (obligatorio) |
| Nombre de archivo | Genérico | Estricto `RegNotasFinales_...` |
| Hoja `Generalidades` | No existe | Obligatoria |
| Hoja `NF` con estructura MINEDU | Similar | Requiere columnas exactas |
| Mapeo C → Comentario | No | Opcional (permitido usar C directo) |

### Gap 5: Informe de progreso oficial

**Nuestro sistema**: informe con IA que es más pedagógico y descriptivo.
**MINEDU exige**: formato específico con tabla estructurada bimestre × competencia.

Recomendación: mantener nuestro informe interno (mejor) y AGREGAR export en formato oficial SIAGIE para cumplimiento normativo.

## 📌 Prioridades sugeridas para implementar

**Prioridad 1 — cumplimiento normativo esencial (2 semanas):**
1. Validación obligatoria de conclusión descriptiva según NL (por nivel):
   - Inicial 3-5: obligatorio si NL ∈ {A, B, C}
   - Primaria: obligatorio si NL ∈ {B, C}
   - Secundaria: obligatorio si NL = C
2. Alerta si estudiante tiene C en 2+ periodos consecutivos y falta sustento

**Prioridad 2 — export SIAGIE compliant (1-2 semanas):**
3. Generar `.xls` con nombre de archivo estricto
4. Hoja `Generalidades` con datos de la sección
5. Hoja `NF` con estructura exacta MINEDU
6. Botón "Descargar plantilla SIAGIE" en Registro de notas

**Prioridad 3 — cálculo automático de promoción/permanencia (1 semana):**
7. Al cierre de bimestre 4, calcular situación de cada estudiante según RVM 048-2024
8. Panel de alertas al director: estudiantes en riesgo de permanencia

**Prioridad 4 — informe de progreso oficial (1 semana):**
9. Export en PDF con formato MINEDU (tabla bimestre × competencia + leyenda)
10. Sección de asistencia/tardanzas por bimestre
11. Firma del docente + director + fecha emisión

**Prioridad 5 — acta consolidada oficial (2 semanas):**
12. PDF por sección con formato SIAGIE
13. Aplicación automática de reglas de promoción

## 🎓 Estrategia final propuesta

Nuestro sistema debe **coexistir** con SIAGIE:

| Función | Sistema TIC (nuestro) | SIAGIE (gobierno) |
|---|---|---|
| Registro diario de notas | ✓ Principal (mejor UX) | ❌ (solo cierre anual) |
| Boletas para padres | ✓ Diseño bonito, WhatsApp | ❌ (feas) |
| Informe con IA | ✓ Retroalimentación pedagógica | ❌ |
| Analytics para director | ✓ Dashboards, tendencias | ❌ Limitado |
| Alertas académicas | ✓ Real-time | ❌ |
| Sube al SIAGIE (Excel) | ✓ Genera formato compatible | Recibe |
| Acta consolidada oficial | Genera vista previa | ✓ Emite oficial |
| Certificado de estudios | ❌ | ✓ Único válido |

**El valor de nuestro sistema**: es el registro diario superior + retroalimentación con IA + analytics. **El puente al SIAGIE** es solo para cumplir el requisito legal sin re-tipear datos.

## Siguiente paso del sprint

- **Paso 3**: definir el diseño concreto de cada mejora prioritaria (ver mockups o especificar cambios de código)
- **Paso 4**: implementar Prioridad 1 (validación conclusión descriptiva) — es lo más rápido y de mayor impacto
- **Paso 5**: implementar Prioridad 2 (export SIAGIE compliant)
