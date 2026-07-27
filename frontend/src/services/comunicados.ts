import api from "./api";
import type { Comunicado, LecturaComunicado } from "../types/comunicados";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function listarComunicados(): Promise<Comunicado[]> {
  const { data } = await api.get<Paginated<Comunicado> | Comunicado[]>("/comunicados/");
  return Array.isArray(data) ? data : data.results;
}

export async function crearComunicado(payload: Partial<Comunicado>): Promise<Comunicado> {
  const { data } = await api.post<Comunicado>("/comunicados/", payload);
  return data;
}

export async function marcarLeido(id: number) {
  await api.post(`/comunicados/${id}/marcar-leido/`);
}

export async function lecturasDeComunicado(id: number): Promise<LecturaComunicado[]> {
  const { data } = await api.get<LecturaComunicado[]>(`/comunicados/${id}/lecturas/`);
  return data;
}

export async function noLeidos(): Promise<{ no_leidos: number; total: number }> {
  const { data } = await api.get("/comunicados/no-leidos/");
  return data;
}

export async function eliminarComunicado(id: number) {
  await api.delete(`/comunicados/${id}/`);
}
