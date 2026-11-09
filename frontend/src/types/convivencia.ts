// RM 383-2025-MINEDU · 7 protocolos oficiales + "otro"
export type TipoCaso =
  | "p1_violencia_fisica_psico"
  | "p2_bullying_ciber"
  | "p3_armas"
  | "p4_violencia_sexual"
  | "p5_castigo_fisico"
  | "p6_hostigamiento_sex"
  | "p7_entorno_familiar"
  | "otro";

export type EstadoCaso = "recibido" | "en_atencion" | "derivado" | "cerrado" | "falso";
export type GravedadCaso = "leve" | "moderada" | "grave";

export interface EstudianteRef {
  id: number;
  nombre: string;
  seccion: string;
}

export interface Seguimiento {
  id: number;
  caso: number;
  autor: number;
  autor_nombre: string;
  accion: string;
  accion_label: string;
  detalle: string;
  adjunto: string | null;
  creado_en: string;
}

export interface CasoConvivencia {
  id: number;
  codigo: string;
  tipo: TipoCaso;
  tipo_label: string;
  gravedad: GravedadCaso;
  gravedad_label: string;
  estado: EstadoCaso;
  estado_label: string;
  fecha_hecho: string;
  fecha_reporte: string;
  fecha_limite: string;
  dias_restantes: number;
  alerta_plazo: "ninguna" | "proximo" | "urgente" | "vencido";
  ubicacion: string;
  descripcion: string;
  estudiantes_afectados: number[];
  afectados_detalle: EstudianteRef[];
  hijo_afectado?: string | null;
  estudiantes_agresores: number[];
  agresores_detalle: EstudianteRef[];
  reportado_por: number;
  reportado_por_nombre: string;
  responsable: number | null;
  responsable_nombre: string | null;
  confidencial: boolean;
  reportado_siseve: boolean;
  fecha_reporte_siseve: string | null;
  codigo_siseve?: string;
  registrado_libro_incidencias?: boolean;
  fecha_registro_libro?: string | null;
  responsable_convivencia?: number | null;
  coordinador_tutoria?: number | null;
  responsable_inclusion?: number | null;
  pasos_protocolo?: Array<{
    dia: number | string;
    accion: string;
    completado: boolean;
    fecha: string | null;
    usuario?: string;
  }>;
  seguimientos: Seguimiento[];
  creado_en: string;
}

export interface KPIsConvivencia {
  total: number;
  activos: number;
  cerrados: number;
  urgentes: number;
  vencidos: number;
  por_tipo: Record<string, number>;
  por_gravedad: Record<GravedadCaso, number>;
  reportados_siseve: number;
}
