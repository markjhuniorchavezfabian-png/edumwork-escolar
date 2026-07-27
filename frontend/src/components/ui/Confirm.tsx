import { createContext, useCallback, useContext, useState } from "react";

interface ConfirmOptions {
  titulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  variante?: "peligro" | "primario";
}

interface PromptOptions {
  titulo?: string;
  mensaje: string;
  placeholder?: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  multilinea?: boolean;
  requerido?: boolean;
}

type ResolveConfirm = (ok: boolean) => void;
type ResolvePrompt = (texto: string | null) => void;

interface Ctx {
  confirmar: (opciones: ConfirmOptions) => Promise<boolean>;
  pedirTexto: (opciones: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<Ctx | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: ResolveConfirm }) | null>(null);
  const [promptDlg, setPromptDlg] = useState<(PromptOptions & { resolve: ResolvePrompt }) | null>(null);
  const [texto, setTexto] = useState("");

  const confirmar = useCallback((opciones: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setDialog({ ...opciones, resolve }));
  }, []);

  const pedirTexto = useCallback((opciones: PromptOptions) => {
    setTexto("");
    return new Promise<string | null>((resolve) => setPromptDlg({ ...opciones, resolve }));
  }, []);

  function responder(ok: boolean) {
    dialog?.resolve(ok);
    setDialog(null);
  }

  function responderPrompt(ok: boolean) {
    if (!promptDlg) return;
    if (ok && promptDlg.requerido && !texto.trim()) return;
    promptDlg.resolve(ok ? texto : null);
    setPromptDlg(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirmar, pedirTexto }}>
      {children}
      {dialog && (
        <div className="modal-overlay" onClick={() => responder(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>{dialog.titulo ?? "Confirmación"}</h3>
              <button onClick={() => responder(false)} className="modal-cerrar">×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{dialog.mensaje}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secundario" onClick={() => responder(false)}>
                {dialog.textoCancelar ?? "Cancelar"}
              </button>
              <button
                className={`btn btn-${dialog.variante ?? "primario"}`}
                onClick={() => responder(true)}
                autoFocus
              >
                {dialog.textoConfirmar ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {promptDlg && (
        <div className="modal-overlay" onClick={() => responderPrompt(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{promptDlg.titulo ?? "Ingresar dato"}</h3>
              <button onClick={() => responderPrompt(false)} className="modal-cerrar">×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10 }}>{promptDlg.mensaje}</p>
              {promptDlg.multilinea ? (
                <textarea
                  className="form-input"
                  autoFocus
                  rows={4}
                  value={texto}
                  placeholder={promptDlg.placeholder}
                  onChange={(e) => setTexto(e.target.value)}
                  style={{ width: "100%", resize: "vertical" }}
                />
              ) : (
                <input
                  className="form-input"
                  autoFocus
                  value={texto}
                  placeholder={promptDlg.placeholder}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && responderPrompt(true)}
                  style={{ width: "100%" }}
                />
              )}
              {promptDlg.requerido && !texto.trim() && (
                <p style={{ fontSize: 11, color: "var(--rojo-600)", marginTop: 6 }}>Este campo es obligatorio.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secundario" onClick={() => responderPrompt(false)}>
                {promptDlg.textoCancelar ?? "Cancelar"}
              </button>
              <button
                className="btn btn-primario"
                onClick={() => responderPrompt(true)}
                disabled={promptDlg.requerido && !texto.trim()}
              >
                {promptDlg.textoConfirmar ?? "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx.confirmar;
}

export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("usePrompt debe usarse dentro de ConfirmProvider");
  return ctx.pedirTexto;
}
