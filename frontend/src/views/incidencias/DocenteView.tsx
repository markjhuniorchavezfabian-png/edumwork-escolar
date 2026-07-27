import { useCallback, useEffect, useState } from "react";
import Card from "../../components/ui/Card";
import IncidenciaForm from "../../components/incidencias/IncidenciaForm";
import IncidenciaTabla from "../../components/incidencias/IncidenciaTabla";
import IncidenciaDetalleModal from "../../components/incidencias/IncidenciaDetalleModal";
import { listarIncidencias } from "../../services/incidencias";
import type { Incidencia } from "../../types/incidencia";
import { Cargando } from "../../components/ui/Spinner";

export default function DocenteView() {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
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

  return (
    <div>
      <h2 className="page-title">Incidencias TI</h2>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          className="btn btn-primario"
          style={{ width: "auto" }}
          onClick={() => setMostrarForm(true)}
        >
          Nueva incidencia
        </button>
      </div>

      <Card titulo="Mis incidencias">
        {cargando ? (
          <Cargando inline />
        ) : (
          <IncidenciaTabla
            incidencias={incidencias}
            onSeleccionar={setSeleccionada}
          />
        )}
      </Card>

      {mostrarForm && (
        <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reportar nueva incidencia</h3>
              <button
                onClick={() => setMostrarForm(false)}
                className="modal-cerrar"
                aria-label="Cerrar"
              >×</button>
            </div>
            <div className="modal-body">
              <IncidenciaForm
                onCreada={() => {
                  setMostrarForm(false);
                  cargar();
                }}
                onCancelar={() => setMostrarForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {seleccionada && (
        <IncidenciaDetalleModal
          incidencia={seleccionada}
          modo="docente"
          onCerrar={() => setSeleccionada(null)}
          onActualizada={() => {
            setSeleccionada(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}
