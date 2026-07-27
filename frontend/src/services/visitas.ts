import api from "./api";
import type { KPIsVisitas, MotivoInfo, Visita } from "../types/visitas";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function listarVisitas(filtros?: { estado?: "dentro" | "salidos" }): Promise<Visita[]> {
  const params = new URLSearchParams();
  if (filtros?.estado) params.set("estado", filtros.estado);
  const { data } = await api.get<Paginated<Visita> | Visita[]>(
    `/visitas/registros/${params.toString() ? "?" + params : ""}`
  );
  return Array.isArray(data) ? data : data.results;
}

export async function crearVisita(payload: Partial<Visita>): Promise<Visita> {
  const { data } = await api.post<Visita>("/visitas/registros/", payload);
  return data;
}

export async function marcarSalida(id: number): Promise<Visita> {
  const { data } = await api.post<Visita>(`/visitas/registros/${id}/marcar-salida/`);
  return data;
}

export async function salidaPorGafete(codigo_gafete: string) {
  const { data } = await api.post("/visitas/registros/salida-por-gafete/", { codigo_gafete });
  return data;
}

export async function obtenerMotivos(): Promise<MotivoInfo[]> {
  const { data } = await api.get<MotivoInfo[]>("/visitas/motivos/");
  return data;
}

export async function obtenerKPIsVisitas(): Promise<KPIsVisitas> {
  const { data } = await api.get<KPIsVisitas>("/visitas/registros/kpis/");
  return data;
}

export function urlGafeteQR(id: number): string {
  return `/visitas/registros/${id}/gafete-qr/`;
}
