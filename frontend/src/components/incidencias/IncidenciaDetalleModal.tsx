import { useState } from "react";
import type { EstadoIncidencia, Incidencia } from "../../types/incidencia";
import {
  ESTADO_LABEL,
  PRIORIDAD_LABEL,
  TIPO_LABEL,
} from "../../types/incidencia";
import { actualizarIncidencia } from "../../services/incidencias";
import EstadoBadge from "./EstadoBadge";
import SugerenciaIAPanel from "./SugerenciaIA";
import ConversacionIncidencia from "./ConversacionIncidencia";

interface Props {
  incidencia: Incidencia;
  modo: "docente" | "admin" | "director";
  onCerrar: () => void;
  onActualizada: () => void;
}

export default function IncidenciaDetalleModal({
  incidencia,
  modo,
  onCerrar,
  onActualizada,
}: Props) {
  const [notas, setNotas] = useState(incidencia.notas_admin);
  const [solucion, setSolucion] = useState(incidencia.solucion);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aplicarCambio(payload: Partial<Incidencia>) {
    setError(null);
    setEnviando(true);
    try {
      await actualizarIncidencia(incidencia.id, payload);
      onActualizada();
    } catch (err) {
      const anyErr = err as { response?: { data?: unknown } };
      setError(
        anyErr.response?.data
          ? JSON.stringify(anyErr.response.data)
          : "Error al actualizar"
      );
    } finally {
      setEnviando(false);
    }
  }

  async function tomar() {
    await aplicarCambio({ estado: "en_atencion" as EstadoIncidencia, notas_admin: notas });
  }

  async function marcarResuelta() {
    if (!solucion.trim()) {
      setError("Debe indicar la solución antes de marcar como resuelta.");
      return;
    }
    await aplicarCambio({
      estado: "resuelta" as EstadoIncidencia,
      notas_admin: notas,
      solucion,
    });
  }

  async function cerrarIncidencia() {
    await aplicarCambio({ estado: "cerrada" as EstadoIncidencia });
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Incidencia #{incidencia.id}</h3>
          <button onClick={onCerrar} className="modal-cerrar" aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">
          <p><strong>Título:</strong> {incidencia.titulo}</p>
          <p><strong>Descripción:</strong> {incidencia.descripcion}</p>
          <p><strong>Ubicación:</strong> {incidencia.ubicacion}</p>
          <p><strong>Tipo:</strong> {TIPO_LABEL[incidencia.tipo]}</p>
          <p><strong>Prioridad:</strong> {PRIORIDAD_LABEL[incidencia.prioridad]}</p>
          <p><strong>Estado:</strong> <EstadoBadge estado={incidencia.estado} /></p>
          <p><strong>Reportado por:</strong> {incidencia.reportado_por_nombre || "—"}</p>
          {incidencia.asignado_a_nombre && (
            <p><strong>Asignado a:</strong> {incidencia.asignado_a_nombre}</p>
          )}
          {incidencia.fecha_atencion && (
            <p><strong>Atendido:</strong> {new Date(incidencia.fecha_atencion).toLocaleString("es-PE")}</p>
          )}
          {incidencia.fecha_resolucion && (
            <p><strong>Resuelto:</strong> {new Date(incidencia.fecha_resolucion).toLocaleString("es-PE")}</p>
          )}

          {modo === "admin" && (
            <>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Notas del administrador</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Solución</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={solucion}
                  onChange={(e) => setSolucion(e.target.value)}
                  placeholder="Requerido para marcar como resuelta"
                />
              </div>

              <SugerenciaIAPanel
                incidenciaId={incidencia.id}
                onAplicarANotas={(t) => setNotas((prev) => (prev ? `${prev}\n\n${t}` : t))}
                onAplicarASolucion={(t) => setSolucion((prev) => (prev ? `${prev}\n\n${t}` : t))}
              />
            </>
          )}

          {(modo === "director" || modo === "docente") && incidencia.solucion && (
            <p><strong>Solución:</strong> {incidencia.solucion}</p>
          )}
          {(modo === "director" || modo === "docente") && incidencia.notas_admin && (
            <p><strong>Notas:</strong> {incidencia.notas_admin}</p>
          )}

          {incidencia.foto && (
            <div className="incidencia-foto">
              <strong>Foto adjunta:</strong>
              <a href={incidencia.foto} target="_blank" rel="noopener noreferrer">
                <img src={incidencia.foto} alt="Foto de la incidencia" />
              </a>
            </div>
          )}

          {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}

          <ConversacionIncidencia incidenciaId={incidencia.id} />
        </div>

        <div className="modal-footer">
          {modo === "admin" && incidencia.estado === "nueva" && (
            <button className="btn btn-primario" onClick={tomar} disabled={enviando} style={{ width: "auto" }}>
              Tomar (pasar a atención)
            </button>
          )}
          {modo === "admin" && incidencia.estado === "en_atencion" && (
            <button className="btn btn-primario" onClick={marcarResuelta} disabled={enviando} style={{ width: "auto" }}>
              Marcar como resuelta
            </button>
          )}
          {modo === "docente" && incidencia.estado === "resuelta" && (
            <button className="btn btn-primario" onClick={cerrarIncidencia} disabled={enviando} style={{ width: "auto" }}>
              Cerrar incidencia
            </button>
          )}
          <button className="btn btn-secundario" onClick={onCerrar}>Cerrar ventana</button>
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--texto-mute)" }}>
          Estado actual: {ESTADO_LABEL[incidencia.estado]}
        </div>
      </div>
    </div>
  );
}
