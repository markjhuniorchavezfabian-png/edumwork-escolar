import { useCallback, useEffect, useState } from "react";
import Icon from "../components/ui/Icon";
import type { KPIsVisitas, MotivoInfo, Visita } from "../types/visitas";
import {
  listarVisitas,
  crearVisita,
  marcarSalida,
  obtenerMotivos,
  obtenerKPIsVisitas,
  urlGafeteQR,
} from "../services/visitas";
import { useAuth } from "../hooks/useAuth";
import { useInstitucion } from "../context/InstitucionContext";
import api from "../services/api";
import Card from "../components/ui/Card";
import { EmptyState, Cargando } from "../components/ui/Spinner";

export default function VisitasView() {
  const { usuario } = useAuth();
  const rol = usuario?.rol;

  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [motivos, setMotivos] = useState<MotivoInfo[]>([]);
  const [kpis, setKpis] = useState<KPIsVisitas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [gafeteVisita, setGafeteVisita] = useState<Visita | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "dentro" | "salidos">("todos");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [lista, mot, k] = await Promise.all([
        listarVisitas(filtro === "todos" ? undefined : { estado: filtro }),
        obtenerMotivos(),
        rol === "director" || rol === "admin_tic" ? obtenerKPIsVisitas() : Promise.resolve(null),
      ]);
      setVisitas(lista);
      setMotivos(mot);
      setKpis(k);
    } finally {
      setCargando(false);
    }
  }, [filtro, rol]);

  useEffect(() => { cargar(); }, [cargar]);

  async function darSalida(v: Visita) {
    await marcarSalida(v.id);
    cargar();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Control de Visitas</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primario" onClick={() => setMostrarNueva(true)} style={{ padding: "8px 14px", width: "auto" }}>
            + Registrar visita
          </button>
        </div>
      </div>

      {kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Dentro ahora</span>
            <span className="kpi-valor" style={{ color: "var(--azul-600)" }}>{kpis.dentro_ahora}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Hoy</span>
            <span className="kpi-valor">{kpis.hoy}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Esta semana</span>
            <span className="kpi-valor">{kpis.semana}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Duración promedio</span>
            <span className="kpi-valor" style={{ fontSize: 22 }}>{kpis.duracion_promedio_minutos} <small style={{ fontSize: 13 }}>min</small></span>
          </div>
        </div>
      )}

      {kpis && kpis.top_motivos_mes.length > 0 && (
        <Card titulo="Motivos más frecuentes (últimos 30 días)">
          <ul>
            {kpis.top_motivos_mes.map((m, i) => (
              <li key={i}><strong>{m.motivo}</strong>: {m.cantidad}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card titulo={
        <span>
          <span>Registro de visitas ({visitas.length})</span>
          <span style={{ marginLeft: 12, display: "inline-flex", gap: 6 }}>
            {(["todos", "dentro", "salidos"] as const).map((f) => (
              <button
                key={f}
                className={`btn-mini ${filtro === f ? "activo" : ""}`}
                style={filtro === f ? { background: "var(--azul-600)", color: "var(--blanco)", borderColor: "transparent" } : {}}
                onClick={() => setFiltro(f)}
              >
                {f === "todos" ? "Todos" : f === "dentro" ? "Dentro ahora" : "Salidos"}
              </button>
            ))}
          </span>
        </span>
      }>
        {cargando ? <Cargando inline /> : visitas.length === 0 ? (
          <EmptyState
            icono="puerta"
            titulo={filtro === "dentro" ? "Sin visitas dentro ahora" : filtro === "salidos" ? "Aún nadie ha salido" : "Sin visitas registradas"}
            descripcion={filtro === "todos" ? "Registra la primera visita del día con 'Registrar visita'." : "Cambia el filtro para ver otras visitas."}
          />
        ) : (
          <table className="tabla-incidencias">
            <thead>
              <tr>
                <th>Visitante</th><th>DNI</th><th>Motivo</th>
                <th>Visita a</th><th>Entrada</th><th>Salida</th>
                <th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visitas.map((v) => (
                <tr key={v.id} style={{ cursor: "default" }}>
                  <td><strong>{v.nombre_completo}</strong></td>
                  <td><code style={{ fontSize: 12 }}>{v.dni}</code></td>
                  <td>{v.motivo_label}</td>
                  <td>{v.a_quien_visita}</td>
                  <td>{new Date(v.hora_entrada).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{v.hora_salida ? new Date(v.hora_salida).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>
                    {v.dentro ? (
                      <span className="badge" style={{ background: "var(--azul-100)", color: "var(--azul-800)" }}>DENTRO</span>
                    ) : (
                      <span className="badge" style={{ background: "var(--slate-200)", color: "var(--slate-700)" }}>SALIÓ · {v.duracion_minutos}m</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {v.dentro && (
                        <button className="btn-mini" onClick={() => darSalida(v)}>Marcar salida</button>
                      )}
                      <button className="btn-mini" onClick={() => setGafeteVisita(v)}>Ver gafete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {mostrarNueva && (
        <NuevaVisitaModal
          motivos={motivos}
          onCerrar={() => setMostrarNueva(false)}
          onCreada={(v) => { setMostrarNueva(false); cargar(); setGafeteVisita(v); }}
        />
      )}

      {gafeteVisita && (
        <GafeteModal visita={gafeteVisita} onCerrar={() => setGafeteVisita(null)} />
      )}
    </div>
  );
}

// ── Modal: nueva visita ──────────────────────────────────────────────────────
function NuevaVisitaModal({ motivos, onCerrar, onCreada }: { motivos: MotivoInfo[]; onCerrar: () => void; onCreada: (v: Visita) => void }) {
  const [datos, setDatos] = useState<Partial<Visita>>({
    dni: "", nombre_completo: "", telefono: "",
    motivo: "apoderado", a_quien_visita: "", observaciones: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null); setEnviando(true);
    try {
      const v = await crearVisita(datos);
      onCreada(v);
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setError(JSON.stringify(err.response?.data));
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Registrar visita</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label className="form-label">DNI *</label>
            <input className="form-input" maxLength={8} value={datos.dni ?? ""} onChange={(e) => setDatos({ ...datos, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
          </div>
          <div className="form-field">
            <label className="form-label">Nombre completo *</label>
            <input className="form-input" value={datos.nombre_completo ?? ""} onChange={(e) => setDatos({ ...datos, nombre_completo: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Teléfono (opcional)</label>
            <input className="form-input" value={datos.telefono ?? ""} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Motivo de la visita</label>
            <select className="form-input" value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value as Visita["motivo"] })}>
              {motivos.map((m) => <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">¿A quién visita? *</label>
            <input className="form-input" placeholder="Nombre o cargo (ej: Director, Dr. Baldeón, Tutoría 3ro A)" value={datos.a_quien_visita ?? ""} onChange={(e) => setDatos({ ...datos, a_quien_visita: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Observaciones</label>
            <textarea className="form-input" rows={2} value={datos.observaciones ?? ""} onChange={(e) => setDatos({ ...datos, observaciones: e.target.value })} />
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar} disabled={enviando}>{enviando ? "Registrando..." : "Registrar + generar gafete"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: gafete imprimible ─────────────────────────────────────────────────
function GafeteModal({ visita, onCerrar }: { visita: Visita; onCerrar: () => void }) {
  const institucion = useInstitucion();
  const [qrBlob, setQrBlob] = useState<string | null>(null);

  useEffect(() => {
    api.get(urlGafeteQR(visita.id), { responseType: "blob" }).then((r) => {
      setQrBlob(URL.createObjectURL(r.data));
    });
  }, [visita.id]);

  const nombreEncabezado = (institucion.nombre || "Institución Educativa").toUpperCase();

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header no-print">
          <h3>Gafete de visitante</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body" id="gafete-imprimible">
          <div className="gafete">
            <div className="gafete-header">{nombreEncabezado}</div>
            <div className="gafete-tipo">VISITANTE</div>
            {qrBlob && <img src={qrBlob} alt="QR gafete" className="gafete-qr" />}
            <div className="gafete-nombre">{visita.nombre_completo}</div>
            <div className="gafete-dato"><strong>DNI:</strong> {visita.dni}</div>
            <div className="gafete-dato"><strong>Motivo:</strong> {visita.motivo_label}</div>
            <div className="gafete-dato"><strong>Visita a:</strong> {visita.a_quien_visita}</div>
            <div className="gafete-dato"><strong>Entrada:</strong> {new Date(visita.hora_entrada).toLocaleString("es-PE")}</div>
            <div className="gafete-footer">Devolver al salir. Escanee al portero.</div>
          </div>
        </div>
        <div className="modal-footer no-print">
          <button className="btn btn-secundario" onClick={onCerrar}>Cerrar</button>
          <button className="btn btn-primario btn-icono" onClick={() => window.print()}><Icon name="impresora" /> Imprimir</button>
        </div>
      </div>
    </div>
  );
}
