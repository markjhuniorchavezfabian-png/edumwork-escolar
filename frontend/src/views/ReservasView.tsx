import { useCallback, useEffect, useState } from "react";
import type { KPIsReservas, Reserva } from "../types/reservas";
import { COLOR_ESTADO_RESERVA } from "../types/reservas";
import {
  listarReservas,
  crearReserva,
  aprobarReserva,
  rechazarReserva,
  cancelarReserva,
  kpisReservas,
  listarAmbientesReservables,
  type AmbienteReservable,
} from "../services/reservas";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { useConfirm, usePrompt } from "../components/ui/Confirm";
import Card from "../components/ui/Card";
import { EmptyState, Cargando } from "../components/ui/Spinner";
import Icon from "../components/ui/Icon";
import { fechaCorta } from "../utils/fechas";

const ROLES_APROBADORES = ["director", "subdirector", "secretaria", "admin_tic"];
const ROLES_PUEDEN_SOLICITAR = ["director", "subdirector", "docente", "auxiliar", "psicologa", "admin_tic", "secretaria"];

export default function ReservasView() {
  const { usuario } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const pedirTexto = usePrompt();

  const esAprobador = usuario ? ROLES_APROBADORES.includes(usuario.rol) : false;
  const puedeSolicitar = usuario ? ROLES_PUEDEN_SOLICITAR.includes(usuario.rol) : false;

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [ambientes, setAmbientes] = useState<AmbienteReservable[]>([]);
  const [kpis, setKpis] = useState<KPIsReservas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<string>("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [r, a, k] = await Promise.all([
        listarReservas(filtroEstado ? { estado: filtroEstado } : undefined),
        listarAmbientesReservables(),
        esAprobador ? kpisReservas() : Promise.resolve(null),
      ]);
      setReservas(r);
      setAmbientes(a);
      setKpis(k);
    } finally { setCargando(false); }
  }, [filtroEstado, esAprobador]);

  useEffect(() => { cargar(); }, [cargar]);

  async function aprobar(r: Reserva) {
    try {
      await aprobarReserva(r.id);
      toast.ok(`Reserva aprobada.`);
      cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; conflictos?: unknown[] } } };
      toast.error(err.response?.data?.error ?? "Error al aprobar.");
    }
  }

  async function rechazar(r: Reserva) {
    const razon = await pedirTexto({
      titulo: "Rechazar reserva",
      mensaje: `Explica por qué se rechaza la reserva de ${r.ambiente_nombre} del ${r.fecha}.`,
      placeholder: "Ej.: ambiente ya reservado por otra actividad institucional",
      multilinea: true,
    });
    if (razon === null) return;
    try {
      await rechazarReserva(r.id, razon);
      toast.ok("Reserva rechazada.");
      cargar();
    } catch {
      toast.error("Error al rechazar.");
    }
  }

  async function cancelar(r: Reserva) {
    const ok = await confirmar({
      titulo: "Cancelar reserva",
      mensaje: `¿Cancelar tu reserva de ${r.ambiente_nombre} el ${r.fecha}?`,
      textoConfirmar: "Cancelar reserva",
      variante: "peligro",
    });
    if (!ok) return;
    try {
      await cancelarReserva(r.id);
      toast.ok("Reserva cancelada.");
      cargar();
    } catch {
      toast.error("Error al cancelar.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Reservas de ambientes</h2>
        {puedeSolicitar && (
          <button className="btn btn-primario" onClick={() => setCreando(true)} style={{ padding: "8px 14px", width: "auto" }}>
            + Solicitar reserva
          </button>
        )}
      </div>

      {kpis && (
        <div className="kpi-grid">
          <div className="kpi-card" style={{ borderLeft: kpis.pendientes > 0 ? "3px solid var(--amarillo-600)" : undefined }}>
            <span className="kpi-label">Pendientes</span>
            <span className="kpi-valor" style={{ color: "var(--amarillo-600)" }}>{kpis.pendientes}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Aprobadas</span>
            <span className="kpi-valor" style={{ color: "var(--verde-600)" }}>{kpis.aprobadas}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Rechazadas</span>
            <span className="kpi-valor" style={{ color: "var(--rojo-600)" }}>{kpis.rechazadas}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Total</span>
            <span className="kpi-valor">{kpis.total}</span>
          </div>
        </div>
      )}

      <Card titulo={
        <span>
          <span>Reservas ({reservas.length})</span>
          <span style={{ marginLeft: 12 }}>
            <select className="form-input" style={{ padding: "4px 10px", fontSize: 12 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="solicitada">Solicitadas</option>
              <option value="aprobada">Aprobadas</option>
              <option value="rechazada">Rechazadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </span>
        </span>
      }>
        {cargando ? <Cargando inline /> :
          reservas.length === 0 ? (
            <EmptyState icono="calendario" titulo="Sin reservas" descripcion="Cuando alguien solicite un ambiente aparecerá aquí." />
          ) : (
            <div className="tabla-wrap">
              <table className="tabla-incidencias">
                <thead>
                  <tr>
                    <th>Ambiente</th><th>Fecha</th><th>Horario</th>
                    <th>Solicitante</th><th>Motivo</th><th>Estado</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {reservas.map((r) => (
                    <tr key={r.id} style={{ cursor: "default" }}>
                      <td><strong>{r.ambiente_nombre}</strong></td>
                      <td>{fechaCorta(r.fecha)}</td>
                      <td style={{ fontSize: 12 }}>{r.hora_inicio.slice(0, 5)} — {r.hora_fin.slice(0, 5)}</td>
                      <td>{r.solicitante_nombre}</td>
                      <td style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.motivo}</td>
                      <td>
                        <span className="badge" style={{ background: `${COLOR_ESTADO_RESERVA[r.estado]}22`, color: COLOR_ESTADO_RESERVA[r.estado] }}>
                          {r.estado_label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {esAprobador && r.estado === "solicitada" && (
                            <>
                              <button className="btn-mini btn-icono" style={{ color: "var(--verde-600)" }} onClick={() => aprobar(r)}><Icon name="aprobar" size={12} /> Aprobar</button>
                              <button className="btn-mini btn-icono" style={{ color: "var(--rojo-600)" }} onClick={() => rechazar(r)}><Icon name="rechazar" size={12} /> Rechazar</button>
                            </>
                          )}
                          {(r.solicitante === usuario?.id || esAprobador) && ["solicitada", "aprobada"].includes(r.estado) && (
                            <button className="btn-mini" onClick={() => cancelar(r)}>Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>

      {creando && (
        <NuevaReservaModal
          ambientes={ambientes}
          onCerrar={() => setCreando(false)}
          onCreada={() => { setCreando(false); cargar(); toast.ok("Solicitud de reserva enviada."); }}
        />
      )}
    </div>
  );
}

function NuevaReservaModal({ ambientes, onCerrar, onCreada }: {
  ambientes: AmbienteReservable[]; onCerrar: () => void; onCreada: () => void;
}) {
  const toast = useToast();
  const [datos, setDatos] = useState<Partial<Reserva>>({
    fecha: new Date().toISOString().slice(0, 10),
    hora_inicio: "08:00", hora_fin: "10:00",
    motivo: "", descripcion: "",
  });
  const [enviando, setEnviando] = useState(false);

  async function crear() {
    setEnviando(true);
    try {
      await crearReserva(datos);
      onCreada();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Solicitar reserva de ambiente</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div className="form-aviso" style={{ marginBottom: 12 }}>
            La reserva se envía a secretaría/dirección para aprobación. Recibirás una notificación cuando sea revisada.
          </div>
          <div className="form-field">
            <label className="form-label">Ambiente *</label>
            <select className="form-input" value={datos.ambiente ?? ""} onChange={(e) => setDatos({ ...datos, ambiente: Number(e.target.value) })}>
              <option value="">— Elige un ambiente —</option>
              {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nombre} ({a.tipo_label})</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Fecha *</label>
              <input type="date" className="form-input" value={datos.fecha} onChange={(e) => setDatos({ ...datos, fecha: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Inicio *</label>
              <input type="time" className="form-input" value={datos.hora_inicio} onChange={(e) => setDatos({ ...datos, hora_inicio: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Fin *</label>
              <input type="time" className="form-input" value={datos.hora_fin} onChange={(e) => setDatos({ ...datos, hora_fin: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Motivo *</label>
            <input className="form-input" placeholder="Ej: Clase de laboratorio de Física - 3ro A" value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Descripción (opcional)</label>
            <textarea className="form-input" rows={3} value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Participantes estimados</label>
            <input type="number" className="form-input" value={datos.participantes_estimados ?? ""} onChange={(e) => setDatos({ ...datos, participantes_estimados: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={crear} disabled={enviando || !datos.ambiente || !datos.motivo}>
            {enviando ? "Enviando..." : "Solicitar"}
          </button>
        </div>
      </div>
    </div>
  );
}
