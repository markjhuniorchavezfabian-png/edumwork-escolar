export type CategoriaComunicado = "academico" | "administrativo" | "actividad" | "recordatorio" | "convocatoria" | "emergencia";
export type AlcanceComunicado = "toda_ie" | "seccion" | "staff" | "padres";

export interface Comunicado {
  id: number;
  titulo: string;
  cuerpo: string;
  categoria: CategoriaComunicado;
  categoria_label: string;
  alcance: AlcanceComunicado;
  alcance_label: string;
  seccion: number | null;
  seccion_nombre: string | null;
  fecha_publicacion: string;
  fecha_evento: string | null;
  autor: number;
  autor_nombre: string;
  autor_rol_label: string;
  adjunto: string | null;
  activo: boolean;
  total_alcance: number;
  total_lecturas: number;
  porcentaje_lectura: number;
  ya_leido: boolean;
}

export interface LecturaComunicado {
  id: number;
  usuario: number;
  usuario_nombre: string;
  usuario_rol: string;
  leido_en: string;
  ip_origen: string | null;
}

export const CATEGORIA_COLOR: Record<CategoriaComunicado, string> = {
  academico: "var(--azul-600)",
  administrativo: "var(--slate-700)",
  actividad: "var(--verde-600)",
  recordatorio: "var(--amarillo-600)",
  convocatoria: "var(--violeta-600)",
  emergencia: "var(--rojo-600)",
};
