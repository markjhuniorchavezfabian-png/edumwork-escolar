import { useState } from "react";
import { resumenEjecutivoIA } from "../../services/ia";

/** Renderer mínimo de markdown (headings, negrita, listas). Suficiente para lo que devuelve el LLM. */
function renderMarkdown(md: string): string {
  const lineas = md.split("\n");
  const out: string[] = [];
  let enLista = false;
  for (const raw of lineas) {
    const l = raw.trim();
    if (!l) {
      if (enLista) { out.push("</ul>"); enLista = false; }
      out.push("");
      continue;
    }
    if (l.startsWith("### ")) { if (enLista) { out.push("</ul>"); enLista = false; } out.push(`<h4>${escape(l.slice(4))}</h4>`); continue; }
    if (l.startsWith("## "))  { if (enLista) { out.push("</ul>"); enLista = false; } out.push(`<h3>${escape(l.slice(3))}</h3>`); continue; }
    if (l.startsWith("# "))   { if (enLista) { out.push("</ul>"); enLista = false; } out.push(`<h3>${escape(l.slice(2))}</h3>`); continue; }
    if (l.startsWith("- ") || l.startsWith("* ")) {
      if (!enLista) { out.push("<ul>"); enLista = true; }
      out.push(`<li>${negrita(escape(l.slice(2)))}</li>`);
      continue;
    }
    if (enLista) { out.push("</ul>"); enLista = false; }
    out.push(`<p>${negrita(escape(l))}</p>`);
  }
  if (enLista) out.push("</ul>");
  return out.join("\n");
}

function escape(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function negrita(s: string) { return s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }

export default function ResumenEjecutivoCard() {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<string>("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setError(null);
    setCargando(true);
    try {
      const r = await resumenEjecutivoIA();
      setMarkdown(r.markdown);
      setPeriodo(r.periodo);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Fallo al generar el resumen");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="card resumen-ia-card">
      <div className="card-header">
        <span>Resumen ejecutivo · IA</span>
        {markdown && !cargando && (
          <button type="button" className="btn-mini" onClick={generar}>Regenerar</button>
        )}
      </div>
      <div className="card-body">
        {!markdown && !cargando && !error && (
          <div className="resumen-placeholder">
            <p>Genera un resumen ejecutivo automático de las incidencias de la semana.</p>
            <button type="button" className="btn btn-ia" onClick={generar} style={{ width: "auto" }}>
              ✨ Generar resumen con IA
            </button>
          </div>
        )}
        {cargando && <p className="ia-loading">Generando resumen...</p>}
        {error && <p className="form-error">{error}</p>}
        {markdown && (
          <>
            <div className="resumen-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
            <p className="resumen-footer">Periodo: {periodo}. Generado por IA — revisar antes de decisiones formales.</p>
          </>
        )}
      </div>
    </div>
  );
}
