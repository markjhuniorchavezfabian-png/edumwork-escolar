export type TipoRecurso =
  | "video_youtube" | "video_link" | "pdf" | "documento" | "imagen" | "enlace" | "texto";

export interface Recurso {
  id: number;
  leccion: number;
  orden: number;
  tipo: TipoRecurso;
  tipo_label: string;
  titulo: string;
  descripcion: string;
  url: string;
  contenido: string;
  youtube_id: string;
  creado_en: string;
  actualizado_en: string;
}

export interface Leccion {
  id: number;
  curso: number;
  orden: number;
  titulo: string;
  contenido: string;
  publicada: boolean;
  recursos: Recurso[];
  tareas_count: number;
  creado_en: string;
}

export interface Curso {
  id: number;
  titulo: string;
  descripcion: string;
  area: string;
  color: string;
  docente: number;
  docente_nombre: string;
  secciones: number[];
  secciones_detalle: Array<{ id: number; nombre: string }>;
  hijos_matriculados?: Array<{ estudiante_id: number; nombre: string; seccion: string }>;
  imagen_portada: string | null;
  activo: boolean;
  lecciones_count: number;
  tareas_count: number;
  creado_en: string;
}

export interface Tarea {
  id: number;
  curso: number;
  curso_titulo: string;
  leccion: number | null;
  leccion_titulo: string | null;
  titulo: string;
  descripcion: string;
  fecha_entrega: string;
  puntaje_maximo: string;
  permite_archivo: boolean;
  permite_texto: boolean;
  publicada: boolean;
  entregas_count: number;
  mi_entrega: {
    id: number;
    estado: string;
    estado_label: string;
    entregada_en: string | null;
    nota: string | null;
  } | null;
}

export interface Entrega {
  id: number;
  tarea: number;
  tarea_titulo: string;
  estudiante: number;
  estudiante_nombre: string;
  texto: string;
  archivo: string | null;
  estado: string;
  estado_label: string;
  entregada_en: string;
  nota: string | null;
  comentario_docente: string;
  calificada_por_nombre: string | null;
  calificada_en: string | null;
}

export interface Aviso {
  id: number;
  curso: number;
  autor: number | null;
  autor_nombre: string;
  titulo: string;
  contenido: string;
  fijado: boolean;
  creado_en: string;
  actualizado_en: string;
}

export const TIPO_RECURSO_LABEL: Record<TipoRecurso, string> = {
  video_youtube: "Video de YouTube",
  video_link: "Video (otro)",
  pdf: "PDF",
  documento: "Documento",
  imagen: "Imagen",
  enlace: "Enlace",
  texto: "Texto",
};
