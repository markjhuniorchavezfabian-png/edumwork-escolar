export type TipoIncidencia =
  | "proyector"
  | "pc"
  | "red"
  | "pizarra"
  | "impresora"
  | "otro";

export type PrioridadIncidencia = "alta" | "media" | "baja";

export type EstadoIncidencia = "nueva" | "en_atencion" | "resuelta" | "cerrada";

export interface Incidencia {
  id: number;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  tipo: TipoIncidencia;
  prioridad: PrioridadIncidencia;
  estado: EstadoIncidencia;
  reportado_por: number;
  reportado_por_nombre?: string;
  asignado_a: number | null;
  asignado_a_nombre?: string | null;
  creado_en: string;
  actualizado_en: string;
  fecha_atencion: string | null;
  fecha_resolucion: string | null;
  notas_admin: string;
  solucion: string;
  foto?: string | null;
  estudiante_afectado?: number | null;
  estudiante_afectado_nombre?: string | null;
}

export interface ComentarioIncidencia {
  id: number;
  incidencia: number;
  autor: number;
  autor_nombre: string;
  autor_rol: string;
  texto: string;
  creado_en: string;
}

export interface NuevaIncidencia {
  titulo: string;
  descripcion: string;
  ubicacion: string;
  tipo: TipoIncidencia;
  prioridad: PrioridadIncidencia;
  estudiante_afectado?: number | null;
}

export interface KPIsIncidencias {
  total: number;
  por_estado: Record<EstadoIncidencia, number>;
  por_tipo: Record<TipoIncidencia, number>;
  por_prioridad: Record<PrioridadIncidencia, number>;
  tiempo_promedio_resolucion_horas: number;
  por_ubicacion_top5: Array<{ ubicacion: string; count: number }>;
}

export const TIPO_LABEL: Record<TipoIncidencia, string> = {
  proyector: "Proyector",
  pc: "Computadora",
  red: "Red / Conectividad",
  pizarra: "Pizarra digital",
  impresora: "Impresora",
  otro: "Otro",
};

export const PRIORIDAD_LABEL: Record<PrioridadIncidencia, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const ESTADO_LABEL: Record<EstadoIncidencia, string> = {
  nueva: "Nueva",
  en_atencion: "En atención",
  resuelta: "Resuelta",
  cerrada: "Cerrada",
};
