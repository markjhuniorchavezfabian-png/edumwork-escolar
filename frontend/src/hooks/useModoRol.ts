import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const KEY = "sidebar.modoRol";

export function useModoRol() {
  const { usuario } = useAuth();
  const rol = usuario?.rol ?? "";
  const esDualRol = rol === "director" && usuario?.es_docente === true;

  const [modoRol, setModoRolState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(KEY);
      if (saved === "docente" && rol === "director") return "docente";
    }
    return rol;
  });

  // Sincronizar con cambios externos (el Sidebar escribe en localStorage)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) {
        const next = e.newValue;
        if (next === "docente" && rol === "director") setModoRolState("docente");
        else setModoRolState(rol);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [rol]);

  const setModoRol = (m: string) => {
    setModoRolState(m);
    try { localStorage.setItem(KEY, m); } catch { /* empty */ }
    // Disparar evento para que otras pestañas/componentes se enteren
    window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: m }));
  };

  const rolEfectivo = esDualRol ? modoRol : rol;

  return { rolEfectivo, modoRol, setModoRol, esDualRol };
}
