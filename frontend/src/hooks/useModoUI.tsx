import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Modo de interfaz para adaptar la densidad de información a cada usuario:
 *
 *  - "simple":   tarjetas grandes, iconos grandes, sin KPIs numéricos, sin gráficos.
 *                Ideal para conserjes, auxiliares, padres que se marean con datos.
 *
 *  - "completo": vista profesional con KPIs, gráficos, filtros avanzados,
 *                exportaciones. Para directivos y admin_tic.
 *
 * El usuario elige la primera vez que entra (onboarding modal) y puede cambiar
 * desde el footer del sidebar cuando quiera. Se persiste en localStorage por usuario.
 */

export type ModoUI = "simple" | "completo";

const KEY = "sistema.modo_ui";

interface Ctx {
  modo: ModoUI;
  setModo: (m: ModoUI) => void;
  yaEligió: boolean;
  reiniciarOnboarding: () => void;
}

const ModoUIContext = createContext<Ctx | null>(null);

function leer(): { modo: ModoUI; yaEligió: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { modo: "completo", yaEligió: false };
    const p = JSON.parse(raw) as { modo?: ModoUI; yaEligió?: boolean };
    return {
      modo: p.modo === "simple" ? "simple" : "completo",
      yaEligió: !!p.yaEligió,
    };
  } catch {
    return { modo: "completo", yaEligió: false };
  }
}

export function ModoUIProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState(() => leer());

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch { /* empty */ }
    // Marcar en body para permitir CSS diferenciado si hace falta
    document.body.dataset.modoUi = estado.modo;
  }, [estado]);

  const setModo = useCallback((m: ModoUI) => {
    setEstado({ modo: m, yaEligió: true });
  }, []);

  const reiniciarOnboarding = useCallback(() => {
    setEstado({ modo: estado.modo, yaEligió: false });
  }, [estado.modo]);

  return (
    <ModoUIContext.Provider value={{
      modo: estado.modo,
      setModo,
      yaEligió: estado.yaEligió,
      reiniciarOnboarding,
    }}>
      {children}
    </ModoUIContext.Provider>
  );
}

export function useModoUI() {
  const ctx = useContext(ModoUIContext);
  if (!ctx) throw new Error("useModoUI debe usarse dentro de ModoUIProvider");
  return ctx;
}
