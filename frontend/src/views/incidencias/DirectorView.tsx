import { useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import KPICards from "../../components/incidencias/KPICards";
import IncidenciaTabla from "../../components/incidencias/IncidenciaTabla";
import IncidenciaDetalleModal from "../../components/incidencias/IncidenciaDetalleModal";
import ResumenEjecutivoCard from "../../components/incidencias/ResumenEjecutivoCard";
import GraficosKPI from "../../components/incidencias/GraficosKPI";
import PreviewReporteModal from "../../components/incidencias/PreviewReporteModal";
import IncidenciaForm from "../../components/incidencias/IncidenciaForm";
import {
  listarIncidencias,
  obtenerKPIs,
  descargarExcel,
  descargarBlob,
} from "../../services/incidencias";
import type { Incidencia, KPIsIncidencias } from "../../types/incidencia";

export default function DirectorView() {
  const [kpis, setKpis] = useState<KPIsIncidencias | null>(null);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionada, setSeleccionada] = useState<Incidencia | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const [k, lista] = await Promise.all([obtenerKPIs(), listarIncidencias()]);
        setKpis(k);
        setIncidencias(lista);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function exportarExcel() {
    const blob = await descargarExcel();
    descargarBlob(blob, `incidencias_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  async function recargar() {
    const [k, lista] = await Promise.all([obtenerKPIs(), listarIncidencias()]);
    setKpis(k);
    setIncidencias(lista);
  }

  if (cargando) return <p>Cargando panel...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Panel de Incidencias TI</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secundario btn-icono" onClick={exportarExcel} style={{ padding: "8px 14px" }}>
            <Icon name="excel" /> Descargar Excel
          </button>
          <button className="btn btn-primario" onClick={() => setMostrarForm(true)} style={{ padding: "8px 14px", width: "auto" }}>
            + Nueva incidencia
          </button>
          <button className="btn btn-ia btn-icono" onClick={() => setMostrarPreview(true)} style={{ padding: "8px 14px" }}>
            <Icon name="word" /> Reporte Word (IA)
          </button>
        </div>
      </div>

      <ResumenEjecutivoCard />

      {kpis && <KPICards kpis={kpis} />}

      {kpis && <GraficosKPI kpis={kpis} />}

      {kpis && kpis.por_ubicacion_top5.length > 0 && (
        <Card titulo="Ubicaciones con más incidencias">
          <ul>
            {kpis.por_ubicacion_top5.map((u) => (
              <li key={u.ubicacion}>
                <strong>{u.ubicacion}</strong>: {u.count}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card titulo={`Todas las incidencias (${incidencias.length})`}>
        <IncidenciaTabla
          incidencias={incidencias}
          onSeleccionar={setSeleccionada}
          mostrarReportadoPor
        />
      </Card>

      {seleccionada && (
        <IncidenciaDetalleModal
          incidencia={seleccionada}
          modo="director"
          onCerrar={() => setSeleccionada(null)}
          onActualizada={() => setSeleccionada(null)}
        />
      )}

      {mostrarPreview && <PreviewReporteModal onCerrar={() => setMostrarPreview(false)} />}

      {mostrarForm && (
        <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reportar nueva incidencia</h3>
              <button onClick={() => setMostrarForm(false)} className="modal-cerrar" aria-label="Cerrar">×</button>
            </div>
            <div className="modal-body">
              <IncidenciaForm
                onCreada={() => { setMostrarForm(false); recargar(); }}
                onCancelar={() => setMostrarForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
