import { useEffect, useState } from "react";
import type { HijoAsistencia } from "../../types/asistencia";
import { ESTADO_ASISTENCIA_LABEL, ESTADO_ASISTENCIA_COLOR } from "../../types/asistencia";
import { misHijos } from "../../services/asistencia";
import { Cargando } from "../../components/ui/Spinner";
import { fechaCorta } from "../../utils/fechas";

export default function PadreAsistenciaView() {
  const [hijos, setHijos] = useState<HijoAsistencia[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    misHijos().then((r) => setHijos(r.hijos)).finally(() => setCargando(false));
  }, []);

  if (cargando) return <Cargando inline />;

  return (
    <div>
      <h2 className="page-title">Asistencia de mis hijos</h2>

      {hijos.length === 0 && (
        <div className="card">
          <div className="card-body">
            <p>No hay hijos vinculados a tu cuenta. Contacta a la I.E. para asociarlos.</p>
          </div>
        </div>
      )}

      {hijos.map((hijo) => (
        <div key={hijo.estudiante_id} className="card">
          <div className="card-header">
            <span>{hijo.nombre} · {hijo.grado} {hijo.seccion}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: hijo.porcentaje_asistencia >= 90 ? "var(--verde-600)" : hijo.porcentaje_asistencia >= 75 ? "var(--amarillo-600)" : "var(--rojo-600)",
              }}
            >
              {hijo.porcentaje_asistencia}% de asistencia
            </span>
          </div>
          <div className="card-body">
            <div className="hijo-kpis">
              {Object.entries(hijo.por_estado).map(([k, v]) => (
                <div key={k} className="hijo-kpi">
                  <span className="hijo-kpi-valor" style={{ color: ESTADO_ASISTENCIA_COLOR[k as keyof typeof ESTADO_ASISTENCIA_COLOR] }}>{v}</span>
                  <span className="hijo-kpi-label">{ESTADO_ASISTENCIA_LABEL[k as keyof typeof ESTADO_ASISTENCIA_LABEL]}</span>
                </div>
              ))}
            </div>

            <h4 style={{ marginTop: 16, marginBottom: 8, fontSize: 12, color: "var(--slate-700)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Últimos registros
            </h4>
            <table className="tabla-incidencias">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Hora llegada</th>
                  <th>Justificación</th>
                </tr>
              </thead>
              <tbody>
                {hijo.ultimos_10.map((r) => (
                  <tr key={r.id} style={{ cursor: "default" }}>
                    <td>{fechaCorta(r.fecha)}</td>
                    <td>
                      <span className="badge" style={{ background: "var(--slate-100)", color: ESTADO_ASISTENCIA_COLOR[r.estado] }}>
                        {ESTADO_ASISTENCIA_LABEL[r.estado]}
                      </span>
                    </td>
                    <td>{r.hora_llegada || "—"}</td>
                    <td style={{ fontSize: 12 }}>{r.justificacion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
