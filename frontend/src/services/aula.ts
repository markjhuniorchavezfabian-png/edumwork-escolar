import api from "./api";
import type { Aviso, Curso, Entrega, Leccion, Recurso, Tarea } from "../types/aula";

// ── Cursos ──────────────────────────────────────────────────────────────────
export async function listarCursos(filtros?: { area?: string; seccion?: string; q?: string; estudiante?: number }): Promise<Curso[]> {
  const { data } = await api.get<{ results?: Curso[] } | Curso[]>("/aula-virtual/cursos/", { params: filtros });
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function obtenerCurso(id: number): Promise<Curso> {
  const { data } = await api.get<Curso>(`/aula-virtual/cursos/${id}/`);
  return data;
}

export async function crearCurso(datos: Partial<Curso> & { imagen_portada?: File | null }): Promise<Curso> {
  const fd = new FormData();
  Object.entries(datos).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, String(x)));
    else fd.append(k, v as string | Blob);
  });
  const { data } = await api.post<Curso>("/aula-virtual/cursos/", fd);
  return data;
}

export async function actualizarCurso(id: number, datos: Partial<Curso>): Promise<Curso> {
  const { data } = await api.patch<Curso>(`/aula-virtual/cursos/${id}/`, datos);
  return data;
}

export async function eliminarCurso(id: number): Promise<void> {
  await api.delete(`/aula-virtual/cursos/${id}/`);
}

// ── Lecciones ───────────────────────────────────────────────────────────────
export async function listarLecciones(cursoId: number): Promise<Leccion[]> {
  const { data } = await api.get<{ results?: Leccion[] } | Leccion[]>(`/aula-virtual/lecciones/?curso=${cursoId}`);
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function crearLeccion(datos: Partial<Leccion>): Promise<Leccion> {
  const { data } = await api.post<Leccion>("/aula-virtual/lecciones/", datos);
  return data;
}

export async function actualizarLeccion(id: number, datos: Partial<Leccion>): Promise<Leccion> {
  const { data } = await api.patch<Leccion>(`/aula-virtual/lecciones/${id}/`, datos);
  return data;
}

export async function eliminarLeccion(id: number): Promise<void> {
  await api.delete(`/aula-virtual/lecciones/${id}/`);
}

// ── Recursos ────────────────────────────────────────────────────────────────
export async function crearRecurso(datos: Partial<Recurso>): Promise<Recurso> {
  const { data } = await api.post<Recurso>("/aula-virtual/recursos/", datos);
  return data;
}

export async function eliminarRecurso(id: number): Promise<void> {
  await api.delete(`/aula-virtual/recursos/${id}/`);
}

// ── Tareas ──────────────────────────────────────────────────────────────────
export async function listarTareas(cursoId: number): Promise<Tarea[]> {
  const { data } = await api.get<{ results?: Tarea[] } | Tarea[]>(`/aula-virtual/tareas/?curso=${cursoId}`);
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function crearTarea(datos: Partial<Tarea>): Promise<Tarea> {
  const { data } = await api.post<Tarea>("/aula-virtual/tareas/", datos);
  return data;
}

export async function eliminarTarea(id: number): Promise<void> {
  await api.delete(`/aula-virtual/tareas/${id}/`);
}

// ── Entregas ────────────────────────────────────────────────────────────────
export async function listarEntregas(tareaId: number): Promise<Entrega[]> {
  const { data } = await api.get<{ results?: Entrega[] } | Entrega[]>(`/aula-virtual/entregas/?tarea=${tareaId}`);
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function crearEntrega(payload: { tarea: number; texto?: string; archivo?: File | null }): Promise<Entrega> {
  const fd = new FormData();
  fd.append("tarea", String(payload.tarea));
  if (payload.texto) fd.append("texto", payload.texto);
  if (payload.archivo) fd.append("archivo", payload.archivo);
  const { data } = await api.post<Entrega>("/aula-virtual/entregas/", fd);
  return data;
}

export async function calificarEntrega(id: number, nota: number, comentario?: string): Promise<Entrega> {
  const { data } = await api.post<Entrega>(`/aula-virtual/entregas/${id}/calificar/`, { nota, comentario });
  return data;
}

// ── Avisos ───────────────────────────────────────────────────────────────────
export async function listarAvisos(cursoId: number): Promise<Aviso[]> {
  const { data } = await api.get<{ results?: Aviso[] } | Aviso[]>(
    `/aula-virtual/avisos/?curso=${cursoId}`
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function crearAviso(datos: Pick<Aviso, "curso" | "titulo" | "contenido" | "fijado">): Promise<Aviso> {
  const { data } = await api.post<Aviso>("/aula-virtual/avisos/", datos);
  return data;
}

export async function eliminarAviso(id: number): Promise<void> {
  await api.delete(`/aula-virtual/avisos/${id}/`);
}

export async function toggleFijadoAviso(id: number, fijado: boolean): Promise<Aviso> {
  const { data } = await api.patch<Aviso>(`/aula-virtual/avisos/${id}/`, { fijado });
  return data;
}
