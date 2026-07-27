import { useCallback, useEffect, useMemo, useState } from "react";
import { useBeforeUnload } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import type { EstadoAsistencia, EstudianteLista, RegistroAsistencia } from "../../types/asistencia";
import { listarEstudiantes, registrosDelDia, marcarMasivo, misSecciones, type MarcaItem, type SeccionDocente } from "../../services/asistencia";
import EscanerQR from "../../components/asistencia/EscanerQR";
import ExportarMensualBtn from "../../components/asistencia/ExportarMensualBtn";
import Icon from "../../components/ui/Icon";
import { Cargando } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { ChevronLeft, LayoutGrid, List } from "lucide-react";
import SeccionCard from "../../components/ui/SeccionCard";

const CICLO: EstadoAsistencia[] = ["presente", "tardanza", "ausente", "justificado"];

const BADGE: Record<EstadoAsistencia, { label: string; bg: string; text: string }> = {
  presente:    { label: "P", bg: "#D1FAE5", text: "#065F46" },
  tardanza:    { label: "T", bg: "#FEF3C7", text: "#92400E" },
  ausente:     { label: "A", bg: "#FEE2E2", text: "#991B1B" },
  justificado: { label: "J", bg: "#DBEAFE", text: "#1E40AF" },
};

const ESTADO_LABEL: Record<EstadoAsistencia, string> = {
  presente: "Presente",
  tardanza: "Tardanza",
  ausente: "Ausente",
  justificado: "Justificado",
};

type Modo = "clicker" | "panel";

