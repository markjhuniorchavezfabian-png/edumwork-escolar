import { useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";
const KEY_THEME = "theme.mode";
const KEY_AUTO = "theme.auto";

function temaSegunHora(): Theme {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? "light" : "dark";
}

export function useTheme() {
  const [auto, setAutoState] = useState<boolean>(() => {
    const saved = localStorage.getItem(KEY_AUTO);
    return saved === null ? false : saved === "true";
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const isAuto = (localStorage.getItem(KEY_AUTO) ?? "false") === "true";
    if (isAuto) return temaSegunHora();
    const saved = localStorage.getItem(KEY_THEME) as Theme | null;
    if (saved) return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (!auto) localStorage.setItem(KEY_THEME, theme);
  }, [theme, auto]);

  // En modo auto: actualizar cada minuto y al cambiar de pestaña
  useEffect(() => {
    if (!auto) return;
    const sync = () => setThemeState(temaSegunHora());
    sync();
    const id = setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", sync); };
  }, [auto]);

  const setAuto = useCallback((val: boolean) => {
    setAutoState(val);
    localStorage.setItem(KEY_AUTO, String(val));
    if (val) setThemeState(temaSegunHora());
  }, []);

  const toggle = useCallback(() => {
    if (auto) {
      // desactivar auto y quedarse con el tema actual
      setAuto(false);
    } else {
      setThemeState((t) => (t === "light" ? "dark" : "light"));
    }
  }, [auto, setAuto]);

  return { theme, setTheme: setThemeState, toggle, auto, setAuto };
}
