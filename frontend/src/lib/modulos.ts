/**
 * Catálogo de módulos que se pueden activar/desactivar por I.E.
 * Módulos "core" (asistencia, comunicados, notas, incidencias, justificaciones,
 * usuarios/secciones/estudiantes/docentes) NO están acá porque son obligatorios.
 */

export interface Modulo {
  id: string;
  label: string;
  descripcion: string;
  rutas: string[];  // rutas del sidebar afectadas
  defaultActivo: boolean;
}

export const MODULOS_OPCIONALES: Modulo[] = [
  {
    id: "aula_virtual",
    label: "Aula Virtual",
    descripcion: "Cursos, lecciones, tareas y entregas. Alumnos y padres pueden verlo.",
    rutas: ["/aprender"],
    defaultActivo: true,
  },
  {
    id: "ambientes",
    label: "Ambientes y QR",
    descripcion: "Registrar aulas, laboratorios, biblioteca. Bitácora de uso con QR.",
    rutas: ["/ambientes"],
    defaultActivo: true,
  },
  {
    id: "sesiones_clase",
    label: "Sesiones de clase (laboratorios)",
    descripcion: "Docentes registran sesiones en ambientes especiales con asistencia.",
    rutas: ["/sesiones-clase"],
    defaultActivo: true,
  },
  {
    id: "reservas",
    label: "Reservas de ambientes",
    descripcion: "Docentes reservan aulas/labs para actividades especiales.",
    rutas: ["/reservas"],
    defaultActivo: true,
  },
  {
    id: "inventario",
    label: "Inventario TI",
    descripcion: "Registro y control de equipos TIC (proyectores, PCs, impresoras).",
    rutas: ["/inventario"],
    defaultActivo: true,
  },
  {
    id: "convivencia",
    label: "Convivencia (SíseVe)",
    descripcion: "Protocolos MINEDU para casos de convivencia con plazos legales.",
    rutas: ["/convivencia"],
    defaultActivo: true,
  },
  {
    id: "visitas",
    label: "Control de visitas",
    descripcion: "Registro de portería + gafetes QR + auto-registro por token.",
    rutas: ["/visitas"],
    defaultActivo: true,
  },
  {
    id: "ia",
    label: "Asistente de IA",
    descripcion: "Sugerencias inteligentes en incidencias, análisis de reportes. Requiere API key BYOK.",
    rutas: ["/config-ia", "/mi-ia", "/costos-ia"],
    defaultActivo: true,
  },
  {
    id: "asistencia_personal",
    label: "Asistencia del personal (staff)",
    descripcion: "Marca de entrada/salida del staff (docentes, admin, conserje).",
    rutas: ["/asistencia-personal"],
    defaultActivo: true,
  },
  {
    id: "laboratorio",
    label: "Laboratorio",
    descripcion: "Reserva y control de uso del laboratorio de cómputo.",
    rutas: ["/laboratorio"],
    defaultActivo: false,
  },
  {
    id: "biblioteca",
    label: "Biblioteca",
    descripcion: "Préstamo y devolución de libros.",
    rutas: ["/biblioteca"],
    defaultActivo: false,
  },
  {
    id: "finanzas",
    label: "Administración Financiera",
    descripcion: "Cobranza de pensiones, recibos internos de caja, morosidad y caja chica.",
    rutas: ["/finanzas", "/caja"],
    defaultActivo: true,
  },
  {
    id: "tutoria",
    label: "Tutoría",
    descripcion: "Seguimiento de tutoría y orientación educativa por sección.",
    rutas: ["/tutoria"],
    defaultActivo: false,
  },
];

/**
 * Devuelve true si el módulo está activo.
 * Si la lista de modulos_activos está vacía → asume todo activo (default de I.E. nueva).
 */
export function moduloActivo(modulos: string[], id: string): boolean {
  if (!modulos || modulos.length === 0) return true;
  return modulos.includes(id);
}

/**
 * Dado una ruta, devuelve true si su módulo está activo (o si la ruta no pertenece a
 * ningún módulo opcional — entonces siempre activo).
 */
export function rutaVisible(modulosActivos: string[], ruta: string): boolean {
  const mod = MODULOS_OPCIONALES.find((m) => m.rutas.includes(ruta));
  if (!mod) return true;  // ruta core, siempre visible
  return moduloActivo(modulosActivos, mod.id);
}
