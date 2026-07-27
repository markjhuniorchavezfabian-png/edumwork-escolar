import api from "./api";
import type { KPIsReservas, Reserva } from "../types/reservas";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function listarReservas(filtros?: { estado?: string; desde?: string; hasta?: string }): Promise<Reserva[]> {
  const params = new URLSearchParams();
  Object.entries(filtros ?? {}).forEach(([k, v]) => v && params.set(k, v));
  const { data } = await api.get<Paginated<Reserva> | Reserva[]>(`/reservas/${params.toString() ? "?" + params : ""}`);
  return Array.isArray(data) ? data : data.results;
}

export async function crearReserva(payload: Partial<Reserva>): Promise<Reserva> {
  const { data } = await api.post<Reserva>("/reservas/", payload);
  return data;
}

export async function aprobarReserva(id: number): Promise<Reserva> {
  const { data } = await api.post<Reserva>(`/reservas/${id}/aprobar/`);
  return data;
}

export async function rechazarReserva(id: number, razon: string): Promise<Reserva> {
  const { data } = await api.post<Reserva>(`/reservas/${id}/rechazar/`, { razon });
  return data;
}

export async function cancelarReserva(id: number): Promise<Reserva> {
  const { data } = await api.post<Reserva>(`/reservas/${id}/cancelar/`);
  return data;
}

export async function kpisReservas(): Promise<KPIsReservas> {
  const { data } = await api.get<KPIsReservas>("/reservas/kpis/");
  return data;
}

export interface AmbienteReservable {
  id: number;
  nombre: string;
  codigo: string;
  tipo: string;
  tipo_label: string;
  es_reservable: boolean;
}

export async function listarAmbientesReservables(): Promise<AmbienteReservable[]> {
  const { data } = await api.get<AmbienteReservable[] | { results: AmbienteReservable[] }>("/ambientes/?activo=true");
  const arr = Array.isArray(data) ? data : data.results;
  return arr.filter((a) => a.es_reservable);
}
