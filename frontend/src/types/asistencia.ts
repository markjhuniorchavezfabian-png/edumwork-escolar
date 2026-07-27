export type EstadoAsistencia = "presente" | "tardanza" | "ausente" | "justificado";

export interface EstudianteLista {
  id: number;
  nombre_completo: string;
  dni: string | null;
  grado: string;
  seccion: string;
  codigo_matricula: string | null;
  usuario_id: number;
}

export interface RegistroAsistencia {
  id: number;
  estudiante: number;
  estudiante_nombre: string;
  estudiante_grado: string;
  estudiante_seccion: string;
  fecha: string;
  estado: EstadoAsistencia;
  hora_llegada: string | null;
  justificacion: string;
  marcado_por: number;
  marcado_por_nombre: string;
  creado_en: string;
}

export interface KPIsAsistencia {
  desde: string;
  hasta: string;
  total_registros: number;
  total_estudiantes: number;
  por_estado: Record<EstadoAsistencia, number>;
  porcentaje_asistencia: number;
  top_ausentes: Array<{ nombre: string; grado: string; seccion: string; ausencias: number }>;
}

export interface HijoAsistencia {
  estudiante_id: number;
  nombre: string;
  grado: string;
  seccion: string;
  total_registros: number;
  porcentaje_asistencia: number;
  por_estado: Record<EstadoAsistencia, number>;
  ultimos_10: RegistroAsistencia[];
}

export const ESTADO_ASISTENCIA_LABEL: Record<EstadoAsistencia, string> = {
  presente: "Presente",
  tardanza: "Tardanza",
  ausente: "Ausente",
  justificado: "Justificado",
};

export const ESTADO_ASISTENCIA_COLOR: Record<EstadoAsistencia, string> = {
  presente: "var(--verde-600)",
  tardanza: "var(--amarillo-600)",
  ausente: "var(--rojo-600)",
  justificado: "var(--azul-600)",
};
