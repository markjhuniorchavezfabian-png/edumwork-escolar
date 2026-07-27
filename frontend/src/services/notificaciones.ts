import api from "./api";

export interface Notificacion {
  id: number;
  tipo: string;
  tipo_label: string;
  titulo: string;
  cuerpo: string;
  url_accion: string;
  leida: boolean;
  fecha_leida: string | null;
  canales_enviados: string;
  creado_en: string;
}

export async function misNotificaciones(): Promise<{ no_leidas: number; resultados: Notificacion[] }> {
  const { data } = await api.get("/notificaciones/");
  return data;
}

export async function marcarLeidaNotif(id: number) {
  await api.post(`/notificaciones/${id}/leida/`);
}

export async function marcarTodasLeidas() {
  await api.post("/notificaciones/marcar-todas-leidas/");
}
