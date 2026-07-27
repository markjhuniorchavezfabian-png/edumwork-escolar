import { useState } from "react";
import { sugerirSolucionIA } from "../../services/ia";
import type { SugerenciaIA } from "../../types/ia";

interface Props {
  incidenciaId: number;
  onAplicarANotas?: (texto: string) => void;
  onAplicarASolucion?: (texto: string) => void;
}

export default function SugerenciaIAPanel({ incidenciaId, onAplicarANotas, onAplicarASolucion }: Props) {
  const [sugerencia, setSugerencia] = useState<SugerenciaIA | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setError(null);
    setCargando(true);
    try {
      const r = await sugerirSolucionIA(incidenciaId);
      setSugerencia(r);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Fallo al consultar la IA");
    } finally {
      setCargando(false);
    }
  }

  const pasosTexto = () => sugerencia?.pasos.map((p, i) => `${i + 1}. ${p}`).join("\n") ?? "";

  if (!sugerencia && !cargando && !error) {
    return (
      <button
        type="button"
        className="btn btn-ia"
        onClick={generar}
        style={{ marginTop: 8, width: "auto" }}
      >
        ✨ Sugerir diagnóstico con IA
      </button>
    );
  }

  return (
    <div className="ia-panel">
      <div className="ia-panel-header">
        <span className="ia-badge">IA · Asistente técnico</span>
        {sugerencia && (
          <button type="button" className="btn-mini" onClick={generar} disabled={cargando}>
            Regenerar
          </button>
        )}
      </div>

      {cargando && <p className="ia-loading">Consultando IA...</p>}
      {error && <p className="form-error">{error}</p>}

      {sugerencia && (
        <>
          {sugerencia.posibles_causas.length > 0 && (
            <div className="ia-seccion">
              <h4>Posibles causas</h4>
              <ul>
                {sugerencia.posibles_causas.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}

          <div className="ia-seccion">
            <h4>Pasos de diagnóstico</h4>
            <ol>
              {sugerencia.pasos.map((p, i) => <li key={i}>{p}</li>)}
            </ol>
          </div>

          {sugerencia.notas && (
            <div className="ia-seccion">
              <h4>Notas</h4>
              <p style={{ fontSize: 13 }}>{sugerencia.notas}</p>
            </div>
          )}

          {sugerencia.requiere_repuestos && (
            <div className="ia-alerta">
              La IA sugiere que podrías necesitar repuestos o compra externa.
            </div>
          )}

          <div className="ia-acciones">
            {onAplicarANotas && (
              <button
                type="button"
                className="btn-mini"
                onClick={() => onAplicarANotas(pasosTexto())}
              >
                Copiar pasos a notas
              </button>
            )}
            {onAplicarASolucion && (
              <button
                type="button"
                className="btn-mini"
                onClick={() => onAplicarASolucion(pasosTexto())}
              >
                Copiar a solución
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
