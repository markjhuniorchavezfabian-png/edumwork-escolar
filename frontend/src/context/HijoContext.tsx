import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";

export interface UltimaAsistencia {
  id: number;
  fecha: string;
  estado: string;
  hora_llegada: string | null;
  justificacion: string;
}

export interface HijoResumen {
  estudiante_id: number;
  nombre: string;
  grado: string;
  seccion: string;
  total_registros: number;
  porcentaje_asistencia: number;
  por_estado: Record<string, number>;
  ultimos_10: UltimaAsistencia[];
}

interface HijoContextValue {
  hijos: HijoResumen[];
  hijoActivoId: number | null;
  hijoActivo: HijoResumen | null;
  seleccionarHijo: (id: number | string) => void;
  cargandoHijos: boolean;
  recargarHijos: () => Promise<void>;
}

const STORAGE_KEY = "thales_hijo_activo";

const HijoContext = createContext<HijoContextValue>({
  hijos: [],
  hijoActivoId: null,
  hijoActivo: null,
  seleccionarHijo: () => {},
  cargandoHijos: false,
  recargarHijos: async () => {},
});

export function HijoProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [hijos, setHijos] = useState<HijoResumen[]>([]);
  const [hijoActivoId, setHijoActivoId] = useState<number | null>(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      return guardado ? Number(guardado) : null;
    } catch {
      return null;
    }
  });
  const [cargandoHijos, setCargandoHijos] = useState(false);

  const cargarHijos = useCallback(async () => {
    if (usuario?.rol !== "padre") {
      setHijos([]);
      setHijoActivoId(null);
      return;
    }
    setCargandoHijos(true);
    try {
      const { data } = await api.get<{ hijos: HijoResumen[] }>("/asistencia/registros/mis-hijos/");
      const list = data?.hijos ?? [];
      setHijos(list);

      if (list.length > 0) {
        // Verificar si el guardado en localStorage coincide con alguno de la lista
        const guardado = localStorage.getItem(STORAGE_KEY);
        const match = guardado ? list.find((h) => Number(h.estudiante_id) === Number(guardado)) : null;
        const idFinal = match ? Number(match.estudiante_id) : Number(list[0].estudiante_id);

        setHijoActivoId(idFinal);
        try {
          localStorage.setItem(STORAGE_KEY, String(idFinal));
        } catch {
          /* no-op */
        }
      }
    } catch {
      // no crítico
    } finally {
      setCargandoHijos(false);
    }
  }, [usuario?.rol]);

  useEffect(() => {
    cargarHijos();
  }, [cargarHijos]);

  const seleccionarHijo = useCallback(
    (id: number | string) => {
      const num = Number(id);
      if (isNaN(num) || num <= 0) return;
      setHijoActivoId(num);
      try {
        localStorage.setItem(STORAGE_KEY, String(num));
      } catch {
        /* no-op */
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("thales_hijo_cambiado", { detail: num }));
      }
    },
    []
  );

  useEffect(() => {
    const handleCambiado = (e: any) => {
      const val = e.detail?.id ?? e.detail;
      const num = Number(val);
      if (!isNaN(num) && num > 0 && num !== hijoActivoId) {
        setHijoActivoId(num);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const num = Number(e.newValue);
        if (!isNaN(num) && num > 0 && num !== hijoActivoId) {
          setHijoActivoId(num);
        }
      }
    };
    window.addEventListener("thales_hijo_cambiado", handleCambiado as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("thales_hijo_cambiado", handleCambiado as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [hijoActivoId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).seleccionarHijo = seleccionarHijo;
      (window as any).thalesHijoActivoId = hijoActivoId;
    }
  }, [seleccionarHijo, hijoActivoId]);

  const hijoActivo =
    hijos.find((h) => Number(h.estudiante_id) === Number(hijoActivoId)) ??
    hijos[0] ??
    null;

  return (
    <HijoContext.Provider
      value={{
        hijos,
        hijoActivoId,
        hijoActivo,
        seleccionarHijo,
        cargandoHijos,
        recargarHijos: cargarHijos,
      }}
    >
      {children}
    </HijoContext.Provider>
  );
}

export function useHijo() {
  return useContext(HijoContext);
}
