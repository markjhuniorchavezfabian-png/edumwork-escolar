# Sistematic — Preguntas frecuentes para directores

Documento breve para responder por WhatsApp/correo antes de la primera reunión.
Actualizado 2026-07-16.

**Índice**
1. [Sobre el sistema](#1-sobre-el-sistema)
2. [Instalación y primer día](#2-instalación-y-primer-día)
3. [Secciones y niveles educativos](#3-secciones-y-niveles-educativos)
4. [Ambientes y códigos QR](#4-ambientes-y-códigos-qr)
5. [Módulos activables (prender / apagar)](#5-módulos-activables-prender--apagar)
6. [Datos y privacidad](#6-datos-y-privacidad)
7. [Backup y control](#7-backup-y-control)
8. [Precios y modelos comerciales](#8-precios-y-modelos-comerciales)
9. [Preguntas incómodas](#9-preguntas-incómodas)

---

## 1. Sobre el sistema

**¿Qué es Sistematic?**
Un sistema web para gestión escolar: asistencia, notas, boletas PDF (formato MINEDU), aula virtual, convivencia con protocolos SíseVe, comunicación con padres, incidencias TI, inventario, visitas con QR. Alineado a normativa peruana 2026.

**¿Reemplaza a SIAGIE?**
No. SIAGIE sigue siendo la fuente oficial de matrícula y notas. Sistematic **complementa** SIAGIE en el día a día (asistencia diaria, comunicación con padres, aula virtual, gestión interna). Las notas se cargan aquí para generar boletas, la matrícula sigue en SIAGIE.

**¿Funciona en celular?**
Sí. Es una web app responsiva. Docentes marcan asistencia desde el celular, padres consultan asistencia y notas de sus hijos desde el suyo. No hay app para instalar.

**¿Necesita internet?**
Sí. Es un sistema en la nube. Pero como es liviano, funciona con conexiones lentas típicas de I.E. peruanas.

---

## 2. Instalación y primer día

**¿Cuánto tarda instalarlo?**
15-25 minutos en el servidor (script automático) + 1-2 horas de capacitación al director y admin TIC.

**¿Qué necesito antes de la instalación?**
- Un VPS contratado (te ayudamos a elegir según tu I.E. — ver sección 8)
- Nombre completo del colegio + código modular MINEDU
- Un email institucional para recibir alertas

**¿Cómo cargamos a nuestros estudiantes y docentes?**
Descargás la **plantilla Excel** desde el sistema, la llenás con datos de tu SIAGIE (una fila por persona), y la subís. Se crean todos los usuarios de golpe con contraseña inicial autogenerada.

**¿Y si nunca usé un sistema así?**
Hay un **wizard de onboarding** que te lleva paso a paso: institución → secciones → docentes → estudiantes. Si te trabás, mensaje por WhatsApp y te ayudamos.

---

## 3. Secciones y niveles educativos

**Mi colegio es solo primaria. ¿Sirve?**
Sí. Al configurar, marcás solo "Primaria" y aparecen los grados 1ro-6to.

**Mi colegio tiene Inicial + Primaria + Secundaria (integrado). ¿Se puede?**
Sí. Marcás los 3 niveles en el wizard. Cada sección lleva marcado su nivel para que no se mezclen. Por ejemplo, "1ro A primaria" y "1ro A secundaria" conviven sin conflicto.

**¿Puedo tener secciones sin nivel definido?**
Sí, el nivel es opcional. Se recomienda llenarlo en colegios integrados para evitar confusiones.

**¿Puedo mover un estudiante de sección después?**
Sí. Desde "Fichas de estudiantes" cambiás su sección. Sus notas y asistencia previa se conservan.

---

## 4. Ambientes y códigos QR

**¿Qué es un "ambiente"?**
Un **espacio físico** del colegio: aula, laboratorio, biblioteca, sala de docentes, dirección. Es distinto de una **sección** (que es un grupo humano). En turnos mañana/tarde varias secciones pueden usar el mismo ambiente.

**¿Para qué sirven los QR de ambientes?**
Al registrar un ambiente, el sistema genera un **PDF con el QR** listo para imprimir y pegar en la puerta. Cuando un docente escanea el QR con el celular:
- Registra la sesión de clase (docente + sección + hora)
- Al salir, escanea otra vez y cierra la sesión
- Queda bitácora automática: quién usó qué ambiente y cuándo

**¿Sirve para reservas?**
Sí. Un docente puede reservar el laboratorio de química para el jueves 8-10am. El sistema evita superposiciones.

**Mi colegio es chico (2 aulas y patio). ¿Vale la pena?**
Para colegios chicos podés apagar el módulo de Ambientes (ver sección 5). El sistema sigue funcionando sin eso.

---

## 5. Módulos activables (prender / apagar)

**¿Puedo elegir qué funciones tener y cuáles no?**
Sí. En **Configuración → Módulos activos** hay switches para prender/apagar:
- Aula Virtual
- Ambientes y QR
- Sesiones de clase (labs)
- Reservas
- Inventario TI
- Convivencia (SíseVe)
- Control de visitas
- Asistente de IA
- Asistencia del personal

Módulos **core** siempre activos: Usuarios, Secciones, Estudiantes, Docentes, Asistencia, Notas, Comunicados, Incidencias, Justificaciones.

**Si apago un módulo, ¿pierdo la información?**
No. Los datos quedan intactos, solo se ocultan del menú. Si más adelante lo prendés, todo aparece como estaba.

**¿Los usuarios ven que hay módulos desactivados?**
No. El menú lateral se filtra automáticamente y solo muestra lo activo. No hay opciones "grises" ni molestias.

**Ejemplo real:** Una I.E. de inicial (niños de 3-5 años) apaga Aula Virtual (los niños no usan tablets), Convivencia (protocolo se hace en papel), Asistente de IA, Sesiones de clase (no hay labs). Queda un sistema simple con asistencia + comunicados + notas + boletas.

---

## 6. Datos y privacidad

**¿Dónde se guardan los datos de los estudiantes?**
En el servidor que tu I.E. contrata (Modelo D recomendado — ver sección 8). **Los datos no viajan al exterior**. Podés elegir un VPS peruano con factura RUC (SitioHost, HostPerú).

**¿Cumple con la Ley 29733 de protección de datos?**
Sí. Ambos firmamos un contrato de encargado de tratamiento (te lo pasamos). Como el servidor es tuyo, la titularidad de los datos es del colegio.

**¿Los padres pueden ver los datos de otros estudiantes?**
No. Cada padre solo ve la información de **sus hijos** vinculados. Es un requisito de diseño del sistema.

**¿Hay auditoría de accesos?**
Sí. En "Auditoría" el director ve un registro de cambios: quién editó qué, cuándo, y desde qué IP.

---

## 7. Backup y control

**¿Si tu servicio deja de funcionar, pierdo mis datos?**
No. En **Configuración → Backup y restauración** hay un botón "Descargar copia de seguridad" que baja toda la base de datos comprimida (.sql.gz) a tu computadora. Recomendamos hacerlo semanalmente y guardar en Google Drive + USB físico.

**¿Puedo restaurar un backup viejo?**
Sí. Mismo menú, botón "Restaurar desde archivo". Requiere confirmación explícita ("escribí BORRAR TODO") porque es destructivo.

**¿Puedo migrar a otro proveedor si quiero?**
Sí. Descargás el backup, contratás otro VPS, instalás Sistematic (el código está en GitHub público) y restaurás. No hay lock-in técnico.

**¿Puedo pedir el código fuente?**
Es público. El repositorio está en GitHub (te pasamos el link). Cualquier consultor puede continuar el mantenimiento si querés cambiar de proveedor.

---

## 8. Precios y modelos comerciales

**¿Cuánto sale para mi colegio?**
Ingresá cantidad de alumnos, docentes y si van a usar aula virtual con videos en la **calculadora del sistema** (Costo para mi colegio). Te sugiere el servidor y calcula el total.

**¿Qué modelos ofrecen?**

| Modelo | Setup | Mes | Quién controla infra |
|---|---|---|---|
| **A** — Todo administrado | S/400-2000 | S/80-400 | Nosotros |
| **D** — Tu servidor + nuestro mantenimiento (recomendado) | S/400-2000 | S/80-150 mant. + VPS aparte | Tu I.E. |
| **C** — Independiente | S/2000-4000 | Solo VPS | Tu I.E. |

**¿Qué incluye la suscripción mensual?**
- Actualizaciones automáticas del sistema
- Soporte por WhatsApp Business (Lun-Vie 9-6)
- Backups redundantes en Drive
- Monitoreo del servidor

**¿Hay prueba gratis?**
Sí. **30 días de acceso completo a la demo** con datos precargados. El director, docentes, padres y estudiantes prueban todo antes de decidir.

**¿Aceptan factura con RUC?**
Sí. Emitimos factura electrónica SUNAT. Facturable a I.E. públicas, privadas y APAFA.

---

## 9. Preguntas incómodas

**"¿Y si te mueres o dejas el negocio?"**
Descargás el backup y el código está en GitHub. Cualquier consultor puede continuar. No dependés de una persona.

**"¿Y si dejo de pagar la suscripción?"**
El sistema sigue funcionando en tu servidor. Perdés soporte y actualizaciones, pero no acceso ni datos. Podés retomar la suscripción cuando quieras.

**"¿Y si el sistema tiene un bug crítico?"**
En Modelo A y D: revisamos y arreglamos gratis dentro del SLA (48h respuesta, 5 días para el fix típico). En Modelo C: cobrábamos por hora.

**"¿Ustedes pueden ver mis datos?"**
En Modelo D y C: no. Los datos están en tu servidor, sin acceso nuestro. En Modelo A: técnicamente sí (accedemos para mantenimiento), pero contractualmente estamos obligados a no usarlos.

**"¿Y si otro colegio quiere una función nueva?"**
Las mejoras generales entran en las actualizaciones para todos. Personalizaciones específicas (colores, logo, features únicas) se cotizan aparte: S/80-120 la hora o paquete cerrado desde S/3000.

**"¿Cuánto tardan en responder por WhatsApp?"**
Prioridad crítica (sistema caído): 2 horas. Otras consultas: 24 horas hábiles. Fin de semana solo emergencias.

**"¿Puedo probar contigo antes de cerrar contrato?"**
Sí. Te pasamos acceso a la demo, agendamos una llamada de 30 min para mostrarte el flujo real, y te dejamos 30 días para explorar sin compromiso.

---

## Contacto

**Mark Chávez Fabián**
- WhatsApp: +51 988 783 411
- Email: cmarkjhunior@gmail.com
- Landing: https://sistematic-8z7.pages.dev
- Demo: https://oblivion-expediter-atrium.ngrok-free.dev

*Última actualización: 2026-07-16*
