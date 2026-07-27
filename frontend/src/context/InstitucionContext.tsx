import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

const FALLBACK: Institucion = {
  nombre: "Mi Institución Educativa",
  sigla: "IE",
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

const Ctx = createContext<Institucion>(FALLBACK);

export function InstitucionProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<Institucion>(FALLBACK);

  useEffect(() => {
    axios.get<Institucion>(`${BASE}/core/info/`)
      .then(({ data }) => setInfo({ ...FALLBACK, ...data }))
      .catch(() => setInfo(FALLBACK));
  }, []);

  return <Ctx.Provider value={info}>{children}</Ctx.Provider>;
}

export function useInstitucion(): Institucion {
  return useContext(Ctx);
}