export default function DocenteAsistenciaView() {
  const navigate = useNavigate();
  const toast = useToast();

  const [secciones, setSecciones] = useState<SeccionDocente[]>([]);
  const [seccionActual, setSeccionActual] = useState<SeccionDocente | null>(null);
  const [cargandoSecciones, setCargandoSecciones] = useState(true);

  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [estudiantes, setEstudiantes] = useState<EstudianteLista[]>([]);
  const [registros, setRegistros] = useState<Record<number, RegistroAsistencia>>({});
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState<Record<number, EstadoAsistencia>>({});
  const [modo, setModo] = useState<Modo>("clicker");
  const [modoEdicion, setModoEdicion] = useState(false);

  const tieneCambios = Object.keys(cambios).length > 0;
  useBeforeUnload(useCallback((e) => {
    if (tieneCambios) e.preventDefault();
  }, [tieneCambios]));

  useEffect(() => {
    misSecciones().then((data) => {
      setSecciones(data);
      if (data.length === 1) setSeccionActual(data[0]);
    }).finally(() => setCargandoSecciones(false));
  }, []);

  const cargar = useCallback(async () => {
    if (!seccionActual) return;
    setCargando(true);
    try {
      const [ests, dia] = await Promise.all([
        listarEstudiantes({ seccion_id: seccionActual.id }),
        registrosDelDia(fecha),
      ]);
      setEstudiantes(ests);
      const mapa: Record<number, RegistroAsistencia> = {};
      dia.registros.forEach((r) => { mapa[r.estudiante] = r; });
      setRegistros(mapa);
      setCambios({});
    } finally {
      setCargando(false);
    }
  }, [seccionActual, fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return estudiantes;
    return estudiantes.filter((e) => e.nombre_completo.toLowerCase().includes(q));
  }, [estudiantes, busqueda]);

  function ciclarEstado(estId: number) {
    const actual = cambios[estId] ?? registros[estId]?.estado;
    const idx = actual ? CICLO.indexOf(actual) : -1;
    const siguiente = CICLO[(idx + 1) % CICLO.length];
    setCambios((c) => ({ ...c, [estId]: siguiente }));
  }

  function setEstado(estId: number, estado: EstadoAsistencia) {
    setCambios((c) => ({ ...c, [estId]: estado }));
  }

  function estadoActual(estId: number): EstadoAsistencia | undefined {
    return cambios[estId] ?? registros[estId]?.estado;
  }

  function marcarTodos(estado: EstadoAsistencia) {
    const nuevo: Record<number, EstadoAsistencia> = { ...cambios };
    filtrados.forEach((e) => { nuevo[e.id] = estado; });
    setCambios(nuevo);
  }

  async function guardar() {
    setGuardando(true);
    try {
      const items: MarcaItem[] = Object.entries(cambios).map(([id, estado]) => ({
        estudiante: Number(id),
        estado,
      }));
      if (items.length === 0) {
        toast.advertencia("No hay cambios que guardar.");
        return;
      }
      const r = await marcarMasivo(fecha, items);
      toast.ok(`Guardado: ${r.creados} nuevos, ${r.actualizados} actualizados.`);
      await cargar();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error al guardar: ${JSON.stringify(err.response?.data)}`);
    } finally {
      setGuardando(false);
    }
  }

  const totalCambios = Object.keys(cambios).length;

  // ── Pantalla de selección de sección ─────────────────────────────────────
  if (!seccionActual) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Marcar asistencia</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <ExportarMensualBtn />
            <button className="btn btn-secundario btn-icono" onClick={() => navigate("/asistencia/qrs")} style={{ padding: "8px 14px" }}>
              <Icon name="impresora" /> Imprimir QRs
            </button>
          </div>
        </div>

        {cargandoSecciones ? (
          <Cargando inline />
        ) : secciones.length === 0 ? (
          <div className="card card-body" style={{ textAlign: "center", color: "var(--muted-foreground)", padding: 40 }}>
            No tenés secciones asignadas aún. Pedile al TIC que te asigne una sección.
          </div>
        ) : (
          <div>
            <p style={{ color: "var(--muted-foreground)", marginBottom: 16, fontSize: 14 }}>
              Seleccioná la sección para marcar asistencia:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {secciones.map((s) => (
                <SeccionCard
                  key={s.id}
                  grado={s.grado}
                  letra={s.letra}
                  nivel={s.nivel}
                  cantidad={s.cantidad_estudiantes}
                  onClick={() => setSeccionActual(s)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Vista de marcado ──────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {secciones.length > 1 && (
            <button
              onClick={() => { setSeccionActual(null); setEstudiantes([]); setCambios({}); }}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)", fontSize: 13 }}
            >
              <ChevronLeft size={16} /> Secciones
            </button>
          )}
          <h2 className="page-title" style={{ marginBottom: 0 }}>
            Asistencia · {seccionActual.grado} {seccionActual.letra}
          </h2>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <ExportarMensualBtn />
          {modoEdicion && (
            <>
              <button className="btn btn-ia btn-icono" onClick={() => setMostrarScanner(true)} style={{ padding: "8px 14px" }}>
                <Icon name="camara" /> Escanear QR
              </button>
              <button className="btn btn-secundario btn-icono" onClick={() => navigate("/asistencia/qrs")} style={{ padding: "8px 14px" }}>
                <Icon name="impresora" /> Imprimir QRs
              </button>
            </>
          )}
          <button
            className={modoEdicion ? "btn btn-secundario btn-icono" : "btn btn-primario btn-icono"}
            onClick={() => { setModoEdicion((v) => !v); setCambios({}); }}
            style={{ padding: "8px 14px" }}
          >
            <Icon name={modoEdicion ? "cerrar" : "editar"} /> {modoEdicion ? "Salir de edición" : "Activar edición"}
          </button>
        </div>
      </div>

      {mostrarScanner && (
        <EscanerQR
          fecha={fecha}
          onMarcado={cargar}
          onCerrar={() => { setMostrarScanner(false); cargar(); }}
        />
      )}

      <div className="card">
        <div className="card-body" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label className="form-label">Fecha</label>
            <input
              type="date"
              className="form-input"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ minWidth: 160 }}
            />
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label className="form-label">Buscar</label>
            <input
              className="form-input"
              placeholder="Nombre o apellido..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {/* Toggle modo */}
          <div style={{ display: "flex", border: "1px solid var(--borde)", borderRadius: 8, overflow: "hidden" }}>
            <button
              onClick={() => setModo("clicker")}
              title="Modo clicker"
              style={{
                padding: "8px 12px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                background: modo === "clicker" ? "var(--primario)" : "var(--fondo)",
                color: modo === "clicker" ? "white" : "var(--muted-foreground)",
              }}
            >
              <LayoutGrid size={14} /> Clicker
            </button>
            <button
              onClick={() => setModo("panel")}
              title="Modo panel"
              style={{
                padding: "8px 12px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                background: modo === "panel" ? "var(--primario)" : "var(--fondo)",
                color: modo === "panel" ? "white" : "var(--muted-foreground)",
              }}
            >
              <List size={14} /> Panel
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span>
            Estudiantes ({filtrados.length}){totalCambios > 0 && ` · ${totalCambios} cambios pendientes`}
            {!modoEdicion && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--texto-mute)", fontStyle: "italic" }}>solo lectura</span>}
          </span>
          {modoEdicion && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-mini" onClick={() => marcarTodos("presente")}>Todos presentes</button>
              <button className="btn-mini" onClick={() => marcarTodos("ausente")}>Todos ausentes</button>
            </div>
          )}
        </div>

        {cargando ? (
          <div className="card-body"><Cargando inline /></div>
        ) : modo === "clicker" ? (
          <div className="asistencia-lista">
            {filtrados.map((est) => {
              const actual = estadoActual(est.id);
              const cambio = cambios[est.id];
              return (
                <div key={est.id} className={`asistencia-fila ${cambio ? "asistencia-fila-cambio" : ""}`}>
                  <div className="asistencia-est">
                    <div className="asistencia-avatar">
                      {est.nombre_completo.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <div className="asistencia-nombre">{est.nombre_completo}</div>
                      <div className="asistencia-sub">{est.grado} {est.seccion} · {est.codigo_matricula || "sin código"}</div>
                    </div>
                  </div>
                  <div className="asistencia-botones">
                    <button
                      onClick={() => modoEdicion && ciclarEstado(est.id)}
                      style={{
                        padding: "6px 16px", borderRadius: 6, border: "none",
                        cursor: modoEdicion ? "pointer" : "default",
                        fontWeight: 700, fontSize: 14, minWidth: 44,
                        background: actual ? BADGE[actual].bg : "#F3F4F6",
                        color: actual ? BADGE[actual].text : "#6B7280",
                        opacity: modoEdicion ? 1 : 0.85,
                      }}
                      title={modoEdicion ? "Click para cambiar estado" : "Activa edición para modificar"}
                    >
                      {actual ? BADGE[actual].label : "—"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Modo panel — tabla con select por fila */
          <div style={{ overflowX: "auto" }}>
            <table className="tabla-incidencias">
              <thead>
                <tr>
                  <th>Estudiante</th>
                  <th style={{ width: 80 }}>Código</th>
                  <th style={{ width: 160 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((est) => {
                  const actual = estadoActual(est.id);
                  const cambio = cambios[est.id];
                  return (
                    <tr key={est.id} style={{ background: cambio ? "var(--amarillo-50, #FFFBEB)" : undefined }}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{est.nombre_completo}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{est.grado} {est.seccion}</div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{est.codigo_matricula || "—"}</td>
                      <td>
                        <select
                          className="form-input"
                          value={actual ?? ""}
                          disabled={!modoEdicion}
                          onChange={(e) => modoEdicion && e.target.value ? setEstado(est.id, e.target.value as EstadoAsistencia) : undefined}
                          style={{
                            fontSize: 12, padding: "4px 8px",
                            background: actual ? BADGE[actual].bg : undefined,
                            color: actual ? BADGE[actual].text : undefined,
                            fontWeight: actual ? 700 : undefined,
                          }}
                        >
                          <option value="">— sin marcar —</option>
                          {CICLO.map((e) => (
                            <option key={e} value={e}>{BADGE[e].label} — {ESTADO_LABEL[e]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {modoEdicion && (
          <div className="card-body" style={{ borderTop: "1px solid var(--borde)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-primario btn-icono" style={{ width: "auto" }} onClick={guardar} disabled={guardando || totalCambios === 0}>
              <Icon name="guardar" /> {guardando ? "Guardando..." : `Guardar ${totalCambios} cambios`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
