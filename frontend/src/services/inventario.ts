import api from "./api";
import type { Equipo, KPIsInventario } from "../types/inventario";
import { descargarBlob } from "./incidencias";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function listarEquipos(filtros?: { estado?: string; tipo?: string; ubicacion?: string }): Promise<Equipo[]> {
  const params = new URLSearchParams();
  Object.entries(filtros ?? {}).forEach(([k, v]) => v && params.set(k, v));
  const { data } = await api.get<Paginated<Equipo> | Equipo[]>(`/inventario/equipos/${params.toString() ? "?" + params : ""}`);
  return Array.isArray(data) ? data : data.results;
}

export async function crearEquipo(payload: Partial<Equipo>): Promise<Equipo> {
  const { data } = await api.post<Equipo>("/inventario/equipos/", payload);
  return data;
}

export async function actualizarEquipo(id: number, payload: Partial<Equipo>): Promise<Equipo> {
  const { data } = await api.patch<Equipo>(`/inventario/equipos/${id}/`, payload);
  return data;
}

export async function eliminarEquipo(id: number): Promise<void> {
  await api.delete(`/inventario/equipos/${id}/`);
}

export async function obtenerKPIsInventario(): Promise<KPIsInventario> {
  const { data } = await api.get<KPIsInventario>("/inventario/equipos/kpis/");
  return data;
}

export async function descargarInventarioExcel(): Promise<void> {
  const { data } = await api.get("/inventario/equipos/exportar-excel/", { responseType: "blob" });
  descargarBlob(data, `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
