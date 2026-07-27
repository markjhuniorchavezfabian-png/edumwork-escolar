import api from "./api";
import type { KPIsUsoAmbientes, SesionClase } from "../types/sesion";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function listarSesiones(filtros?: { activas?: boolean; ambiente?: number }): Promise<SesionClase[]> {
  const params = new URLSearchParams();
  if (filtros?.activas) params.set("activas", "1");
  if (filtros?.ambiente) params.set("ambiente", String(filtros.ambiente));
  const { data } = await api.get<Paginated<SesionClase> | SesionClase[]>(`/asistencia/sesiones/${params.toString() ? "?" + params : ""}`);
  return Array.isArray(data) ? data : data.results;
}

export async function iniciarSesion(payload: {
  ambiente: number;
  tema?: string;
  seccion?: number | null;
  area_curricular?: string;
  competencia_cneb?: number | null;
  capacidad_cneb?: number | null;
  observaciones?: string;
}): Promise<SesionClase> {
  const { data } = await api.post<SesionClase>("/asistencia/sesiones/", payload);
  return data;
}

export async function cerrarSesion(id: number, observaciones = ""): Promise<SesionClase> {
  const { data } = await api.post<SesionClase>(`/asistencia/sesiones/${id}/cerrar/`, { observaciones });
  return data;
}

export async function marcarQREnSesion(id: number, codigo: string) {
  const { data } = await api.post(`/asistencia/sesiones/${id}/marcar-qr/`, { codigo });
  return data;
}

export async function marcarListaEnSesion(id: number, estudiantes: number[]) {
  const { data } = await api.post(`/asistencia/sesiones/${id}/marcar-lista/`, { estudiantes });
  return data;
}

export async function obtenerSesion(id: number): Promise<SesionClase> {
  const { data } = await api.get<SesionClase>(`/asistencia/sesiones/${id}/`);
  return data;
}

export async function kpisUsoAmbientes(): Promise<KPIsUsoAmbientes> {
  const { data } = await api.get<KPIsUsoAmbientes>("/asistencia/sesiones/kpis-uso/");
  return data;
}
