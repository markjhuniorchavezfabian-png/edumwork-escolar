export type TipoEquipo =
  | "pc" | "laptop" | "proyector" | "pizarra" | "impresora"
  | "tablet" | "switch" | "router" | "servidor" | "otro";

export type EstadoEquipo = "operativo" | "mantenimiento" | "reparacion" | "baja";

export interface Equipo {
  id: number;
  codigo_inventario: string;
  tipo: TipoEquipo;
  tipo_label: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  ubicacion: string;
  estado: EstadoEquipo;
  estado_label: string;
  fecha_adquisicion: string | null;
  valor_referencial: string | null;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
  ambiente?: number | null;
  ambiente_nombre?: string | null;
  ambiente_tipo?: string | null;
  ambiente_codigo?: string | null;
}

export interface KPIsInventario {
  total: number;
  por_estado: Record<EstadoEquipo, number>;
  por_tipo: Record<string, number>;
  por_ubicacion_top10: Array<{ ubicacion: string; count: number }>;
  valor_total_estimado: number;
}

export const TIPO_EQUIPO_LABEL: Record<TipoEquipo, string> = {
  pc: "Computadora", laptop: "Laptop", proyector: "Proyector",
  pizarra: "Pizarra digital", impresora: "Impresora", tablet: "Tablet",
  switch: "Switch de red", router: "Router / AP", servidor: "Servidor", otro: "Otro",
};

export const ESTADO_EQUIPO_LABEL: Record<EstadoEquipo, string> = {
  operativo: "Operativo", mantenimiento: "En mantenimiento",
  reparacion: "En reparación", baja: "Dado de baja",
};

export const ESTADO_EQUIPO_COLOR: Record<EstadoEquipo, string> = {
  operativo: "var(--verde-600)",
  mantenimiento: "var(--amarillo-600)",
  reparacion: "var(--azul-600)",
  baja: "var(--rojo-600)",
};
