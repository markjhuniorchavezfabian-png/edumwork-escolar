import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ToastTipo = "ok" | "error" | "info" | "advertencia";

interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
  duracion: number;
}

interface ToastContextValue {
  mostrar: (mensaje: string, tipo?: ToastTipo, duracion?: number) => void;
  ok: (mensaje: string, duracion?: number) => void;
  error: (mensaje: string, duracion?: number) => void;
  info: (mensaje: string, duracion?: number) => void;
  advertencia: (mensaje: string, duracion?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrar = useCallback((mensaje: string, tipo: ToastTipo = "info", duracion = 4000) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, tipo, mensaje, duracion }]);
  }, []);

  const remover = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const valor: ToastContextValue = {
    mostrar,
    ok: (m, d) => mostrar(m, "ok", d),
    error: (m, d) => mostrar(m, "error", d),
    info: (m, d) => mostrar(m, "info", d),
    advertencia: (m, d) => mostrar(m, "advertencia", d),
  };

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onCerrar={() => remover(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onCerrar }: { toast: Toast; onCerrar: () => void }) {
  useEffect(() => {
    if (toast.duracion > 0) {
      const t = setTimeout(onCerrar, toast.duracion);
      return () => clearTimeout(t);
    }
  }, [toast.duracion, onCerrar]);

  const icono = { ok: "✓", error: "✕", info: "i", advertencia: "!" }[toast.tipo];

  return (
    <div className={`toast toast-${toast.tipo}`}>
      <div className="toast-icono">{icono}</div>
      <div className="toast-mensaje">{toast.mensaje}</div>
      <button className="toast-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
