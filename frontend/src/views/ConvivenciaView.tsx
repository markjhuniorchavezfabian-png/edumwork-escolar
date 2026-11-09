import { useCallback, useEffect, useState } from "react";
import type { CasoConvivencia, KPIsConvivencia } from "../types/convivencia";
import {
  listarCasos,
  crearCaso,
  agregarSeguimiento,
  actualizarCaso,
  marcarSiseve,
  kpisConvivencia,
} from "../services/convivencia";
import { useToast } from "../components/ui/Toast";
import Card from "../components/ui/Card";
import { EmptyState, Cargando } from "../components/ui/Spinner";
import { useAuth } from "../hooks/useAuth";
import Icon from "../components/ui/Icon";
import { fechaCorta } from "../utils/fechas";

// RM 383-2025-MINEDU — 7 protocolos oficiales
const TIPOS = [
  { codigo: "p1_violencia_fisica_psico", etiqueta: "P1 · Violencia física y/o psicológica", plazo: 30 },
  { codigo: "p2_bullying_ciber", etiqueta: "P2 · Acoso (bullying / ciberbullying)", plazo: 30 },
  { codigo: "p3_armas", etiqueta: "P3 · Violencia con uso de armas", plazo: 20 },
  { codigo: "p4_violencia_sexual", etiqueta: "P4 · Violencia sexual entre estudiantes", plazo: 30 },
  { codigo: "p5_castigo_fisico", etiqueta: "P5 · Castigo físico y humillante (personal IE)", plazo: 30 },
  { codigo: "p6_hostigamiento_sex", etiqueta: "P6 · Hostigamiento sexual (personal IE)", plazo: 30 },
  { codigo: "p7_entorno_familiar", etiqueta: "P7 · Violencia por entorno familiar/comunitario", plazo: 1 },
  { codigo: "otro", etiqueta: "Otro (fuera de protocolos oficiales)", plazo: 30 },
];

const ESTADOS = ["recibido", "en_atencion", "derivado", "cerrado", "falso"];
const GRAVEDADES = [
  { codigo: "leve", etiqueta: "Leve" },
  { codigo: "moderada", etiqueta: "Moderada" },
  { codigo: "grave", etiqueta: "Grave" },
];

const ACCIONES = [
  { codigo: "entrevista_victima", etiqueta: "Entrevista a víctima" },
  { codigo: "entrevista_agresor", etiqueta: "Entrevista a presunto agresor" },
  { codigo: "entrevista_padres", etiqueta: "Entrevista a padres" },
  { codigo: "mediacion", etiqueta: "Mediación / restauración" },
  { codigo: "derivacion", etiqueta: "Derivación (DEMUNA, PNP, MP)" },
  { codigo: "acuerdo", etiqueta: "Acuerdo firmado" },
  { codigo: "nota", etiqueta: "Nota / observación" },
];

const COLOR_ALERTA: Record<string, string> = {
  ninguna: "var(--texto-mute)",
  proximo: "var(--warning-text)",
  urgente: "var(--danger-text)",
  vencido: "var(--danger-text)",
};

