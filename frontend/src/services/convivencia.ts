import api from "./api";
import type { CasoConvivencia, KPIsConvivencia } from "../types/convivencia";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function listarCasos(): Promise<CasoConvivencia[]> {
  const { data } = await api.get<Paginated<CasoConvivencia> | CasoConvivencia[]>("/convivencia/casos/");
  return Array.isArray(data) ? data : data.results;
}

export async function crearCaso(payload: Partial<CasoConvivencia>): Promise<CasoConvivencia> {
  const { data } = await api.post<CasoConvivencia>("/convivencia/casos/", payload);
  return data;
}

export async function actualizarCaso(id: number, payload: Partial<CasoConvivencia>): Promise<CasoConvivencia> {
  const { data } = await api.patch<CasoConvivencia>(`/convivencia/casos/${id}/`, payload);
  return data;
}

export async function agregarSeguimiento(idCaso: number, payload: { accion: string; detalle: string }) {
  const { data } = await api.post(`/convivencia/casos/${idCaso}/seguimientos/`, payload);
  return data;
}

export async function marcarSiseve(idCaso: number): Promise<CasoConvivencia> {
  const { data } = await api.post<CasoConvivencia>(`/convivencia/casos/${idCaso}/marcar-siseve/`);
  return data;
}

export async function kpisConvivencia(): Promise<KPIsConvivencia> {
  const { data } = await api.get<KPIsConvivencia>("/convivencia/casos/kpis/");
  return data;
}

export async function marcarLibro(idCaso: number): Promise<CasoConvivencia> {
  const { data } = await api.post<CasoConvivencia>(`/convivencia/casos/${idCaso}/marcar-libro/`);
  return data;
}

export async function marcarPaso(idCaso: number, pasoIdx: number, completado: boolean): Promise<CasoConvivencia> {
  const { data } = await api.post<CasoConvivencia>(`/convivencia/casos/${idCaso}/marcar-paso/`,
    { paso_idx: pasoIdx, completado });
  return data;
}

export async function protocolosRM383(): Promise<{
  norma: string;
  protocolos: { codigo: string; label: string; plazo_dias_habiles: number; definicion: string }[];
  actores_cgb: string[];
  instrumentos_obligatorios: string[];
}> {
  const { data } = await api.get("/convivencia/casos/protocolos-rm-383/");
  return data;
}
