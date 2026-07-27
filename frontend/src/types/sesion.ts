export interface AsistenciaEnSesion {
  id: number;
  sesion: number;
  estudiante: number;
  estudiante_nombre: string;
  presente: boolean;
  hora_llegada: string | null;
  creado_en: string;
}

export interface SesionClase {
  id: number;
  ambiente: number;
  ambiente_nombre: string;
  ambiente_tipo: string;
  docente: number;
  docente_nombre: string;
  seccion: number | null;
  seccion_nombre: string | null;
  tema: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  duracion_minutos: number | null;
  observaciones: string;
  total_presentes: number;
  asistencias: AsistenciaEnSesion[];
  creado_en: string;
  actualizado_en: string;
}

export interface KPIsUsoAmbientes {
  desde: string;
  total_sesiones: number;
  por_ambiente_top10: Array<{ ambiente: string; tipo: string; sesiones: number }>;
}
