import { useCallback, useEffect, useState } from "react";
import type { KPIsPersonal, RegistroPersonal, ConfigInstitucional } from "../types/asistenciaPersonal";
import { COLOR_ESTADO_PERSONAL } from "../types/asistenciaPersonal";
import {
  marcarEntradaPropia,
  marcarSalidaPropia,
  miRegistroHoy,
  listarPersonal,
  kpisPersonal,
  descargarConsolidadoMensual,
  obtenerConfig,
  actualizarConfig,
  obtenerUbicacion,
} from "../services/asistenciaPersonal";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { EmptyState, Cargando } from "../components/ui/Spinner";

const ROLES_APROBADORES = ["director", "subdirector", "secretaria", "admin_tic"];
const ROLES_STAFF = ["director", "subdirector", "docente", "admin_tic", "secretaria", "auxiliar", "psicologa", "conserje"];

export default function AsistenciaPersonalView({ modoGestion = false }: { modoGestion?: boolean }) {
  const { usuario } = useAuth();
  const toast = useToast();

  const esAprobador = usuario ? ROLES_APROBADORES.includes(usuario.rol) : false;
  const esStaff = usuario ? ROLES_STAFF.includes(usuario.rol) : false;

  const [miRegistro, setMiRegistro] = useState<RegistroPersonal | null>(null);
  const [registros, setRegistros] = useState<RegistroPersonal[]>([]);
  const [kpis, setKpis] = useState<KPIsPersonal | null>(null);
  const [config, setConfig] = useState<ConfigInstitucional | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editandoConfig, setEditandoConfig] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const promesas: Promise<unknown>[] = [obtenerConfig()];
      if (esStaff && !modoGestion) promesas.push(miRegistroHoy());
      if (esAprobador && modoGestion) { promesas.push(listarPersonal()); promesas.push(kpisPersonal()); }
      const res = await Promise.all(promesas);
      setConfig(res[0] as ConfigInstitucional);
      let i = 1;
      if (esStaff && !modoGestion) {
        const mi = res[i++] as { tiene_registro: boolean; registro?: RegistroPersonal };
        setMiRegistro(mi.tiene_registro ? mi.registro! : null);
      }
      if (esAprobador && modoGestion) {
        setRegistros(res[i++] as RegistroPersonal[]);
        setKpis(res[i++] as KPIsPersonal);
      }
    } finally { setCargando(false); }
  }, [esStaff, esAprobador, modoGestion]);

  useEffect(() => { cargar(); }, [cargar]);

  const [obteniendoGPS, setObteniendoGPS] = useState(false);

  async function entrada() {
    let geo: { lat: number; lng: number; accuracy: number } | undefined;
    setObteniendoGPS(true);
    try {
      geo = await obtenerUbicacion();
    } catch (e) {
      const err = e as GeolocationPositionError | Error;
      const denegado = "code" in err && err.code === 1;
      if (config?.exigir_geolocalizacion) {
        toast.error(denegado
          ? "Debes autorizar el permiso de ubicación para marcar tu entrada."
          : "No se pudo obtener tu ubicación. Intenta al aire libre.");
        setObteniendoGPS(false);
        return;
      }
      toast.advertencia("Marcando sin GPS (excepción). Quedará flagueado en el registro.");
    } finally {
      setObteniendoGPS(false);
    }

    try {
      const r = await marcarEntradaPropia(geo);
      const estado = r.registro.estado === "tardanza" ? "tardanza" : "asistencia";
      const emoji = r.registro.estado === "tardanza" ? "⚠" : "✓";
      const geoInfo = r.registro.distancia_metros !== null && r.registro.distancia_metros !== undefined
        ? ` · a ${r.registro.distancia_metros}m de la I.E.`
        : (r.registro.sin_geo ? " · sin GPS" : "");
      toast[r.registro.estado === "tardanza" ? "advertencia" : "ok"](
        `${emoji} Entrada marcada como ${estado} a las ${r.registro.hora_entrada?.slice(0, 5)}${geoInfo}.`
      );
      cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; distancia_metros?: number; radio_permitido?: number } } };
      const data = err.response?.data;
      if (data?.distancia_metros) {
        toast.error(`🚫 Estás fuera del radio permitido (${data.distancia_metros}m > ${data.radio_permitido}m).`);
      } else {
        toast.error(data?.error ?? "Error al marcar entrada.");
      }
    }
  }

  async function salida() {
    try {
      const r = await marcarSalidaPropia();
      toast.ok(`Salida marcada a las ${r.hora_salida?.slice(0, 5)}.`);
      cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? "Error al marcar salida.");
    }
  }

  async function exportar() {
    const mes = new Date().toISOString().slice(0, 7);
    await descargarConsolidadoMensual(mes);
    toast.ok("Consolidado descargado.");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            {modoGestion ? "Asistencia del personal" : "Mi asistencia"}
          </h2>
          {modoGestion && config && (
            <p style={{ fontSize: 12, color: "var(--texto-mute)" }}>
              Hora tope: <strong>{config.hora_tope_entrada_personal.slice(0, 5)}</strong>
              {config.tolerancia_minutos > 0 && ` (+${config.tolerancia_minutos} min tolerancia)`}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {modoGestion && esAprobador && (
            <>
              <button className="btn btn-secundario btn-icono" onClick={exportar} style={{ padding: "8px 14px" }}>
                <Icon name="excel" /> Consolidado Excel
              </button>
              <button className="btn btn-secundario btn-icono" onClick={() => setEditandoConfig(true)} style={{ padding: "8px 14px" }}>
                <Icon name="config" /> Configurar
              </button>
            </>
          )}
        </div>
      </div>

      {!modoGestion && esStaff && (
        <Card titulo="Mi asistencia de hoy">
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            {miRegistro?.hora_entrada ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 12, color: "var(--texto-mute)" }}>Entrada</span>
                  <strong style={{ fontSize: 22, color: COLOR_ESTADO_PERSONAL[miRegistro.estado] }}>
                    {miRegistro.hora_entrada.slice(0, 5)}
                  </strong>
                  <span className="badge" style={{ background: `${COLOR_ESTADO_PERSONAL[miRegistro.estado]}22`, color: COLOR_ESTADO_PERSONAL[miRegistro.estado], alignSelf: "flex-start" }}>
                    {miRegistro.estado_label}
                  </span>
                </div>
                {miRegistro.hora_salida ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--texto-mute)" }}>Salida</span>
                    <strong style={{ fontSize: 22, color: "var(--slate-700)" }}>{miRegistro.hora_salida.slice(0, 5)}</strong>
                  </div>
                ) : (
                  <button className="btn btn-primario btn-icono" onClick={salida} style={{ width: "auto" }}>
                    <Icon name="reloj" /> Marcar mi salida
                  </button>
                )}
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: "var(--texto-mute)" }}>Aún no has marcado tu entrada hoy.</p>
                <button className="btn btn-primario btn-icono" onClick={entrada} disabled={obteniendoGPS} style={{ width: "auto" }}>
                  {obteniendoGPS
                    ? <><Icon name="ubicacion" /> Obteniendo ubicación...</>
                    : <><Icon name="reloj" /> Marcar mi entrada</>}
                </button>
              </>
            )}
          </div>
        </Card>
      )}

      {modoGestion && esAprobador && kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Presentes hoy</span>
            <span className="kpi-valor" style={{ color: "var(--verde-600)" }}>{kpis.presentes_hoy} / {kpis.total_staff}</span>
          </div>
          <div className="kpi-card" style={{ borderLeft: kpis.tardanzas_hoy > 0 ? "3px solid var(--amarillo-600)" : undefined }}>
            <span className="kpi-label">Tardanzas hoy</span>
            <span className="kpi-valor" style={{ color: "var(--amarillo-600)" }}>{kpis.tardanzas_hoy}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Sin marcar hoy</span>
            <span className="kpi-valor" style={{ color: "var(--slate-500)" }}>{kpis.sin_marcar_hoy}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Tardanzas del mes</span>
            <span className="kpi-valor">{kpis.tardanzas_mes}</span>
          </div>
        </div>
      )}

      {modoGestion && esAprobador && (
        <Card titulo={`Registros (${registros.length})`}>
          {cargando ? <Cargando inline /> : registros.length === 0 ? (
            <EmptyState icono="documento" titulo="Sin registros"
              descripcion="Ningún personal ha marcado asistencia con estos filtros." />
          ) : (
            <div className="tabla-wrap">
              <table className="tabla-incidencias">
                <thead>
                  <tr><th>Fecha</th><th>Personal</th><th>Rol</th><th>Entrada</th><th>Salida</th><th>Estado</th><th>Marcada por</th></tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id} style={{ cursor: "default" }}>
                      <td>{new Date(r.fecha).toLocaleDateString("es-PE")}</td>
                      <td><strong>{r.usuario_nombre}</strong></td>
                      <td style={{ fontSize: 12 }}>{r.usuario_rol_label}</td>
                      <td>{r.hora_entrada?.slice(0, 5) || "—"}</td>
                      <td>{r.hora_salida?.slice(0, 5) || "—"}</td>
                      <td>
                        <span className="badge" style={{ background: `${COLOR_ESTADO_PERSONAL[r.estado]}22`, color: COLOR_ESTADO_PERSONAL[r.estado] }}>
                          {r.estado_label}{r.auto_tardanza && " (auto)"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {r.marcado_por_nombre && r.marcado_por !== r.usuario ? (
                          <span title="Marcada por otra persona (dirección/subdirección)"
                            style={{ color: "var(--amarillo-600)" }}>
                            👤 {r.marcado_por_nombre}
                          </span>
                        ) : (
                          <span style={{ color: "var(--texto-mute)" }}>— propia —</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {modoGestion && editandoConfig && config && (
        <ConfigModal
          config={config}
          onCerrar={() => setEditandoConfig(false)}
          onGuardado={(nueva) => { setConfig(nueva); setEditandoConfig(false); toast.ok("Configuración actualizada."); }}
        />
      )}
    </div>
  );
}

function ConfigModal({ config, onCerrar, onGuardado }: {
  config: ConfigInstitucional; onCerrar: () => void; onGuardado: (c: ConfigInstitucional) => void;
}) {
  const toast = useToast();
  const [datos, setDatos] = useState({
    hora_tope_entrada_personal: config.hora_tope_entrada_personal.slice(0, 5),
    hora_tope_entrada_estudiantes: config.hora_tope_entrada_estudiantes.slice(0, 5),
    tolerancia_minutos: config.tolerancia_minutos,
    latitud_ie: config.latitud_ie,
    longitud_ie: config.longitud_ie,
    radio_permitido_metros: config.radio_permitido_metros,
    exigir_geolocalizacion: config.exigir_geolocalizacion,
  });
  const [enviando, setEnviando] = useState(false);
  const [detectando, setDetectando] = useState(false);

  async function detectarUbicacionActual() {
    setDetectando(true);
    try {
      const pos = await obtenerUbicacion();
      setDatos({ ...datos, latitud_ie: pos.lat.toFixed(7), longitud_ie: pos.lng.toFixed(7) });
      toast.ok(`Ubicación actual detectada (precisión ±${Math.round(pos.accuracy)}m).`);
    } catch {
      toast.error("No se pudo obtener la ubicación.");
    } finally {
      setDetectando(false);
    }
  }

  async function guardar() {
    setEnviando(true);
    try {
      const nueva = await actualizarConfig({
        hora_tope_entrada_personal: datos.hora_tope_entrada_personal + ":00",
        hora_tope_entrada_estudiantes: datos.hora_tope_entrada_estudiantes + ":00",
        tolerancia_minutos: datos.tolerancia_minutos,
        latitud_ie: datos.latitud_ie,
        longitud_ie: datos.longitud_ie,
        radio_permitido_metros: datos.radio_permitido_metros,
        exigir_geolocalizacion: datos.exigir_geolocalizacion,
      });
      onGuardado(nueva);
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configuración institucional</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <h4 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--slate-700)", marginBottom: 8 }}>Horas tope</h4>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Personal</label>
              <input type="time" className="form-input" value={datos.hora_tope_entrada_personal}
                onChange={(e) => setDatos({ ...datos, hora_tope_entrada_personal: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Estudiantes</label>
              <input type="time" className="form-input" value={datos.hora_tope_entrada_estudiantes}
                onChange={(e) => setDatos({ ...datos, hora_tope_entrada_estudiantes: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Tolerancia (min)</label>
              <input type="number" min={0} max={60} className="form-input" value={datos.tolerancia_minutos}
                onChange={(e) => setDatos({ ...datos, tolerancia_minutos: Number(e.target.value) })} />
            </div>
          </div>

          <h4 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--slate-700)", marginTop: 16, marginBottom: 8 }}>Verificación GPS</h4>
          <div className="form-aviso" style={{ marginBottom: 12, fontSize: 12 }}>
            Define la ubicación GPS del colegio y el radio permitido.
            Cuando alguien marque asistencia fuera del radio, se rechazará.
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Latitud</label>
              <input className="form-input" value={datos.latitud_ie}
                onChange={(e) => setDatos({ ...datos, latitud_ie: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Longitud</label>
              <input className="form-input" value={datos.longitud_ie}
                onChange={(e) => setDatos({ ...datos, longitud_ie: e.target.value })} />
            </div>
          </div>
          <button type="button" className="btn-mini btn-icono" onClick={detectarUbicacionActual} disabled={detectando} style={{ marginBottom: 12 }}>
            {detectando ? "Detectando..." : <><Icon name="ubicacion" size={13} /> Usar mi ubicación actual</>}
          </button>
          <div className="form-field">
            <label className="form-label">Radio permitido (metros)</label>
            <input type="number" min={10} max={500} className="form-input" value={datos.radio_permitido_metros}
              onChange={(e) => setDatos({ ...datos, radio_permitido_metros: Number(e.target.value) })} />
          </div>
          <div className="form-field">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={datos.exigir_geolocalizacion}
                onChange={(e) => setDatos({ ...datos, exigir_geolocalizacion: e.target.checked })} />
              <span style={{ fontSize: 13 }}>
                <strong>Exigir GPS</strong> — si está activado, sin permiso GPS no se puede marcar.
              </span>
            </label>
            <span style={{ fontSize: 11, color: "var(--texto-mute)" }}>
              Si está desactivado, se permite marcar sin GPS pero queda flagueado como excepción.
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar} disabled={enviando}>{enviando ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
