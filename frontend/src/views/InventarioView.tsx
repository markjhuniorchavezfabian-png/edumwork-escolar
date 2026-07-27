import { useCallback, useEffect, useMemo, useState } from "react";
import type { Equipo, EstadoEquipo, KPIsInventario, TipoEquipo } from "../types/inventario";
import { ESTADO_EQUIPO_COLOR, ESTADO_EQUIPO_LABEL, TIPO_EQUIPO_LABEL } from "../types/inventario";
import {
  listarEquipos,
  obtenerKPIsInventario,
  descargarInventarioExcel,
  crearEquipo,
  actualizarEquipo,
  eliminarEquipo,
} from "../services/inventario";
import { useAuth } from "../hooks/useAuth";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { EmptyState, Cargando } from "../components/ui/Spinner";
import EscanerInventario from "../components/inventario/EscanerInventario";
import { useConfirm } from "../components/ui/Confirm";
import { useToast } from "../components/ui/Toast";
import api from "../services/api";

export default function InventarioView() {
  const { usuario } = useAuth();
  const puedeEditar = usuario?.rol === "admin_tic" || usuario?.rol === "director";

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [kpis, setKpis] = useState<KPIsInventario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Equipo | null>(null);
  const [escaneando, setEscaneando] = useState(false);

  async function descargarEtiquetas() {
    try {
      const { data } = await api.get("/inventario/equipos/etiquetas-pdf/", { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "etiquetas_qr_inventario.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { console.warn("[etiquetas-pdf]", e); }
  }
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [lista, k] = await Promise.all([
        listarEquipos({
          estado: filtroEstado || undefined,
          tipo: filtroTipo || undefined,
        }),
        obtenerKPIsInventario(),
      ]);
      setEquipos(lista);
      setKpis(k);
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroTipo]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return equipos;
    return equipos.filter((e) =>
      e.codigo_inventario.toLowerCase().includes(q) ||
      e.marca.toLowerCase().includes(q) ||
      e.modelo.toLowerCase().includes(q) ||
      e.ubicacion.toLowerCase().includes(q)
    );
  }, [equipos, busqueda]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Inventario TI</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {puedeEditar && (
            <button className="btn btn-primario" style={{ padding: "8px 14px", width: "auto" }} onClick={() => setCreando(true)}>
              + Nuevo equipo
            </button>
          )}
          <button className="btn btn-ia btn-icono" style={{ padding: "8px 14px" }} onClick={() => setEscaneando(true)}>
            <Icon name="camara" /> Escanear
          </button>
          {puedeEditar && (
            <button className="btn btn-secundario btn-icono" style={{ padding: "8px 14px" }} onClick={descargarEtiquetas}>
              <Icon name="impresora" /> Etiquetas PDF
            </button>
          )}
          <button className="btn btn-secundario btn-icono" style={{ padding: "8px 14px" }} onClick={descargarInventarioExcel}>
            <Icon name="excel" /> Descargar Excel
          </button>
        </div>
      </div>

      {kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Total equipos</span>
            <span className="kpi-valor">{kpis.total}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Operativos</span>
            <span className="kpi-valor" style={{ color: "var(--verde-600)" }}>{kpis.por_estado.operativo}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">En reparación</span>
            <span className="kpi-valor" style={{ color: "var(--azul-600)" }}>{kpis.por_estado.reparacion}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Valor total (S/)</span>
            <span className="kpi-valor" style={{ fontSize: 22 }}>
              {kpis.valor_total_estimado.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      <Card titulo="Filtros">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-field">
            <label className="form-label">Estado</label>
            <select className="form-input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(ESTADO_EQUIPO_LABEL) as EstadoEquipo[]).map((k) => <option key={k} value={k}>{ESTADO_EQUIPO_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Tipo</label>
            <select className="form-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(TIPO_EQUIPO_LABEL) as TipoEquipo[]).map((k) => <option key={k} value={k}>{TIPO_EQUIPO_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Buscar</label>
            <input className="form-input" placeholder="Código, marca, modelo, ubicación..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          {(filtroEstado || filtroTipo || busqueda) && (
            <button className="btn btn-secundario" style={{ marginBottom: 2 }}
              onClick={() => { setFiltroEstado(""); setFiltroTipo(""); setBusqueda(""); }}>
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      <Card titulo={`Equipos (${filtrados.length})`}>
        {cargando ? <Cargando inline /> : filtrados.length === 0 ? (
          equipos.length === 0
            ? <EmptyState icono="monitor" titulo="Sin equipos" descripcion="Aún no hay equipos registrados. Usa 'Nuevo equipo' para comenzar." />
            : <EmptyState
                icono="config"
                titulo="Ningún equipo coincide con los filtros"
                descripcion={`Ajusta o quita los filtros para ver más resultados${busqueda ? ` (búsqueda: "${busqueda}")` : ""}.`}
                accion={
                  <button className="btn btn-secundario" style={{ padding: "8px 14px", width: "auto" }}
                    onClick={() => { setFiltroEstado(""); setFiltroTipo(""); setBusqueda(""); }}>
                    Limpiar filtros
                  </button>
                }
              />
        ) : (
          <table className="tabla-incidencias">
            <thead>
              <tr>
                <th>Código</th><th>Tipo</th><th>Marca/Modelo</th>
                <th>Ubicación</th><th>Estado</th><th>Valor (S/)</th>
                {puedeEditar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((eq) => (
                <tr key={eq.id} style={{ cursor: puedeEditar ? "pointer" : "default" }} onClick={() => puedeEditar && setEditando(eq)}>
                  <td><code style={{ fontSize: 12 }}>{eq.codigo_inventario}</code></td>
                  <td>{eq.tipo_label}</td>
                  <td>{eq.marca} {eq.modelo}</td>
                  <td>{eq.ubicacion}</td>
                  <td>
                    <span className="badge" style={{ background: "var(--slate-100)", color: ESTADO_EQUIPO_COLOR[eq.estado] }}>
                      {eq.estado_label}
                    </span>
                  </td>
                  <td>{eq.valor_referencial ? Number(eq.valor_referencial).toLocaleString("es-PE") : "—"}</td>
                  {puedeEditar && <td><button className="btn-mini">Editar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(editando || creando) && (
        <EquipoModal
          equipo={editando}
          onCerrar={() => { setEditando(null); setCreando(false); }}
          onGuardado={() => { setEditando(null); setCreando(false); cargar(); }}
        />
      )}

      {escaneando && (
        <EscanerInventario
          onCerrar={() => setEscaneando(false)}
          onEditar={puedeEditar ? (eq) => setEditando(eq) : undefined}
        />
      )}
    </div>
  );
}

// ── Modal de crear/editar ────────────────────────────────────────────────────
function EquipoModal({ equipo, onCerrar, onGuardado }: { equipo: Equipo | null; onCerrar: () => void; onGuardado: () => void }) {
  const esNuevo = equipo === null;
  const confirmar = useConfirm();
  const toast = useToast();
  const [datos, setDatos] = useState<Partial<Equipo>>(equipo ?? {
    codigo_inventario: "",
    tipo: "pc",
    marca: "",
    modelo: "",
    numero_serie: "",
    ubicacion: "",
    estado: "operativo",
    fecha_adquisicion: null,
    valor_referencial: null,
    observaciones: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setEnviando(true);
    try {
      if (esNuevo) await crearEquipo(datos);
      else await actualizarEquipo(equipo!.id, datos);
      toast.ok(esNuevo ? "Equipo registrado correctamente." : "Equipo actualizado.");
      onGuardado();
    } catch (e) {
      const err = e as { response?: { data?: Record<string, string[]> } };
      const data = err.response?.data;
      const msg = data
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ")
        : "Error al guardar el equipo.";
      setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  async function borrar() {
    if (!equipo) return;
    const ok = await confirmar({
      titulo: "Dar de baja equipo",
      mensaje: `¿Dar de baja "${equipo.codigo_inventario}"? Esta acción elimina el equipo del inventario.`,
      textoConfirmar: "Dar de baja",
      variante: "peligro",
    });
    if (!ok) return;
    await eliminarEquipo(equipo.id);
    toast.ok("Equipo dado de baja.");
    onGuardado();
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{esNuevo ? "Nuevo equipo" : `Editar ${equipo?.codigo_inventario}`}</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label className="form-label">Código de inventario *</label>
            <input className="form-input" value={datos.codigo_inventario ?? ""} onChange={(e) => setDatos({ ...datos, codigo_inventario: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Tipo</label>
              <select className="form-input" value={datos.tipo} onChange={(e) => setDatos({ ...datos, tipo: e.target.value as TipoEquipo })}>
                {(Object.keys(TIPO_EQUIPO_LABEL) as TipoEquipo[]).map((k) => <option key={k} value={k}>{TIPO_EQUIPO_LABEL[k]}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Estado</label>
              <select className="form-input" value={datos.estado} onChange={(e) => setDatos({ ...datos, estado: e.target.value as EstadoEquipo })}>
                {(Object.keys(ESTADO_EQUIPO_LABEL) as EstadoEquipo[]).map((k) => <option key={k} value={k}>{ESTADO_EQUIPO_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Marca</label>
              <input className="form-input" value={datos.marca ?? ""} onChange={(e) => setDatos({ ...datos, marca: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Modelo</label>
              <input className="form-input" value={datos.modelo ?? ""} onChange={(e) => setDatos({ ...datos, modelo: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">N° de serie</label>
            <input className="form-input" value={datos.numero_serie ?? ""} onChange={(e) => setDatos({ ...datos, numero_serie: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Ubicación *</label>
            <input className="form-input" placeholder="Ej: AIP, Aula 5A" value={datos.ubicacion ?? ""} onChange={(e) => setDatos({ ...datos, ubicacion: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Fecha adquisición</label>
              <input type="date" className="form-input" value={datos.fecha_adquisicion ?? ""} onChange={(e) => setDatos({ ...datos, fecha_adquisicion: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Valor referencial (S/)</label>
              <input type="number" step="0.01" className="form-input" value={datos.valor_referencial ?? ""} onChange={(e) => setDatos({ ...datos, valor_referencial: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Observaciones</label>
            <textarea className="form-input" rows={2} value={datos.observaciones ?? ""} onChange={(e) => setDatos({ ...datos, observaciones: e.target.value })} />
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
        <div className="modal-footer">
          {!esNuevo && <button className="btn btn-peligro" onClick={borrar}>Eliminar</button>}
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar} disabled={enviando}>{enviando ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
