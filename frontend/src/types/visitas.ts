export type MotivoVisita = "apoderado" | "proveedor" | "ugel" | "autoridad" | "entrevista" | "otro";

export interface Visita {
  id: number;
  codigo_gafete: string;
  dni: string;
  nombre_completo: string;
  telefono: string;
  motivo: MotivoVisita;
  motivo_label: string;
  a_quien_visita: string;
  observaciones: string;
  hora_entrada: string;
  hora_salida: string | null;
  dentro: boolean;
  duracion_minutos: number | null;
  registrado_por: number;
  registrado_por_nombre: string;
  creado_en: string;
}

export interface KPIsVisitas {
  hoy: number;
  semana: number;
  mes: number;
  dentro_ahora: number;
  duracion_promedio_minutos: number;
  top_motivos_mes: Array<{ motivo: string; cantidad: number }>;
}

export interface MotivoInfo {
  codigo: MotivoVisita;
  etiqueta: string;
}