export default function ConvivenciaView() {
  const { usuario } = useAuth();
  const esPadre = usuario?.rol === "padre";
  const toast = useToast();

  const [casos, setCasos] = useState<CasoConvivencia[]>([]);
  const [kpis, setKpis] = useState<KPIsConvivencia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<CasoConvivencia | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, k] = await Promise.all([
        listarCasos(),
        (usuario?.rol && ["director", "subdirector", "psicologa", "auxiliar", "docente"].includes(usuario.rol))
          ? kpisConvivencia() : Promise.resolve(null),
      ]);
      setCasos(c);
      setKpis(k);
    } finally {
      setCargando(false);
    }
  }, [usuario?.rol]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>Convivencia escolar</h2>
          <p style={{ fontSize: 12, color: "var(--texto-mute)" }}>
            Protocolos de atención según RM N° 383-2025-MINEDU y portal oficial SíseVe.
          </p>
        </div>
        {usuario?.rol !== "padre" && (
          <button className="btn btn-primario" onClick={() => setCreando(true)} style={{ padding: "8px 14px", width: "auto" }}>
            + Iniciar caso
          </button>
        )}
      </div>

      {kpis && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Casos activos</span>
              <span className="kpi-valor" style={{ color: "var(--info-text)" }}>{kpis.activos}</span>
            </div>
            <div className="kpi-card" style={{ borderLeft: kpis.urgentes > 0 ? "3px solid var(--warning-border-subtle)" : undefined }}>
              <span className="kpi-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="alerta" size={12} style={{ color: "var(--warning-text)" }} /> Urgentes (≤5 días)</span>
              <span className="kpi-valor" style={{ color: "var(--warning-text)" }}>{kpis.urgentes}</span>
            </div>
            <div className="kpi-card" style={{ borderLeft: kpis.vencidos > 0 ? "3px solid var(--danger-border-subtle)" : undefined }}>
              <span className="kpi-label" style={{ display: "flex", alignItems: "center", gap: 4 }}><Icon name="alerta" size={12} style={{ color: "var(--danger-text)" }} /> Vencidos</span>
              <span className="kpi-valor" style={{ color: "var(--danger-text)" }}>{kpis.vencidos}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Reportados SíseVe</span>
              <span className="kpi-valor" style={{ fontSize: 22 }}>{kpis.reportados_siseve} / {kpis.total}</span>
            </div>
          </div>
          {kpis.vencidos > 0 && (
            <div style={{ padding: "12px 16px", background: "var(--danger-bg-subtle)", border: "1px solid var(--danger-border-subtle)", borderRadius: 8, marginBottom: 20, color: "var(--danger-text)", fontSize: 13.5 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="alerta" size={14} /> <strong>Atención:</strong></span> Hay {kpis.vencidos} caso{kpis.vencidos === 1 ? "" : "s"} fuera del plazo hábil establecido por el protocolo de la RM 383-2025-MINEDU. Requiere cierre de actuaciones o informe de derivación formal.
            </div>
          )}
        </>
      )}

      <Card titulo={`Casos (${casos.length})`}>
        {cargando ? <Cargando inline /> :
          casos.length === 0 ? (
            <EmptyState icono="usuarios" titulo="Sin casos" descripcion="Cuando se registre un caso de convivencia aparecerá aquí." />
          ) : (
            <div className="tabla-wrap">
              <table className="tabla-incidencias">
                <thead>
                  <tr>
                    <th>Código</th>
                    {usuario?.rol === "padre" && <th>Estudiante</th>}
                    <th>Tipo</th><th>Gravedad</th><th>Estado</th>
                    <th>Días restantes</th><th>Reportado</th><th>SíseVe</th>
                  </tr>
                </thead>
                <tbody>
                  {casos.map((c) => (
                    <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setSeleccionado(c)}>
                      <td><code style={{ fontSize: 12 }}>{c.codigo}</code></td>
                      {usuario?.rol === "padre" && (
                        <td style={{ fontSize: 12.5, fontWeight: 600 }}>
                          {c.hijo_afectado || (c.afectados_detalle?.length ? c.afectados_detalle.map((a) => a.nombre).join(", ") : "Hijo/a")}
                        </td>
                      )}
                      <td style={{ fontSize: 12.5 }}>{c.tipo_label}</td>
                      <td>
                        <span className="badge" style={{
                          background: c.gravedad === "grave" ? "var(--danger-bg-subtle)" : c.gravedad === "moderada" ? "var(--warning-bg-subtle)" : "var(--empty-state-bg)",
                          color: c.gravedad === "grave" ? "var(--danger-text)" : c.gravedad === "moderada" ? "var(--warning-text)" : "var(--empty-state-text)",
                        }}>{c.gravedad_label}</span>
                      </td>
                      <td>{c.estado_label}</td>
                      <td>
                        <strong style={{ color: COLOR_ALERTA[c.alerta_plazo] }}>
                          {c.alerta_plazo === "vencido" ? `Vencido (${Math.abs(c.dias_restantes)}d)` : `${c.dias_restantes} días`}
                        </strong>
                      </td>
                      <td style={{ fontSize: 12 }}>{new Date(c.fecha_reporte).toLocaleDateString("es-PE")}</td>
                      <td>{c.reportado_siseve ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>

      {seleccionado && (
        <DetalleCasoModal
          caso={seleccionado}
          esPadre={esPadre}
          onCerrar={() => setSeleccionado(null)}
          onActualizado={() => { setSeleccionado(null); cargar(); }}
        />
      )}

      {creando && (
        <NuevoCasoModal
          onCerrar={() => setCreando(false)}
          onCreado={() => { setCreando(false); cargar(); toast.ok("Caso iniciado."); }}
        />
      )}
    </div>
  );
}

function NuevoCasoModal({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const toast = useToast();
  const [datos, setDatos] = useState<Partial<CasoConvivencia>>({
    tipo: "p1_violencia_fisica_psico", gravedad: "moderada",
    fecha_hecho: new Date().toISOString().slice(0, 10),
    ubicacion: "", descripcion: "",
    confidencial: true,
  });
  const [enviando, setEnviando] = useState(false);

  async function crear() {
    setEnviando(true);
    try {
      await crearCaso(datos);
      onCreado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Iniciar caso de convivencia</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div className="form-aviso" style={{ marginBottom: 12 }}>
            Este caso será confidencial y solo visible para el equipo de convivencia.
            La I.E. tiene un plazo legal de 30 días para su atención (SíseVe).
          </div>
          <div className="form-field">
            <label className="form-label">Tipo de caso *</label>
            <select className="form-input" value={datos.tipo} onChange={(e) => setDatos({ ...datos, tipo: e.target.value as typeof datos.tipo })}>
              {TIPOS.map((t) => <option key={t.codigo} value={t.codigo}>{t.etiqueta}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Gravedad</label>
              <select className="form-input" value={datos.gravedad} onChange={(e) => setDatos({ ...datos, gravedad: e.target.value as typeof datos.gravedad })}>
                {GRAVEDADES.map((g) => <option key={g.codigo} value={g.codigo}>{g.etiqueta}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Fecha del hecho *</label>
              <input type="date" className="form-input" value={datos.fecha_hecho} onChange={(e) => setDatos({ ...datos, fecha_hecho: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Ubicación *</label>
            <input className="form-input" placeholder="Ej: Aula 3ro A, patio, salida del colegio" value={datos.ubicacion} onChange={(e) => setDatos({ ...datos, ubicacion: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Descripción del hecho *</label>
            <textarea className="form-input" rows={5} value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={crear} disabled={enviando || !datos.ubicacion || !datos.descripcion}>
            {enviando ? "Registrando..." : "Registrar caso"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalleCasoModal({ caso, esPadre, onCerrar, onActualizado }: {
  caso: CasoConvivencia; esPadre?: boolean; onCerrar: () => void; onActualizado: () => void;
}) {
  const toast = useToast();
  const [nuevoAccion, setNuevoAccion] = useState("nota");
  const [nuevoDetalle, setNuevoDetalle] = useState("");
  const [estadoLocal, setEstadoLocal] = useState(caso.estado);
  const [enviando, setEnviando] = useState(false);

  async function agregarNota() {
    if (!nuevoDetalle.trim()) return;
    setEnviando(true);
    try {
      await agregarSeguimiento(caso.id, { accion: nuevoAccion, detalle: nuevoDetalle });
      toast.ok("Seguimiento agregado.");
      onActualizado();
    } catch {
      toast.error("Error al agregar.");
    } finally { setEnviando(false); }
  }

  async function cambiarEstado(e: string) {
    setEstadoLocal(e as typeof caso.estado);
    try {
      await actualizarCaso(caso.id, { estado: e as typeof caso.estado });
      toast.ok("Estado actualizado.");
    } catch {
      toast.error("Error al actualizar.");
    }
  }

  async function marcarS() {
    try {
      await marcarSiseve(caso.id);
      toast.ok("Reportado en SíseVe.");
      onActualizado();
    } catch {
      toast.error("Error.");
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Caso {caso.codigo} · {caso.tipo_label}</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16, fontSize: 13 }}>
            <div><strong>Gravedad:</strong> {caso.gravedad_label}</div>
            <div><strong>Estado:</strong> {caso.estado_label}</div>
            <div><strong>Plazo:</strong> <span style={{ color: COLOR_ALERTA[caso.alerta_plazo], fontWeight: 700 }}>
              {caso.alerta_plazo === "vencido" ? `Vencido hace ${Math.abs(caso.dias_restantes)}d` : `${caso.dias_restantes}d restantes`}
            </span></div>
            <div><strong>Ubicación:</strong> {caso.ubicacion}</div>
          </div>

          <div className="form-field">
            <label className="form-label">Descripción</label>
            <p style={{ fontSize: 13.5, padding: 10, background: "var(--fondo-secundario)", borderRadius: 6 }}>{caso.descripcion}</p>
          </div>

          {!esPadre && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <label className="form-label" style={{ margin: 0 }}>Cambiar estado:</label>
              <select className="form-input" style={{ maxWidth: 200 }} value={estadoLocal} onChange={(e) => cambiarEstado(e.target.value)}>
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {!caso.reportado_siseve && (
                <button className="btn-mini" style={{ background: "var(--danger-bg-subtle)", color: "var(--danger-text)", display: "inline-flex", alignItems: "center", gap: 4 }} onClick={marcarS}>
                  <Icon name="alerta" size={13} /> Registrar en SíseVe
                </button>
              )}
              {caso.reportado_siseve && (
                <span style={{ fontSize: 11, color: "var(--success-text)", background: "var(--success-bg-subtle)", padding: "3px 8px", borderRadius: 12, border: "1px solid color-mix(in srgb, var(--success-text) 45%, transparent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="check" size={11} /> SíseVe {caso.codigo_siseve ? `· ${caso.codigo_siseve}` : ""}
                </span>
              )}
              {!caso.registrado_libro_incidencias && (
                <button className="btn-mini" style={{ background: "var(--warning-bg-subtle)", color: "var(--warning-text)", display: "inline-flex", alignItems: "center", gap: 4 }}
                  onClick={async () => {
                    try { await import("../services/convivencia").then(m => m.marcarLibro(caso.id)); toast.ok("Libro marcado."); onActualizado(); }
                    catch { toast.error("Error."); }
                  }}>
                  <Icon name="pdf" size={13} /> Marcar en Libro de Incidencias
                </button>
              )}
              {caso.registrado_libro_incidencias && (
                <span style={{ fontSize: 11, color: "var(--success-text)", background: "var(--success-bg-subtle)", padding: "3px 8px", borderRadius: 12, border: "1px solid color-mix(in srgb, var(--success-text) 45%, transparent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icon name="check" size={11} /> Libro registrado
                </span>
              )}
            </div>
          )}

          {/* RM 383-2025 · Pasos oficiales del protocolo */}
          {caso.pasos_protocolo && caso.pasos_protocolo.length > 0 && (
            <div style={{ background: "var(--warning-bg-subtle)", border: "1px solid var(--warning-border-subtle)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: "var(--warning-text)" }}>
                Protocolo oficial RM 383-2025 · {caso.pasos_protocolo.filter(p => p.completado).length}/{caso.pasos_protocolo.length} pasos completados
              </h4>
              {caso.pasos_protocolo.map((paso, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    checked={paso.completado}
                    disabled={esPadre}
                    onChange={async (e) => {
                      if (esPadre) return;
                      try {
                        await import("../services/convivencia").then(m => m.marcarPaso(caso.id, idx, e.target.checked));
                        onActualizado();
                      } catch { toast.error("Error."); }
                    }}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, color: "var(--warning-text)", marginRight: 5 }}>Día {paso.dia}:</span>
                    <span style={{ textDecoration: paso.completado ? "line-through" : "none", opacity: paso.completado ? 0.7 : 1 }}>{paso.accion}</span>
                    {paso.completado && paso.fecha && (
                      <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 6 }}>
                        · {fechaCorta(paso.fecha)} {paso.usuario ? `(${paso.usuario})` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <h4 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.05 }}>
            Línea de tiempo ({caso.seguimientos.length})
          </h4>
          <div style={{ borderLeft: "2px solid var(--borde)", paddingLeft: 12, marginBottom: 16 }}>
            {caso.seguimientos.length === 0 && <p style={{ fontSize: 13, color: "var(--texto-mute)" }}>Aún sin seguimiento.</p>}
            {caso.seguimientos.map((s) => (
              <div key={s.id} style={{ marginBottom: 12, position: "relative" }}>
                <div style={{ position: "absolute", left: -18, top: 4, width: 10, height: 10, borderRadius: 50, background: "var(--info-text)" }} />
                <div style={{ fontSize: 12, color: "var(--texto-mute)" }}>
                  {new Date(s.creado_en).toLocaleString("es-PE")} · {s.autor_nombre}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--info-text)", marginBottom: 2 }}>{s.accion_label}</div>
                <div style={{ fontSize: 13 }}>{s.detalle}</div>
              </div>
            ))}
          </div>

          {!esPadre && (
            <div style={{ background: "var(--fondo-secundario)", padding: 12, borderRadius: 8 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8 }}>Agregar seguimiento</h4>
              <select className="form-input" value={nuevoAccion} onChange={(e) => setNuevoAccion(e.target.value)} style={{ marginBottom: 8 }}>
                {ACCIONES.map((a) => <option key={a.codigo} value={a.codigo}>{a.etiqueta}</option>)}
              </select>
              <textarea className="form-input" rows={3} placeholder="Detalles..." value={nuevoDetalle} onChange={(e) => setNuevoDetalle(e.target.value)} />
              <button className="btn btn-primario" onClick={agregarNota} disabled={enviando || !nuevoDetalle.trim()} style={{ marginTop: 8, width: "auto" }}>
                {enviando ? "Guardando..." : "Agregar"}
              </button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primario" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
