export type EstadoAsistenciaPersonal = "asistio" | "tardanza" | "ausente" | "licencia" | "comision" | "feriado";

export interface RegistroPersonal {
  id: number;
  usuario: number;
  usuario_nombre: string;
  usuario_rol: string;
  usuario_rol_label: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  estado: EstadoAsistenciaPersonal;
  estado_label: string;
  auto_tardanza: boolean;
  observaciones: string;
  documento_licencia: string | null;
  marcado_por: number | null;
  marcado_por_nombre: string | null;
  creado_en: string;
  lat_entrada: string | null;
  lng_entrada: string | null;
  distancia_metros: number | null;
  sin_geo: boolean;
}

export interface KPIsPersonal {
  total_staff: number;
  presentes_hoy: number;
  tardanzas_hoy: number;
  sin_marcar_hoy: number;
  tardanzas_mes: number;
  ausencias_mes: number;
  por_estado_mes: Record<string, number>;
}

export interface ConfigInstitucional {
  hora_tope_entrada_personal: string;
  hora_tope_entrada_estudiantes: string;
  tolerancia_minutos: number;
  nombre_institucion: string;
  codigo_modular: string;
  direccion: string;
  ugel: string;
  dre: string;
  latitud_ie: string;
  longitud_ie: string;
  radio_permitido_metros: number;
  exigir_geolocalizacion: boolean;
}

export const COLOR_ESTADO_PERSONAL: Record<EstadoAsistenciaPersonal, string> = {
  asistio: "var(--verde-600)",
  tardanza: "var(--amarillo-600)",
  ausente: "var(--rojo-600)",
  licencia: "var(--azul-600)",
  comision: "var(--violeta-600)",
  feriado: "var(--slate-500)",
};
