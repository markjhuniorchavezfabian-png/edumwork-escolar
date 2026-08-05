import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Bot, ExternalLink, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const LS_KEY = "asistente_ia_visible";

interface Mensaje {
  role: "user" | "assistant";
  content: string;
}

const LABEL_ROL: Record<string, string> = {
  director: "Asistente de gestión",
  subdirector: "Asistente institucional",
  docente: "Asistente pedagógico",
  admin_tic: "Asistente TIC",
  padre: "Asistente familiar",
  estudiante: "Tutor IA",
};

const PLACEHOLDER_ROL: Record<string, string> = {
  director: "Ej: ¿Cómo mejorar la asistencia este bimestre?",
  subdirector: "Ej: ¿Qué dice la normativa sobre evaluaciones?",
  docente: "Ej: Ideas para enseñar fracciones en primaria...",
  admin_tic: "Ej: El proyector no enciende, ¿qué reviso?",
  padre: "Ej: ¿Cómo justificar una falta de mi hijo?",
  estudiante: "Ej: No entiendo las fracciones, ¿me explicas?",
};

export default function AsistenteIA() {
  const { usuario, isAuthenticated } = useAuth();
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [sinConfig, setSinConfig] = useState(false);
  const [pos, setPos] = useState({ bottom: 24, right: 24 });
  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, bottom: 24, right: 24 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      setPos({
        right: Math.max(0, dragStart.current.right - dx),
        bottom: Math.max(0, dragStart.current.bottom - dy),
      });
    }
    function onUp() { isDragging.current = false; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, bottom: pos.bottom, right: pos.right };
  }

  // Cargar preferencia del usuario
  useEffect(() => {
    if (!isAuthenticated) return;
    const guardado = localStorage.getItem(LS_KEY);
    setVisible(guardado !== "false"); // visible por defecto
  }, [isAuthenticated]);

  useEffect(() => {
    if (abierto) {
      inputRef.current?.focus();
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [abierto, mensajes]);

  function toggleVisible() {
    const nuevo = !visible;
    setVisible(nuevo);
    localStorage.setItem(LS_KEY, String(nuevo));
    if (!nuevo) setAbierto(false);
  }

  async function enviar() {
    if (!input.trim() || cargando) return;
    const texto = input.trim();
    setInput("");
    setSinConfig(false);

    const nuevosM: Mensaje[] = [...mensajes, { role: "user", content: texto }];
    setMensajes(nuevosM);
    setCargando(true);

    try {
      const historialParaApi = mensajes.map(m => ({ role: m.role, content: m.content }));
      const { data } = await api.post<{ respuesta?: string; sin_config?: boolean; error?: string }>(
        "/ia/chat/",
        { historial: historialParaApi, mensaje: texto }
      );
      if (data.sin_config) {
        setSinConfig(true);
        setMensajes(nuevosM); // quitar el mensaje del user si no hay config? no, mejor mostrarlo
      } else if (data.respuesta) {
        setMensajes([...nuevosM, { role: "assistant", content: data.respuesta }]);
      } else if (data.error) {
        setMensajes([...nuevosM, { role: "assistant", content: `Error: ${data.error}` }]);
      }
    } catch {
      setMensajes([...nuevosM, { role: "assistant", content: "No pude conectarme. Verifica tu conexión." }]);
    } finally {
      setCargando(false);
    }
  }

  if (!isAuthenticated || !usuario) return null;

  const rol = usuario.rol ?? "docente";
  const label = LABEL_ROL[rol] ?? "Asistente IA";
  const placeholder = PLACEHOLDER_ROL[rol] ?? "Escribe tu pregunta...";

  return (
    <div style={{ position: "fixed", bottom: pos.bottom, right: pos.right, zIndex: 300, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>

      {/* Panel de chat */}
      {abierto && visible && (
        <div style={{
          width: 340, maxHeight: "70vh",
          background: "hsl(var(--card))", border: "1px solid var(--borde)",
          borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.25)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header — drag handle */}
          <div
            onMouseDown={onDragStart}
            style={{
              background: "var(--azul-600)", color: "white",
              padding: "12px 14px", display: "flex", alignItems: "center", gap: 8,
              cursor: "grab", userSelect: "none",
            }}
          >
            <Bot size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
              <div style={{ fontSize: 10, opacity: 0.8 }}>Asistente IA · {usuario.first_name}</div>
            </div>
            <button
              onClick={() => setMensajes([])}
              title="Limpiar conversación"
              style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 6, color: "white", cursor: "pointer", padding: "3px 6px", fontSize: 10 }}
            >
              Nueva
            </button>
            <button onClick={() => setAbierto(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 2 }}>
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, background: "hsl(var(--card))" }}>
            {mensajes.length === 0 && (
              <div style={{ textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 12, padding: "20px 8px" }}>
                <Bot size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                <div style={{ opacity: 0.7 }}>Haz una pregunta para empezar.</div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "85%", padding: "8px 12px", borderRadius: 12,
                  fontSize: 13, lineHeight: 1.5,
                  background: m.role === "user" ? "#2563eb" : "hsl(var(--muted))",
                  color: m.role === "user" ? "#ffffff" : "hsl(var(--foreground))",
                  borderBottomRightRadius: m.role === "user" ? 4 : 12,
                  borderBottomLeftRadius: m.role === "assistant" ? 4 : 12,
                  border: m.role === "assistant" ? "1px solid var(--borde)" : "none",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {cargando && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "hsl(var(--muted))", border: "1px solid var(--borde)", borderRadius: "12px 12px 12px 4px", padding: "10px 14px", fontSize: 20, letterSpacing: 2, color: "hsl(var(--foreground))" }}>
                  ···
                </div>
              </div>
            )}

            {sinConfig && (
              <div style={{
                background: "var(--amarillo-50)", border: "1px solid var(--amarillo-300)",
                borderRadius: 10, padding: "10px 12px", fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin IA configurada</div>
                <div style={{ color: "var(--muted-foreground)", marginBottom: 8 }}>
                  Configura tu API de IA propia para usar el asistente.
                </div>
                <Link to="/mi-ia" onClick={() => setAbierto(false)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--azul-600)", fontWeight: 600 }}>
                  Ir a Mi API de IA <ExternalLink size={11} />
                </Link>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid var(--borde)", display: "flex", gap: 6, alignItems: "flex-end", background: "hsl(var(--card))" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder={placeholder}
              rows={1}
              style={{
                flex: 1, resize: "none", border: "1px solid var(--borde)", borderRadius: 8,
                padding: "8px 10px", fontSize: 13, lineHeight: 1.4,
                background: "hsl(var(--background))", color: "hsl(var(--foreground))",
                maxHeight: 80, overflowY: "auto",
              }}
            />
            <button
              onClick={enviar}
              disabled={!input.trim() || cargando}
              style={{
                width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer",
                background: input.trim() && !cargando ? "var(--azul-600)" : "var(--muted)",
                color: input.trim() && !cargando ? "white" : "var(--muted-foreground)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s", flexShrink: 0,
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Controles del botón flotante */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Toggle mostrar/ocultar (X) */}
        {visible && (
          <button
            onClick={toggleVisible}
            title="Ocultar asistente"
            style={{
              width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--borde)",
              background: "var(--card)", cursor: "pointer", color: "var(--muted-foreground)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10,
            }}
          >
            <X size={12} />
          </button>
        )}

        {/* Botón principal */}
        {visible ? (
          <button
            onClick={() => setAbierto(v => !v)}
            title={label}
            style={{
              width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
              background: abierto ? "var(--azul-700)" : "var(--azul-600)",
              color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(37,99,235,.4)",
              transition: "all .15s",
            }}
          >
            {abierto ? <ChevronDown size={22} /> : <Sparkles size={22} />}
          </button>
        ) : (
          <button
            onClick={toggleVisible}
            title="Mostrar asistente IA"
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "1px dashed var(--borde)",
              background: "var(--card)", cursor: "pointer", color: "var(--muted-foreground)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10,
            }}
          >
            <Sparkles size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
