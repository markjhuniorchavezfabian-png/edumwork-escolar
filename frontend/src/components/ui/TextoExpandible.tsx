import { useState } from "react";

interface Props {
  texto: string;
  maxChars?: number;
  className?: string;
}

/**
 * Muestra texto truncado con "ver más / ver menos".
 * Por defecto corta a 90 caracteres (≈ 1 línea en tabla).
 */
export default function TextoExpandible({ texto, maxChars = 90, className }: Props) {
  const [expandido, setExpandido] = useState(false);

  if (!texto) return <span style={{ opacity: 0.35, fontStyle: "italic", fontSize: "inherit" }}>—</span>;

  const corto = texto.length > maxChars;

  return (
    <span className={className} style={{ fontSize: "inherit" }}>
      {expandido || !corto ? texto : texto.slice(0, maxChars) + "…"}
      {corto && (
        <button
          onClick={e => { e.stopPropagation(); setExpandido(v => !v); }}
          style={{
            marginLeft: 6, fontSize: "0.75em", fontWeight: 600,
            color: "var(--primary)", background: "none",
            border: "none", cursor: "pointer", padding: 0,
            whiteSpace: "nowrap",
          }}
        >
          {expandido ? "ver menos" : "ver más"}
        </button>
      )}
    </span>
  );
}
