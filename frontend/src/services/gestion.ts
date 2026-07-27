import api from "./api";
import type {
  UsuarioLista,
  UsuarioNuevo,
  RolInfo,
  Seccion,
  DocenteDisponible,
} from "../types/gestion";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

// ── Usuarios ────────────────────────────────────────────────────────────────
export async function listarUsuarios(filtros?: { rol?: string; q?: string; activo?: boolean }): Promise<UsuarioLista[]> {
  const params = new URLSearchParams();
  if (filtros?.rol) params.set("rol", filtros.rol);
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.activo !== undefined) params.set("activo", String(filtros.activo));
  const { data } = await api.get<Paginated<UsuarioLista> | UsuarioLista[]>(
    `/usuarios/${params.toString() ? "?" + params : ""}`
  );
  return Array.isArray(data) ? data : data.results;
}

export async function crearUsuario(payload: UsuarioNuevo): Promise<UsuarioLista & { password_generado?: string }> {
  const { data } = await api.post<UsuarioLista & { password_generado?: string }>("/usuarios/", payload);
  return data;
}

export async function actualizarUsuario(id: number, payload: Partial<UsuarioLista>): Promise<UsuarioLista> {
  const { data } = await api.patch<UsuarioLista>(`/usuarios/${id}/`, payload);
  return data;
}

export async function desactivarUsuario(id: number): Promise<void> {
  await api.delete(`/usuarios/${id}/`);
}

export async function reactivarUsuario(id: number): Promise<UsuarioLista> {
  const { data } = await api.post<UsuarioLista>(`/usuarios/${id}/reactivar/`);
  return data;
}

export async function resetPassword(id: number, nueva?: string): Promise<{ password_temporal: string }> {
  const { data } = await api.post(`/usuarios/${id}/reset-password/`, { password_nuevo: nueva });
  return data;
}

export async function cambiarPasswordPropio(actual: string, nuevo: string): Promise<void> {
  await api.post("/usuarios/cambiar-password/", { password_actual: actual, password_nuevo: nuevo });
}

export async function vincularHijos(idPadre: number, hijosIds: number[]) {
  const { data } = await api.post(`/usuarios/${idPadre}/vincular-hijos/`, { hijos_ids: hijosIds });
  return data;
}

export async function consentirDatos() {
  const { data } = await api.post("/usuarios/consentir/");
  return data;
}

export async function catalogoRoles(): Promise<RolInfo[]> {
  const { data } = await api.get<RolInfo[]>("/usuarios/roles/");
  return data;
}

// ── Secciones ───────────────────────────────────────────────────────────────
export async function listarSecciones(): Promise<Seccion[]> {
  const { data } = await api.get<Paginated<Seccion> | Seccion[]>("/usuarios/secciones/");
  return Array.isArray(data) ? data : data.results;
}

export async function crearSeccion(payload: Partial<Seccion>): Promise<Seccion> {
  const { data } = await api.post<Seccion>("/usuarios/secciones/", payload);
  return data;
}

export async function actualizarSeccion(id: number, payload: Partial<Seccion>): Promise<Seccion> {
  const { data } = await api.patch<Seccion>(`/usuarios/secciones/${id}/`, payload);
  return data;
}

export async function eliminarSeccion(id: number): Promise<void> {
  await api.delete(`/usuarios/secciones/${id}/`);
}

export async function docentesDisponibles(): Promise<DocenteDisponible[]> {
  const { data } = await api.get<DocenteDisponible[]>("/usuarios/secciones/docentes-disponibles/");
  return data;
}

export interface EstudianteResumen {
  id: number;
  nombre_completo: string;
  grado: string;
  seccion: string;
  codigo_matricula: string | null;
}

export async function listarEstudiantesPickeables(): Promise<EstudianteResumen[]> {
  const { data } = await api.get<EstudianteResumen[]>("/asistencia/estudiantes/");
  return data;
}
