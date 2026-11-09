export interface UsuarioLista {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  nombre_completo: string;
  email: string;
  rol: string;
  rol_label: string;
  dni: string | null;
  telefono: string;
  activo: boolean;
  es_docente?: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface UsuarioNuevo {
  username: string;
  first_name: string;
  last_name: string;
  email?: string;
  rol: string;
  dni?: string;
  telefono?: string;
  especialidad?: string;
  grado?: string;
  seccion?: string;
  codigo_matricula?: string;
}

export interface RolInfo {
  codigo: string;
  etiqueta: string;
}

export interface Seccion {
  id: number;
  nombre: string;
  nivel?: "inicial" | "primaria" | "secundaria" | "";
  grado: string;
  letra: string;
  turno?: "manana" | "tarde" | "completa";
  hora_inicio?: string | null;
  hora_fin?: string | null;
  tutor: number | null;
  tutor_nombre: string | null;
  docentes: number[];
  docentes_detalle: Array<{ id: number; nombre: string }>;
  cantidad_estudiantes: number;
  cantidad_docentes: number;
}

export interface DocenteDisponible {
  id: number;
  nombre: string;
  username: string;
}
