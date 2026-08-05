import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useToast } from "../components/ui/Toast";
import { usePrompt } from "../components/ui/Confirm";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { EmptyState, Cargando } from "../components/ui/Spinner";
import { fechaCorta } from "../utils/fechas";

interface Justificacion {
  id: number;
  estudiante_nombre: string;
  estudiante_seccion: string;
  fecha_falta: string;
  motivo_label: string;
  descripcion: string;
  constancia: string | null;
  reportada_por_nombre: string;
  estado: string;
  estado_label: string;
  razon_rechazo: string;
  puede_gestionar: boolean;
  creado_en: string;
}

export default function JustificacionesView() {
  const toast = useToast();
  const pedirTexto = usePrompt();
  const [items, setItems] = useState<Justificacion[]>([]);
  const [filtro, setFiltro] = useState("pendiente");
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get<{ results?: Justificacion[] } | Justificacion[]>(
        `/justificaciones/${filtro ? "?estado=" + filtro : ""}`
      );
      const list = Array.isArray(data) ? data : (data as { results?: Justificacion[] }).results ?? [];
      setItems(list);
    } finally { setCargando(false); }
  }, [filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  async function aprobar(j: Justificacion) {
    try {
      await api.post(`/justificaciones/${j.id}/aprobar/`);
      toast.ok("Justificación aprobada.");
      cargar();
    } catch { toast.error("Error al aprobar."); }
  }

  async function rechazar(j: Justificacion) {
    const razon = await pedirTexto({
      titulo: "Rechazar justificación",
      mensaje: `Explica al padre/madre por qué se rechaza la justificación de ${j.estudiante_nombre}.`,
      placeholder: "Ej.: falta constancia médica válida",
      multilinea: true,
    });
    if (razon === null) return;
    try {
      await api.post(`/justificaciones/${j.id}/rechazar/`, { razon });
      toast.ok("Rechazada.");
      cargar();
    } catch { toast.error("Error."); }
  }

  return (
    <div>
      <h2 className="page-title">Justificaciones de faltas</h2>
      <Card titulo={
        <span>
          <span>Registros ({items.length})</span>
          <span style={{ marginLeft: 12 }}>
            <select className="form-input" style={{ padding: "4px 10px", fontSize: 12 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="pendiente">Pendientes</option>
              <option value="aprobada">Aprobadas</option>
              <option value="rechazada">Rechazadas</option>
              <option value="">Todos</option>
            </select>
          </span>
        </span>
      }>
        {cargando ? <Cargando inline /> :
          items.length === 0 ? <EmptyState icono="editar" titulo="Sin justificaciones" descripcion="Cuando un padre reporte, aparecerá aquí." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((j) => (
                <div key={j.id} className="card" style={{ marginBottom: 0, borderLeft: `3px solid ${j.estado === "aprobada" ? "var(--verde-600)" : j.estado === "rechazada" ? "var(--rojo-600)" : "var(--amarillo-600)"}` }}>
                  <div className="card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <strong>{j.estudiante_nombre}</strong>
                        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--texto-mute)" }}>{j.estudiante_seccion}</span>
                      </div>
                      <span className="badge" style={{
                        background: j.estado === "aprobada" ? "var(--verde-50)" : j.estado === "rechazada" ? "var(--rojo-50)" : "var(--amarillo-50)",
                        color: j.estado === "aprobada" ? "var(--verde-600)" : j.estado === "rechazada" ? "var(--rojo-600)" : "var(--amarillo-600)",
                      }}>{j.estado_label}</span>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      <strong>Fecha:</strong> {fechaCorta(j.fecha_falta)} · <strong>Motivo:</strong> {j.motivo_label}
                    </div>
                    <p style={{ fontSize: 13, marginTop: 4 }}>{j.descripcion}</p>
                    <div style={{ fontSize: 11, color: "var(--texto-mute)", marginTop: 4 }}>
                      Reportada por {j.reportada_por_nombre} · {new Date(j.creado_en).toLocaleString("es-PE")}
                    </div>
                    {j.constancia && (
                      <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
                        <a href={j.constancia} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Icon name="adjunto" size={12} /> Ver constancia
                        </a>
                        <a href={j.constancia} download style={{ fontSize: 12, color: "var(--verde-600)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Icon name="descargar" size={12} /> Descargar
                        </a>
                        {/\.(jpe?g|png|webp)$/i.test(j.constancia) && (
                          <img src={j.constancia} alt="Vista previa" style={{ maxHeight: 60, borderRadius: 4, border: "1px solid var(--borde)" }} />
                        )}
                      </div>
                    )}
                    {j.razon_rechazo && <div style={{ fontSize: 12, color: "var(--rojo-600)", marginTop: 4 }}>Rechazo: {j.razon_rechazo}</div>}
                    {j.estado === "pendiente" && j.puede_gestionar && (
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button className="btn-mini btn-icono" style={{ color: "var(--verde-600)" }} onClick={() => aprobar(j)}><Icon name="aprobar" size={12} /> Aprobar</button>
                        <button className="btn-mini btn-icono" style={{ color: "var(--rojo-600)" }} onClick={() => rechazar(j)}><Icon name="rechazar" size={12} /> Rechazar</button>
                      </div>
                    )}
                    {j.estado === "pendiente" && !j.puede_gestionar && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--texto-mute)", fontStyle: "italic" }}>
                        En espera de revisión del tutor de {j.estudiante_seccion} o auxiliar.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </Card>
    </div>
  );
}
