import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface Ctx {
  abierta: boolean;
  abrir: () => void;
  cerrar: () => void;
  alternar: () => void;
}

const SidebarContext = createContext<Ctx | null>(null);

/**
 * Estado del sidebar en mobile.
 * En desktop siempre está visible (CSS lo maneja); en mobile es drawer con overlay.
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [abierta, setAbierta] = useState(false);

  const abrir = useCallback(() => setAbierta(true), []);
  const cerrar = useCallback(() => setAbierta(false), []);
  const alternar = useCallback(() => setAbierta((v) => !v), []);

  // Cerrar sidebar al cambiar de tamaño a desktop (evita estado inconsistente)
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setAbierta(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Bloquear scroll del body cuando el drawer está abierto en mobile
  useEffect(() => {
    if (abierta && window.innerWidth <= 900) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [abierta]);

  return (
    <SidebarContext.Provider value={{ abierta, abrir, cerrar, alternar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de SidebarProvider");
  return ctx;
}
