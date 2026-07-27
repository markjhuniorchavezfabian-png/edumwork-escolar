import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import IncidenciaTabla from "../../components/incidencias/IncidenciaTabla";
import IncidenciaDetalleModal from "../../components/incidencias/IncidenciaDetalleModal";
import {
  listarIncidencias,
  descargarExcel,
  descargarBlob,
} from "../../services/incidencias";
import PreviewReporteModal from "../../components/incidencias/PreviewReporteModal";
import type {
  EstadoIncidencia,
  Incidencia,
  PrioridadIncidencia,
} from "../../types/incidencia";
import { ESTADO_LABEL, PRIORIDAD_LABEL } from "../../types/incidencia";
import { Cargando } from "../../components/ui/Spinner";

type FiltroEstado = EstadoIncidencia | "todos";
type FiltroPrioridad = PrioridadIncidencia | "todas";

export default function AdminView() {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [filtroPrioridad, setFiltroPrioridad] = useState<FiltroPrioridad>("todas");
  const [seleccionada, setSeleccionada] = useState<Incidencia | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await listarIncidencias();
      setIncidencias(data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    return incidencias.filter((i) => {
      if (filtroEstado !== "todos" && i.estado !== filtroEstado) return false;
      if (filtroPrioridad !== "todas" && i.prioridad !== filtroPrioridad) return false;
      return true;
    });
  }, [incidencias, filtroEstado, filtroPrioridad]);

  async function exportarExcel() {
    const blob = await descargarExcel();
    descargarBlob(blob, `incidencias_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const [mostrarPreview, setMostrarPreview] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Bandeja de incidencias TI</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secundario btn-icono" onClick={exportarExcel} style={{ padding: "8px 14px" }}>
            <Icon name="excel" /> Descargar Excel
          </button>
          <button className="btn btn-ia btn-icono" onClick={() => setMostrarPreview(true)} style={{ padding: "8px 14px" }}>
            <Icon name="word" /> Reporte Word (IA)
          </button>
        </div>
      </div>

      <Card titulo="Filtros">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="form-group" style={{ minWidth: 180 }}>
            <label className="form-label">Estado</label>
            <select
              className="form-input"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
            >
              <option value="todos">Todos</option>
              {(Object.keys(ESTADO_LABEL) as EstadoIncidencia[]).map((k) => (
                <option key={k} value={k}>{ESTADO_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 180 }}>
            <label className="form-label">Prioridad</label>
            <select
              className="form-input"
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value as FiltroPrioridad)}
            >
              <option value="todas">Todas</option>
              {(Object.keys(PRIORIDAD_LABEL) as PrioridadIncidencia[]).map((k) => (
                <option key={k} value={k}>{PRIORIDAD_LABEL[k]}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card titulo={`Incidencias (${filtradas.length})`}>
        {cargando ? (
          <Cargando inline />
        ) : (
          <IncidenciaTabla
            incidencias={filtradas}
            onSeleccionar={setSeleccionada}
            mostrarReportadoPor
          />
        )}
      </Card>

      {seleccionada && (
        <IncidenciaDetalleModal
          incidencia={seleccionada}
          modo="admin"
          onCerrar={() => setSeleccionada(null)}
          onActualizada={() => {
            setSeleccionada(null);
            cargar();
          }}
        />
      )}

      {mostrarPreview && <PreviewReporteModal onCerrar={() => setMostrarPreview(false)} />}
    </div>
  );
}
