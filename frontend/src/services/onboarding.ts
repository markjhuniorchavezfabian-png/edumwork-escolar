import api from "./api";

export interface OnboardingStatus {
  completado: boolean;
  pasos: {
    config: { completo: boolean; nombre: string; codigo_modular: string };
    secciones: { completo: boolean; total: number };
    docentes: { completo: boolean; total: number };
    estudiantes: { completo: boolean; total: number };
  };
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const { data } = await api.get<OnboardingStatus>("/core/onboarding-status/");
  return data;
}

export interface ConfigInstitucional {
  nombre_institucion: string;
  sigla: string;
  codigo_modular: string;
  direccion: string;
  ugel: string;
  dre: string;
  email_institucional: string;
  hora_tope_entrada_personal: string;
  hora_tope_entrada_estudiantes: string;
  tolerancia_minutos: number;
  latitud_ie: string;
  longitud_ie: string;
  radio_permitido_metros: number;
  exigir_geolocalizacion: boolean;
  modulos_activos: string[];
  escala_calificacion: "letras" | "numerica";
  plantilla_informe: string;
  primer_anio_lectivo: number;
  anio_lectivo_activo: number;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  smtp_from_email: string;
  smtp_configurado?: boolean;
  email_comunicados_habilitado: boolean;
}

export async function getConfig(): Promise<ConfigInstitucional> {
  const { data } = await api.get<ConfigInstitucional>("/core/configuracion/");
  return data;
}

export async function patchConfig(patch: Partial<ConfigInstitucional>): Promise<ConfigInstitucional> {
  const { data } = await api.patch<ConfigInstitucional>("/core/configuracion/", patch);
  return data;
}

export async function crearSeccion(payload: {
  grado: string; letra: string; nombre?: string; tutor?: number | null;
  nivel?: "inicial" | "primaria" | "secundaria" | "";
}) {
  const nombre = payload.nombre ?? `${payload.grado} ${payload.letra}`;
  const { data } = await api.post("/usuarios/secciones/", { ...payload, nombre });
  return data;
}

export async function crearDocente(payload: {
  username: string; first_name: string; last_name: string;
  dni?: string; especialidad?: string; email?: string; password?: string;
}) {
  const { data } = await api.post("/usuarios/", {
    ...payload, rol: "docente",
    password: payload.password || `${payload.username}2026`,
  });
  return data;
}

export async function descargarTemplateDocentes(): Promise<void> {
  const { data } = await api.get("/usuarios/importar/template-docentes/", { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_docentes.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ResultadoImport {
  creados: number;
  omitidos_por_dni_repetido?: number;
  errores: Array<{ fila: number; mensaje?: string; error?: string }>;
  credenciales: Array<{ nombre: string; usuario: string; password: string; rol: string }>;
}

export interface EmailStatus {
  activo: boolean;
  backend: string;
  detalle: string;
}

export async function getEmailStatus(): Promise<EmailStatus> {
  const { data } = await api.get<EmailStatus>("/core/email-status/");
  return data;
}

export async function descargarBackup(): Promise<void> {
  const { data } = await api.post("/core/backup/", null, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `backup_sistematic_${ts}.sql.gz`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ResultadoRestore {
  ok: boolean;
  mensaje?: string;
  error?: string;
}

export async function restaurarBackup(archivo: File, confirmacion: string): Promise<ResultadoRestore> {
  const fd = new FormData();
  fd.append("archivo", archivo);
  fd.append("confirmar", confirmacion);
  const { data } = await api.post<ResultadoRestore>(
    "/core/restore/",
    fd,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function importarDocentesExcel(archivo: File): Promise<ResultadoImport> {
  const fd = new FormData();
  fd.append("archivo", archivo);
  const { data } = await api.post<ResultadoImport>(
    "/usuarios/importar/docentes/",
    fd,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}
