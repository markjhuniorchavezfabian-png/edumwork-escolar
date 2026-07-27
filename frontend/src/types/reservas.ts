export type EstadoReserva = "solicitada" | "aprobada" | "rechazada" | "cancelada" | "completada";

export interface Reserva {
  id: number;
  ambiente: number;
  ambiente_nombre: string;
  ambiente_tipo: string;
  solicitante: number;
  solicitante_nombre: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string;
  descripcion: string;
  participantes_estimados: number | null;
  estado: EstadoReserva;
  estado_label: string;
  revisado_por: number | null;
  revisado_por_nombre: string | null;
  fecha_revision: string | null;
  razon_rechazo: string;
  creado_en: string;
  actualizado_en: string;
}

export interface KPIsReservas {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  por_ambiente_top5: Array<[string, number]>;
}

export const COLOR_ESTADO_RESERVA: Record<EstadoReserva, string> = {
  solicitada: "var(--amarillo-600)",
  aprobada: "var(--verde-600)",
  rechazada: "var(--rojo-600)",
  cancelada: "var(--slate-500)",
  completada: "var(--azul-600)",
};
