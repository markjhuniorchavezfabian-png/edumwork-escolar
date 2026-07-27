export type ProveedorIA = "deepseek" | "claude" | "openai" | "gemini" | "ollama" | "custom";

export interface ProveedorInfo {
  codigo: ProveedorIA;
  etiqueta: string;
  base_url_default: string;
  modelo_default: string;
  modelos_sugeridos: string[];
  modelo_recomendado: string;
}

export interface LLMConfig {
  id?: number;
  provider: ProveedorIA;
  modelo_default: string;
  base_url: string;
  activo: boolean;
  ultima_prueba_ok: boolean | null;
  ultima_prueba_en: string | null;
  key_enmascarada?: string;
  actualizado_en?: string;
  configurado?: boolean;
}

export interface ClasificacionIA {
  titulo: string;
  descripcion: string;
  ubicacion: string;
  tipo: string;
  prioridad: string;
}

export interface SugerenciaIA {
  pasos: string[];
  posibles_causas: string[];
  requiere_repuestos: boolean;
  notas: string;
}

export interface ResumenEjecutivoIA {
  markdown: string;
  periodo: string;
}
