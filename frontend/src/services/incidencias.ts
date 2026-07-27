import api from "./api";
import type {
  ComentarioIncidencia,
  Incidencia,
  KPIsIncidencias,
  NuevaIncidencia,
} from "../types/incidencia";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function listarIncidencias(): Promise<Incidencia[]> {
  const { data } = await api.get<PaginatedResponse<Incidencia> | Incidencia[]>(
    "/incidencias/"
  );
  if (Array.isArray(data)) return data;
  return data.results;
}

export async function crearIncidencia(payload: NuevaIncidencia, foto?: File | null): Promise<Incidencia> {
  if (foto) {
    const fd = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") fd.append(k, String(v));
    });
    fd.append("foto", foto);
    const { data } = await api.post<Incidencia>("/incidencias/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.post<Incidencia>("/incidencias/", payload);
  return data;
}

export async function actualizarIncidencia(
  id: number,
  payload: Partial<Incidencia>
): Promise<Incidencia> {
  const { data } = await api.patch<Incidencia>(`/incidencias/${id}/`, payload);
  return data;
}

export async function eliminarIncidencia(id: number): Promise<void> {
  await api.delete(`/incidencias/${id}/`);
}

export async function obtenerKPIs(): Promise<KPIsIncidencias> {
  const { data } = await api.get<KPIsIncidencias>("/incidencias/kpis/");
  return data;
}

// ── Comentarios ─────────────────────────────────────────────────────────────
export async function listarComentarios(incidenciaId: number): Promise<ComentarioIncidencia[]> {
  const { data } = await api.get<ComentarioIncidencia[]>(`/incidencias/${incidenciaId}/comentarios/`);
  return data;
}

export async function crearComentario(incidenciaId: number, texto: string): Promise<ComentarioIncidencia> {
  const { data } = await api.post<ComentarioIncidencia>(
    `/incidencias/${incidenciaId}/comentarios/`,
    { texto }
  );
  return data;
}

// ── Exportaciones ───────────────────────────────────────────────────────────
export function descargarExcelURL(): string {
  return "/incidencias/exportar-excel/";
}

export async function descargarExcel(): Promise<Blob> {
  const { data } = await api.get(descargarExcelURL(), { responseType: "blob" });
  return data;
}

export async function descargarReporteMensualWord(mes?: string): Promise<Blob> {
  const url = mes ? `/incidencias/reporte-mensual-word/?mes=${mes}` : "/incidencias/reporte-mensual-word/";
  const { data } = await api.get(url, { responseType: "blob" });
  return data;
}

/** Utility: descarga blob como archivo */
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
