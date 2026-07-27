import api from "./api";
import type { ConfigInstitucional, KPIsPersonal, RegistroPersonal } from "../types/asistenciaPersonal";

interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export async function marcarEntradaPropia(geo?: { lat: number; lng: number; accuracy?: number }): Promise<{ ok: boolean; creado: boolean; registro: RegistroPersonal }> {
  const payload = geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy } : {};
  const { data } = await api.post("/asistencia-personal/registros/marcar-entrada/", payload);
  return data;
}

export function obtenerUbicacion(timeoutMs = 8000): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este navegador no soporta geolocalización."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

export async function marcarSalidaPropia(): Promise<RegistroPersonal> {
  const { data } = await api.post<RegistroPersonal>("/asistencia-personal/registros/marcar-salida/");
  return data;
}

export async function miRegistroHoy(): Promise<{ tiene_registro: boolean; registro?: RegistroPersonal }> {
  const { data } = await api.get("/asistencia-personal/registros/mi-registro-hoy/");
  return data;
}

export async function listarPersonal(filtros?: { rol?: string; estado?: string; desde?: string; hasta?: string }): Promise<RegistroPersonal[]> {
  const params = new URLSearchParams();
  Object.entries(filtros ?? {}).forEach(([k, v]) => v && params.set(k, v));
  const { data } = await api.get<Paginated<RegistroPersonal> | RegistroPersonal[]>(
    `/asistencia-personal/registros/${params.toString() ? "?" + params : ""}`
  );
  return Array.isArray(data) ? data : data.results;
}

export async function marcarPorOtro(payload: {
  usuario: number; fecha?: string; hora_entrada?: string; hora_salida?: string; estado?: string; observaciones?: string;
}): Promise<RegistroPersonal> {
  const { data } = await api.post<RegistroPersonal>("/asistencia-personal/registros/marcar-por-otro/", payload);
  return data;
}

export async function kpisPersonal(): Promise<KPIsPersonal> {
  const { data } = await api.get<KPIsPersonal>("/asistencia-personal/registros/kpis/");
  return data;
}

export async function descargarConsolidadoMensual(mes: string) {
  const { data } = await api.get(`/asistencia-personal/registros/exportar-mensual/?mes=${mes}`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `asistencia_personal_${mes}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Configuración institucional
export async function obtenerConfig(): Promise<ConfigInstitucional> {
  const { data } = await api.get<ConfigInstitucional>("/asistencia-personal/configuracion/");
  return data;
}

export async function actualizarConfig(payload: Partial<ConfigInstitucional>): Promise<ConfigInstitucional> {
  const { data } = await api.patch<ConfigInstitucional>("/asistencia-personal/configuracion/", payload);
  return data;
}
