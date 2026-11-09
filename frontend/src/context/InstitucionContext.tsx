import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import axios from "axios";
import { API_BASE_URL } from "../constants/env";

export type Edicion = "completa" | "solo_docente";

export interface Institucion {
  nombre: string;
  sigla: string;
  codigo_modular: string;
  direccion: string;
  ugel: string;
  dre: string;
  email_institucional: string;
  modulos_activos: string[];
  primer_anio_lectivo: number;
  anio_lectivo_activo: number;
  logo_url: string | null;
  edicion: Edicion;
}

export interface InstitucionContextType extends Institucion {
  recargar: () => Promise<void>;
}

const FALLBACK: Institucion = {
  nombre: "Colegio César Vallejo",
  sigla: "IE-CV",
  codigo_modular: "",
  direccion: "",
  ugel: "",
  dre: "",
  email_institucional: "",
  modulos_activos: [],
  primer_anio_lectivo: new Date().getFullYear(),
  anio_lectivo_activo: new Date().getFullYear(),
  logo_url: null,
  edicion: "completa",
};

const BASE = API_BASE_URL;

const Ctx = createContext<InstitucionContextType>({
  ...FALLBACK,
  recargar: async () => {},
});

export function InstitucionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<Institucion>(FALLBACK);

  const recargar = useCallback(async () => {
    try {
      const { data } = await axios.get<Institucion>(`${BASE}/core/info/?_t=${Date.now()}`);
      setInfo({ ...FALLBACK, ...data });
    } catch {
      setInfo(FALLBACK);
    }
  }, []);

  useEffect(() => {
    recargar();
    const handleUpdate = () => { recargar(); };
    window.addEventListener("edumwork_institucion_cambiada", handleUpdate);
    return () => {
      window.removeEventListener("edumwork_institucion_cambiada", handleUpdate);
    };
  }, [recargar]);

  return <Ctx.Provider value={{ ...info, recargar }}>{children}</Ctx.Provider>;
}

export function useInstitucion(): InstitucionContextType {
  return useContext(Ctx);
}

