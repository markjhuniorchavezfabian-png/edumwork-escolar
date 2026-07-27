import api from "./api";
import type {
  EstudianteLista,
  RegistroAsistencia,
  KPIsAsistencia,
  HijoAsistencia,
  EstadoAsistencia,
} from "../types/asistencia";

export interface SeccionDocente {
  id: number;
  nombre: string;
  grado: string;
  letra: string;
  nivel: string;
  cantidad_estudiantes: number;
}

export async function misSecciones(): Promise<SeccionDocente[]> {
  const { data } = await api.get<SeccionDocente[]>("/asistencia/secciones/mis/");
  return data;
}

export async function listarEstudiantes(filtros?: { grado?: string; seccion?: string; seccion_id?: number }): Promise<EstudianteLista[]> {
  const params = new URLSearchParams();
  if (filtros?.grado) params.set("grado", filtros.grado);
  if (filtros?.seccion) params.set("seccion", filtros.seccion);
  if (filtros?.seccion_id) params.set("seccion_id", String(filtros.seccion_id));
  const { data } = await api.get<EstudianteLista[]>(`/asistencia/estudiantes/${params.toString() ? "?" + params : ""}`);
  return data;
}

export async function registrosDelDia(fecha?: string): Promise<{ fecha: string; registros: RegistroAsistencia[] }> {
  const q = fecha ? `?fecha=${fecha}` : "";
  const { data } = await api.get(`/asistencia/registros/del-dia/${q}`);
  return data;
}

export interface MarcaItem {
  estudiante: number;
  estado: EstadoAsistencia;
  hora_llegada?: string | null;
  justificacion?: string;
}

export async function marcarMasivo(fecha: string, registros: MarcaItem[]) {
  const { data } = await api.post("/asistencia/registros/marcar-masivo/", { fecha, registros });
  return data;
}

export async function obtenerKPIsAsistencia(desde?: string, hasta?: string): Promise<KPIsAsistencia> {
  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  const { data } = await api.get<KPIsAsistencia>(`/asistencia/registros/kpis/${params.toString() ? "?" + params : ""}`);
  return data;
}

export async function misHijos(): Promise<{ hijos: HijoAsistencia[] }> {
  const { data } = await api.get("/asistencia/registros/mis-hijos/");
  return data;
}
