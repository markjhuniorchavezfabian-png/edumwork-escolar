import { useEffect, useState } from "react";
import type { ComentarioIncidencia } from "../../types/incidencia";
import { listarComentarios, crearComentario } from "../../services/incidencias";

const ROL_LABEL: Record<string, string> = {
  director: "Director",
  docente: "Docente",
  admin_tic: "Admin TIC",
  padre: "Padre",
  estudiante: "Estudiante",
  ugel: "UGEL",
};

export default function ConversacionIncidencia({ incidenciaId }: { incidenciaId: number }) {
  const [comentarios, setComentarios] = useState<ComentarioIncidencia[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    try {
      const r = await listarComentarios(incidenciaId);
      setComentarios(r);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidenciaId]);

  async function enviar() {
    if (!texto.trim()) return;
    setError(null);
    setEnviando(true);
    try {
      await crearComentario(incidenciaId, texto.trim());
      setTexto("");
      await cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Error al enviar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="conversacion">
      <h4 className="conversacion-titulo">Conversación ({comentarios.length})</h4>

      {cargando && <p className="ia-loading">Cargando...</p>}

      {!cargando && comentarios.length === 0 && (
        <p className="conversacion-vacia">Sin comentarios todavía. Sé el primero en escribir.</p>
      )}

      <div className="conversacion-lista">
        {comentarios.map((c) => (
          <div key={c.id} className={`comentario comentario-${c.autor_rol}`}>
            <div className="comentario-cabecera">
              <span className="comentario-autor">{c.autor_nombre}</span>
              <span className="comentario-rol">{ROL_LABEL[c.autor_rol] ?? c.autor_rol}</span>
              <span className="comentario-fecha">
                {new Date(c.creado_en).toLocaleString("es-PE", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <div className="comentario-texto">{c.texto}</div>
          </div>
        ))}
      </div>

      <div className="conversacion-input">
        <textarea
          className="form-input"
          rows={2}
          placeholder="Escribe un comentario..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
          }}
        />
        {error && <p className="form-error" style={{ marginTop: 6 }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "var(--texto-suave)" }}>Ctrl+Enter para enviar</span>
          <button
            type="button"
            className="btn btn-primario"
            style={{ padding: "6px 14px", width: "auto", fontSize: 13 }}
            onClick={enviar}
            disabled={enviando || !texto.trim()}
          >
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
