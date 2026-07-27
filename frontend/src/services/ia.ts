import api from "./api";
import type {
  LLMConfig,
  ProveedorInfo,
  ClasificacionIA,
  SugerenciaIA,
  ResumenEjecutivoIA,
} from "../types/ia";

export async function catalogoProveedores(): Promise<ProveedorInfo[]> {
  const { data } = await api.get("/ia/catalogo/");
  return data;
}

export async function obtenerConfigIA(): Promise<LLMConfig> {
  const { data } = await api.get("/ia/config/");
  return data;
}

export async function guardarConfigIA(config: Partial<LLMConfig> & { api_key?: string }, metodo: "POST" | "PUT" = "POST"): Promise<LLMConfig> {
  const { data } = metodo === "POST"
    ? await api.post("/ia/config/", config)
    : await api.put("/ia/config/", config);
  return data;
}

export async function eliminarConfigIA(): Promise<void> {
  await api.delete("/ia/config/");
}

export async function probarIA(): Promise<{ ok: boolean; respuesta?: string; error?: string }> {
  try {
    const { data } = await api.post("/ia/probar/");
    return data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    return { ok: false, error: err.response?.data?.error ?? "Fallo desconocido" };
  }
}

export async function clasificarConIA(texto: string): Promise<ClasificacionIA> {
  const { data } = await api.post("/incidencias/clasificar/", { texto });
  return data;
}

export async function sugerirSolucionIA(incidenciaId: number): Promise<SugerenciaIA> {
  const { data } = await api.post(`/incidencias/${incidenciaId}/sugerir-solucion/`);
  return data;
}

export async function resumenEjecutivoIA(): Promise<ResumenEjecutivoIA> {
  const { data } = await api.get("/incidencias/resumen-ejecutivo/");
  return data;
}

export interface KPICostos {
  requests: number;
  tokens_in: number;
  tokens_out: number;
  costo_usd: number;
}

export interface CostosIA {
  hoy: KPICostos;
  mes: KPICostos;
  total_historico: KPICostos;
  serie_30d: Array<{ fecha: string; requests: number; costo_usd: number }>;
  top_endpoints_30d: Array<{ endpoint: string; requests: number; costo_usd: number }>;
  errores_30d: number;
  tasa_error_30d: number;
  reparto_byok_30d: {
    propia: { requests: number; costo_usd: number };
    institucional: { requests: number; costo_usd: number };
  };
  top_usuarios_institucional_30d: Array<{
    username: string;
    nombre: string;
    requests: number;
    costo_usd: number;
  }>;
}

export async function obtenerCostosIA(): Promise<CostosIA> {
  const { data } = await api.get("/ia/costos/");
  return data;
}

// ── BYOK personal ────────────────────────────────────────────────────────────
export interface MiConfigIA {
  configurado: boolean;
  tiene_institucional: boolean;
  fallback_institucional_provider?: string | null;
  provider?: string;
  modelo_default?: string;
  base_url?: string;
  activo?: boolean;
  ultima_prueba_ok?: boolean | null;
  ultima_prueba_en?: string | null;
  key_enmascarada?: string;
}

export async function obtenerMiConfigIA(): Promise<MiConfigIA> {
  const { data } = await api.get("/ia/mi-config/");
  return data;
}

export async function guardarMiConfigIA(payload: Partial<LLMConfig> & { api_key?: string }, metodo: "POST" | "PUT" = "POST"): Promise<LLMConfig> {
  const { data } = metodo === "POST"
    ? await api.post("/ia/mi-config/", payload)
    : await api.put("/ia/mi-config/", payload);
  return data;
}

export async function eliminarMiConfigIA(): Promise<void> {
  await api.delete("/ia/mi-config/");
}
