export type Rol =
  | "director"
  | "subdirector"
  | "docente"
  | "admin_tic"
  | "secretaria"
  | "padre"
  | "estudiante";

export interface Usuario {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  rol: Rol;
  dni: string | null;
  telefono: string;
  activo: boolean;
  debe_cambiar_password?: boolean;
  es_docente?: boolean;
  es_administrador?: boolean;
  consentimiento_datos?: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
