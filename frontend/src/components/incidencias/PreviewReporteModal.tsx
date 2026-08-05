import { useEffect, useState } from "react";
import api from "../../services/api";
import type { KPIsIncidencias } from "../../types/incidencia";
import { ESTADO_LABEL, PRIORIDAD_LABEL, TIPO_LABEL } from "../../types/incidencia";
import { descargarBlob } from "../../services/incidencias";
import Icon from "../ui/Icon";
import { useInstitucion } from "../../context/InstitucionContext";

interface PreviewData {
  mes: string;
  mes_etiqueta: string;
  kpis: KPIsIncidencias;
  texto_ia: string;
}

export default function PreviewReporteModal({ onCerrar }: { onCerrar: () => void }) {
  const institucion = useInstitucion();
  const [data, setData] = useState<PreviewData | null>(null);
  const [textoEditado, setTextoEditado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [regenerando, setRegenerando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setError(null);
    setCargando(true);
    try {
      const { data } = await api.get<PreviewData>("/incidencias/reporte-mensual-preview/");
      setData(data);
      setTextoEditado(data.texto_ia);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Error al generar la previsualización");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function regenerar() {
    setRegenerando(true);
    try {
      await cargar();
    } finally {
      setRegenerando(false);
    }
  }

  async function descargar() {
    if (!data) return;
    setDescargando(true);
    try {
      const resp = await api.post(
        "/incidencias/reporte-mensual-word/",
        { mes: data.mes, texto: textoEditado },
        { responseType: "blob" }
      );
      descargarBlob(resp.data, `reporte_incidencias_${data.mes}.docx`);
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <span className="chip-ia" style={{ marginRight: 8 }}>IA</span>
            Reporte mensual — Previsualización
            {data && ` · ${data.mes_etiqueta}`}
          </h3>
          <button onClick={onCerrar} className="modal-cerrar" aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body">
          {cargando && <p className="ia-loading">Consultando IA y generando resumen...</p>}
          {error && <p className="form-error">{error}</p>}

          {data && !cargando && (
            <>
              <div className="preview-encabezado">
                <div className="preview-inst-nombre">{(institucion.nombre || "Institución Educativa").toUpperCase()}</div>
                <div className="preview-inst-sub">
                  {institucion.codigo_modular && `Código modular: ${institucion.codigo_modular}`}
                  {institucion.codigo_modular && institucion.ugel && " · "}
                  {institucion.ugel}
                </div>
              </div>

              <h3 className="preview-titulo">
                REPORTE MENSUAL DE INCIDENCIAS TIC — {data.mes_etiqueta.toUpperCase()}
              </h3>

              <div className="preview-seccion">
                <div className="preview-seccion-cabecera">
                  <h4>1. Resumen ejecutivo</h4>
                  <button
                    className="btn-mini btn-icono"
                    onClick={regenerar}
                    disabled={regenerando}
                  >
                    {regenerando ? "Regenerando..." : <><Icon name="sync" size={12} /> Regenerar con IA</>}
                  </button>
                </div>
                <div className="preview-hint">
                  Puedes editar el texto abajo antes de descargar. Los cambios se guardan en el Word final.
                </div>
                <textarea
                  className="form-input preview-textarea"
                  rows={10}
                  value={textoEditado}
                  onChange={(e) => setTextoEditado(e.target.value)}
                />
                <p className="preview-contador">{textoEditado.length} caracteres · {textoEditado.split(/\s+/).filter(Boolean).length} palabras</p>
              </div>

              <div className="preview-seccion">
                <h4>2. Indicadores del periodo</h4>
                <table className="preview-tabla">
                  <tbody>
                    <tr><td>Total de incidencias registradas</td><td><strong>{data.kpis.total}</strong></td></tr>
                    <tr><td>Tiempo promedio de resolución (horas)</td><td><strong>{data.kpis.tiempo_promedio_resolucion_horas}</strong></td></tr>
                  </tbody>
                </table>

                <div className="preview-tablas-grid">
                  <div>
                    <h5>Por estado</h5>
                    <table className="preview-tabla">
                      <tbody>
                        {Object.entries(data.kpis.por_estado)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => (
                            <tr key={k}><td>{ESTADO_LABEL[k as keyof typeof ESTADO_LABEL] ?? k}</td><td>{v}</td></tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h5>Por tipo de equipo</h5>
                    <table className="preview-tabla">
                      <tbody>
                        {Object.entries(data.kpis.por_tipo)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => (
                            <tr key={k}><td>{TIPO_LABEL[k as keyof typeof TIPO_LABEL] ?? k}</td><td>{v}</td></tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h5>Por prioridad</h5>
                    <table className="preview-tabla">
                      <tbody>
                        {Object.entries(data.kpis.por_prioridad)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => (
                            <tr key={k}><td>{PRIORIDAD_LABEL[k as keyof typeof PRIORIDAD_LABEL] ?? k}</td><td>{v}</td></tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {data.kpis.por_ubicacion_top5.length > 0 && (
                    <div>
                      <h5>Ambientes top 5</h5>
                      <table className="preview-tabla">
                        <tbody>
                          {data.kpis.por_ubicacion_top5.map((u) => (
                            <tr key={u.ubicacion}><td>{u.ubicacion}</td><td>{u.count}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="preview-seccion">
                <h4>3. Responsables</h4>
                <p style={{ fontSize: 12.5, color: "var(--texto-mute)" }}>
                  Firmas de Administrador TIC y Dirección. Se agregan en el documento final.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-ia btn-icono" onClick={descargar} disabled={descargando || cargando}>
            {descargando ? "Generando Word..." : <><Icon name="word" /> Descargar Word</>}
          </button>
        </div>
      </div>
    </div>
  );
}
