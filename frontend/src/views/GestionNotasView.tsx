import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { useToast } from "../components/ui/Toast";
import { EmptyState, Cargando } from "../components/ui/Spinner";
import { Link } from "react-router-dom";
import { useInstitucion } from "../context/InstitucionContext";
import TextoExpandible from "../components/ui/TextoExpandible";

interface Nota {
  id: number;
  estudiante: number;
  estudiante_nombre: string;
  estudiante_codigo: string;
  area: string;
  bimestre: string;
  competencia: number;
  calificacion: string;
  conclusion_descriptiva: string;
  observaciones: string;
}

interface Seccion { id: number; nombre: string; grado: string; letra: string; nivel?: string; }

/* ── Colores por nivel ─────────────────────────────────────────────────── */
const NIVEL_THEME: Record<string, { accent: string; light: string; text: string; label: string }> = {
  inicial:    { accent: "#16a34a", light: "#dcfce7", text: "#14532d", label: "Inicial" },
  primaria:   { accent: "#1d4ed8", light: "#dbeafe", text: "#1e3a8a", label: "Primaria" },
  secundaria: { accent: "#7c3aed", light: "#ede9fe", text: "#4c1d95", label: "Secundaria" },
  "":         { accent: "#64748b", light: "#f1f5f9", text: "#1e293b", label: "Sin nivel" },
};

/* ── Colores por NL ────────────────────────────────────────────────────── */
const NL_COLOR: Record<string, { bg: string; color: string }> = {
  AD: { bg: "#dcfce7", color: "#166534" },
  A:  { bg: "#dbeafe", color: "#1e40af" },
  B:  { bg: "#fef3c7", color: "#92400e" },
  C:  { bg: "#fee2e2", color: "#991b1b" },
};

const CALIFICACIONES = [
  { valor: "", label: "— Sin calificar" },
  { valor: "AD", label: "AD — Logro destacado" },
  { valor: "A",  label: "A — Logro esperado" },
  { valor: "B",  label: "B — En proceso" },
  { valor: "C",  label: "C — En inicio" },
];

function BadgeNL({ nl }: { nl: string }) {
  const c = NL_COLOR[nl];
  if (!c) return <span style={{ color: "var(--muted-foreground)" }}>—</span>;
  return (
    <span style={{
      fontWeight: 700, fontSize: 12,
      padding: "2px 9px", borderRadius: 6,
      background: c.bg, color: c.color,
    }}>{nl}</span>
  );
}

/* ── Ordenamiento de secciones ─────────────────────────────────────────── */
const NIVEL_ORDEN: Record<string, number> = { inicial: 0, primaria: 1, secundaria: 2, "": 3 };
const GRADO_ORDEN = ["3 años","4 años","5 años","1ro","2do","3ro","4to","5to","6to"];

function ordenarSecciones(secs: Seccion[]) {
  return [...secs].sort((a, b) => {
    const nA = NIVEL_ORDEN[a.nivel ?? ""] ?? 3;
    const nB = NIVEL_ORDEN[b.nivel ?? ""] ?? 3;
    if (nA !== nB) return nA - nB;
    const gA = GRADO_ORDEN.indexOf(a.grado ?? "");
    const gB = GRADO_ORDEN.indexOf(b.grado ?? "");
    if (gA !== gB) return (gA === -1 ? 99 : gA) - (gB === -1 ? 99 : gB);
    return (a.letra ?? "").localeCompare(b.letra ?? "");
  });
}

function nombreSeccion(s: Seccion) { return s.nombre || `${s.grado} ${s.letra}`; }

/* ════════════════════════════════════════════════════════════════════════ */
export default function GestionNotasView() {
  const toast = useToast();
  const institucion = useInstitucion();
  const anioActivo = institucion.anio_lectivo_activo || new Date().getFullYear();
  const primerAnio = institucion.primer_anio_lectivo || anioActivo;

  const [secciones, setSecciones]         = useState<Seccion[]>([]);
  const [nivelActivo, setNivelActivo]     = useState<string | null>(null);
  const [seccionActiva, setSeccionActiva] = useState<number | null>(null);
  const [notas, setNotas]                 = useState<Nota[]>([]);
  const [filtroAnio, setFiltroAnio]       = useState(anioActivo);
  const [filtroBimestre, setFiltroBimestre] = useState("1");
  const [filtroArea, setFiltroArea]       = useState("");
  const [busqueda, setBusqueda]           = useState("");
  const [cargandoSecs, setCargandoSecs]   = useState(true);
  const [cargandoNotas, setCargandoNotas] = useState(false);
  const [editandoId, setEditandoId]       = useState<number | null>(null);
  const [generandoIA, setGenerandoIA]     = useState(false);
  const [borrador, setBorrador]           = useState<Partial<Nota>>({});
  const [modalBoletas, setModalBoletas]   = useState(false);

  const aniosDisponibles = Array.from(
    { length: anioActivo - primerAnio + 1 },
    (_, i) => primerAnio + i,
  );

  useEffect(() => {
    api.get<{ results?: Seccion[] } | Seccion[]>("/usuarios/secciones/?limit=200")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : (data as { results?: Seccion[] }).results ?? [];
        const ordenada = ordenarSecciones(list);
        setSecciones(ordenada);
        // Pre-seleccionar primer nivel
        if (ordenada.length > 0) {
          const primerNivel = ordenada[0].nivel || "";
          setNivelActivo(primerNivel);
        }
      })
      .finally(() => setCargandoSecs(false));
  }, []); // eslint-disable-line

  const cargarNotas = useCallback(async () => {
    if (!seccionActiva) return;
    setCargandoNotas(true);
    setEditandoId(null);
    try {
      const { data } = await api.get<{ results?: Nota[] } | Nota[]>(
        `/notas/?seccion=${seccionActiva}&bimestre=${filtroBimestre}&anio=${filtroAnio}&limit=500`
      );
      const list = Array.isArray(data) ? data : (data as { results?: Nota[] }).results ?? [];
      setNotas(list);
    } finally { setCargandoNotas(false); }
  }, [seccionActiva, filtroBimestre, filtroAnio]);

  useEffect(() => { cargarNotas(); }, [cargarNotas]);

  // Agrupar secciones por nivel
  const grupos: Record<string, Seccion[]> = {};
  for (const s of secciones) {
    const niv = s.nivel || "";
    if (!grupos[niv]) grupos[niv] = [];
    grupos[niv].push(s);
  }
  const nivelesPresentes = ["inicial","primaria","secundaria",""].filter(n => grupos[n]?.length);

  const areas = Array.from(new Set(notas.map(n => n.area))).sort();
  const filtradas = notas.filter(n => {
    if (filtroArea && n.area !== filtroArea) return false;
    if (busqueda && !n.estudiante_nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });
  const porArea = areas.reduce<Record<string, Nota[]>>((acc, area) => {
    acc[area] = filtradas.filter(n => n.area === area);
    return acc;
  }, {});
  const areasVisibles = filtroArea ? [filtroArea] : areas;

  const esAnioHistorico = filtroAnio !== anioActivo;
  const seccionActual = secciones.find(s => s.id === seccionActiva);

  function seleccionarNivel(niv: string) {
    setNivelActivo(niv);
    setSeccionActiva(null);
    setNotas([]);
    setFiltroArea("");
    setBusqueda("");
  }

  function seleccionarSeccion(id: number) {
    setSeccionActiva(id);
    setFiltroArea("");
    setBusqueda("");
  }

  function empezarEdicion(n: Nota) {
    setEditandoId(n.id);
    setBorrador({ calificacion: n.calificacion, observaciones: n.observaciones });
  }

  async function guardar(id: number) {
    try {
      await api.patch(`/notas/${id}/`, borrador);
      toast.ok("Nota actualizada.");
      setEditandoId(null);
      cargarNotas();
    } catch { toast.error("Error al guardar."); }
  }

  if (cargandoSecs) return <Cargando />;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 2 }}>Gestión de notas</h2>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
            Supervisión por sección · Generación de boletas MINEDU
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            className="btn btn-secundario btn-icono"
            onClick={() => setModalBoletas(true)}
            style={{ padding: "7px 14px", width: "auto" }}
          >
            <Icon name="pdf" /> Boletas
          </button>
          <Link to="/cargar-notas" className="btn btn-secundario btn-icono" style={{ padding: "7px 14px", textDecoration: "none" }}>
            <Icon name="excel" /> Excel
          </Link>
        </div>
      </div>

      {/* ── Barra de controles globales ─────────────────────────────── */}
      <div style={{
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
        marginBottom: 24, padding: "12px 16px",
        background: "var(--card)", borderRadius: 12,
        border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>AÑO</span>
          <select
            value={filtroAnio}
            onChange={e => { setFiltroAnio(Number(e.target.value)); setSeccionActiva(null); setNotas([]); }}
            style={{
              height: 32, padding: "0 8px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: `2px solid ${esAnioHistorico ? "#f59e0b" : "var(--border)"}`,
              background: esAnioHistorico ? "#fef3c7" : "var(--fondo)",
              color: esAnioHistorico ? "#92400e" : "var(--texto)", cursor: "pointer",
            }}
          >
            {aniosDisponibles.map(y => (
              <option key={y} value={y}>{y}{y === anioActivo ? " ✓" : ""}</option>
            ))}
          </select>
          {esAnioHistorico && (
            <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600, background: "#fef3c7", padding: "2px 8px", borderRadius: 6 }}>
              Solo lectura
            </span>
          )}
        </div>

        <div style={{ width: 1, height: 24, background: "var(--border)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>BIMESTRE</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["1","2","3","4"].map(b => (
              <button
                key={b}
                onClick={() => setFiltroBimestre(b)}
                style={{
                  height: 32, width: 36, borderRadius: 8, border: "2px solid",
                  borderColor: filtroBimestre === b ? "var(--primary)" : "var(--border)",
                  background: filtroBimestre === b ? "var(--primary)" : "transparent",
                  color: filtroBimestre === b ? "var(--primary-foreground)" : "var(--texto)",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >B{b}</button>
            ))}
          </div>
        </div>

        {seccionActiva && !esAnioHistorico && (
          <>
            <div style={{ width: 1, height: 24, background: "var(--border)" }} />
            <button
              className="btn btn-secundario btn-icono"
              disabled={generandoIA}
              onClick={async () => {
                setGenerandoIA(true);
                try {
                  const { data } = await api.post<{ procesados: number; mensaje: string }>(
                    "/notas/conclusiones-ia/",
                    { seccion_id: seccionActiva, bimestre: filtroBimestre }
                  );
                  toast.ok(data.mensaje);
                  cargarNotas();
                } catch (e: unknown) {
                  const err = e as { response?: { data?: { error?: string; sin_config?: boolean } } };
                  if (err.response?.data?.sin_config) toast.error("Sin IA configurada.");
                  else toast.error(err.response?.data?.error ?? "Error al generar conclusiones.");
                } finally { setGenerandoIA(false); }
              }}
              style={{ padding: "7px 12px", width: "auto", fontSize: 13 }}
            >
              ✨ {generandoIA ? "Generando..." : "Conclusiones IA"}
            </button>
          </>
        )}
      </div>

      {/* ── Cards por nivel ─────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${nivelesPresentes.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
        {nivelesPresentes.map(niv => {
          const theme = NIVEL_THEME[niv] ?? NIVEL_THEME[""];
          const activo = nivelActivo === niv;
          const seccs = grupos[niv] ?? [];
          return (
            <button
              key={niv}
              onClick={() => seleccionarNivel(niv)}
              style={{
                padding: "16px 20px", borderRadius: 14, border: `2px solid`,
                borderColor: activo ? theme.accent : "var(--border)",
                background: activo ? theme.light : "var(--card)",
                cursor: "pointer", textAlign: "left",
                boxShadow: activo ? `0 4px 16px ${theme.accent}22` : "none",
                transition: "all .15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: theme.accent, flexShrink: 0,
                }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: activo ? theme.text : "var(--texto)" }}>
                  {theme.label}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: activo ? theme.accent : "var(--muted-foreground)", lineHeight: 1 }}>
                {seccs.length}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>
                {seccs.length === 1 ? "sección" : "secciones"}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Pills de secciones del nivel activo ─────────────────────── */}
      {nivelActivo !== null && grupos[nivelActivo]?.length > 0 && (
        <div style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          padding: "12px 16px", marginBottom: 20,
          background: "var(--card)", borderRadius: 12,
          border: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-foreground)", alignSelf: "center", marginRight: 4 }}>
            SECCIÓN
          </span>
          {grupos[nivelActivo].map(s => {
            const theme = NIVEL_THEME[nivelActivo] ?? NIVEL_THEME[""];
            const activa = seccionActiva === s.id;
            return (
              <button
                key={s.id}
                onClick={() => seleccionarSeccion(s.id)}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: "2px solid",
                  borderColor: activa ? theme.accent : "var(--border)",
                  background: activa ? theme.accent : "transparent",
                  color: activa ? "#fff" : "var(--texto)",
                  fontWeight: activa ? 700 : 500, fontSize: 13,
                  cursor: "pointer", transition: "all .12s",
                }}
              >
                {nombreSeccion(s)}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Detalle de sección ──────────────────────────────────────── */}
      {seccionActual && (
        <div>
          {/* Sub-barra filtros de tabla */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              {notas.length} registros ·
            </span>
            <select
              className="form-input"
              style={{ width: "auto", padding: "6px 10px", fontSize: 13 }}
              value={filtroArea}
              onChange={e => setFiltroArea(e.target.value)}
            >
              <option value="">Todas las áreas ({areas.length})</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input
              className="form-input"
              style={{ width: 200, padding: "6px 10px", fontSize: 13 }}
              placeholder="Buscar estudiante..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          {esAnioHistorico && (
            <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#92400E", fontWeight: 600 }}>
              Año {filtroAnio} — solo lectura.
            </div>
          )}
          {!esAnioHistorico && (
            <div className="ui-readonly-note" style={{ marginBottom: 14 }}>
              Vista directiva: revisión y corrección auditada. La eliminación de notas no está disponible desde esta pantalla.
            </div>
          )}

          {cargandoNotas ? (
            <Cargando inline />
          ) : filtradas.length === 0 ? (
            <EmptyState
              icono="libro"
              titulo={`Sin notas · ${nombreSeccion(seccionActual)}`}
              descripcion={`No hay notas para el bimestre ${filtroBimestre}. Los docentes deben registrarlas desde su vista de aula.`}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {areasVisibles.map(area => {
                const notasArea = (filtroArea ? filtradas : porArea[area]) ?? [];
                if (notasArea.length === 0) return null;

                // Agrupar por estudiante para mostrar filas limpias
                const estudiantesMap: Record<number, { nombre: string; notas: Nota[] }> = {};
                for (const n of notasArea) {
                  if (!estudiantesMap[n.estudiante]) {
                    estudiantesMap[n.estudiante] = { nombre: n.estudiante_nombre, notas: [] };
                  }
                  estudiantesMap[n.estudiante].notas.push(n);
                }
                const estudiantes = Object.values(estudiantesMap);

                return (
                  <Card key={area} titulo={area}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border)" }}>
                          <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "var(--muted-foreground)", fontSize: 11, textTransform: "uppercase" }}>Estudiante</th>
                          <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 600, color: "var(--muted-foreground)", fontSize: 11, textTransform: "uppercase", width: 80 }}>NL</th>
                          <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "var(--muted-foreground)", fontSize: 11, textTransform: "uppercase" }}>Conclusión</th>
                          {!esAnioHistorico && <th style={{ width: 72 }} />}
                        </tr>
                      </thead>
                      <tbody>
                        {estudiantes.map(({ nombre, notas: ns }) => {
                          const notaPrin = ns[0];
                          const editando = editandoId === notaPrin.id;
                          return (
                            <tr
                              key={notaPrin.estudiante}
                              style={{
                                borderBottom: "1px solid var(--border)",
                                background: editando ? "var(--muted)" : undefined,
                              }}
                            >
                              <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                                {nombre}
                                {ns.length > 1 && (
                                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", marginLeft: 6 }}>
                                    {ns.length} comp.
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "8px 10px", textAlign: "center" }}>
                                {editando ? (
                                  <select
                                    className="form-input"
                                    style={{ padding: "3px 6px", fontSize: 12, width: 70 }}
                                    value={borrador.calificacion ?? ""}
                                    onChange={e => setBorrador({ ...borrador, calificacion: e.target.value })}
                                  >
                                    {CALIFICACIONES.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
                                  </select>
                                ) : (
                                  <BadgeNL nl={notaPrin.calificacion} />
                                )}
                              </td>
                              <td style={{ padding: "8px 10px", color: "var(--muted-foreground)", fontSize: 12 }}>
                                {editando ? (
                                  <input
                                    className="form-input"
                                    style={{ padding: "3px 6px", fontSize: 12 }}
                                    value={borrador.observaciones ?? ""}
                                    onChange={e => setBorrador({ ...borrador, observaciones: e.target.value })}
                                    placeholder="Observación..."
                                  />
                                ) : (
                                  <TextoExpandible texto={notaPrin.conclusion_descriptiva} maxChars={90} />
                                )}
                              </td>
                              {!esAnioHistorico && (
                                <td style={{ padding: "8px 6px", textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                    {editando ? (
                                      <>
                                        <button className="btn-mini btn-icono" style={{ color: "var(--verde-600)" }} onClick={() => guardar(notaPrin.id)}>
                                          <Icon name="guardar" />
                                        </button>
                                        <button className="btn-mini btn-icono" onClick={() => setEditandoId(null)}>
                                          <Icon name="cerrar" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button className="btn-mini btn-icono" onClick={() => empezarEdicion(notaPrin)} title="Editar">
                                          <Icon name="editar" size={12} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Estado vacío cuando no hay sección seleccionada */}
      {!seccionActiva && nivelActivo !== null && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted-foreground)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>☝️</div>
          <div style={{ fontSize: 14 }}>Selecciona una sección arriba para ver sus notas</div>
        </div>
      )}

      {modalBoletas && (
        <ModalBoletas
          secciones={secciones}
          seccionInicialId={seccionActiva}
          bimestreInicial={filtroBimestre}
          onCerrar={() => setModalBoletas(false)}
        />
      )}
    </div>
  );
}

/* ── Modal Boletas (sin cambios en lógica) ─────────────────────────────── */
const NIVEL_OPTS = [
  { valor: "inicial", label: "Inicial" },
  { valor: "primaria", label: "Primaria" },
  { valor: "secundaria", label: "Secundaria" },
];

function ModalBoletas({ secciones, seccionInicialId, bimestreInicial, onCerrar }: {
  secciones: Seccion[];
  seccionInicialId: number | null;
  bimestreInicial: string;
  onCerrar: () => void;
}) {
  const [bimestre, setBimestre]   = useState(bimestreInicial);
  const [modo, setModo]           = useState<"seccion" | "grado" | "nivel">("seccion");
  const [seccionId, setSeccionId] = useState<string>(seccionInicialId ? String(seccionInicialId) : "");
  const [gradoSel, setGradoSel]   = useState("");
  const [nivelSel, setNivelSel]   = useState("secundaria");
  const [descargando, setDescargando] = useState(false);
  const toast = useToast();

  const grados = Array.from(new Set(secciones.map(s => s.grado).filter(Boolean))).sort();

  const puedeDescargar =
    (modo === "seccion" && seccionId) ||
    (modo === "grado" && gradoSel) ||
    (modo === "nivel" && nivelSel);

  async function descargar() {
    setDescargando(true);
    try {
      let url: string, nombre: string;
      if (modo === "seccion") {
        const sec = secciones.find(s => String(s.id) === seccionId);
        const { data } = await api.get(`/notas/boletas-seccion/${seccionId}/?bimestre=${bimestre}`, { responseType: "blob" });
        url = URL.createObjectURL(data);
        nombre = `boletas_${sec?.grado ?? ""}${sec?.letra ?? ""}_B${bimestre}.zip`;
      } else {
        const params = new URLSearchParams({ bimestre });
        if (modo === "grado") params.set("grado", gradoSel);
        else params.set("nivel", nivelSel);
        const { data } = await api.get(`/notas/boletas-grado/?${params}`, { responseType: "blob" });
        url = URL.createObjectURL(data);
        nombre = `boletas_${modo === "grado" ? gradoSel : nivelSel}_B${bimestre}.zip`;
      }
      const link = document.createElement("a");
      link.href = url; link.download = nombre; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      onCerrar();
    } catch {
      toast.error("Error al generar boletas. Verifica que haya notas registradas.");
    } finally { setDescargando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Generar boletas de notas</h3>
          <button className="modal-cerrar" onClick={onCerrar}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 14 }}>
            1 PDF por estudiante, empaquetado en ZIP. Formato oficial MINEDU.
          </p>
          <div className="form-group">
            <label className="form-label">Generar para</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["seccion", "grado", "nivel"] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => setModo(m)}
                  className={modo === m ? "btn btn-primario" : "btn btn-secundario"}
                  style={{ flex: 1, padding: "8px 0", fontSize: 13, width: "auto" }}
                >
                  {m === "seccion" ? "Sección" : m === "grado" ? "Grado" : "Nivel"}
                </button>
              ))}
            </div>
          </div>
          {modo === "seccion" && (
            <div className="form-group">
              <label className="form-label">Sección</label>
              <select className="form-input" value={seccionId} onChange={e => setSeccionId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {secciones.map(s => <option key={s.id} value={s.id}>{nombreSeccion(s)}</option>)}
              </select>
            </div>
          )}
          {modo === "grado" && (
            <div className="form-group">
              <label className="form-label">Grado (todas las secciones)</label>
              <select className="form-input" value={gradoSel} onChange={e => setGradoSel(e.target.value)}>
                <option value="">— Seleccionar grado —</option>
                {grados.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          {modo === "nivel" && (
            <div className="form-group">
              <label className="form-label">Nivel (todas las secciones del nivel)</label>
              <select className="form-input" value={nivelSel} onChange={e => setNivelSel(e.target.value)}>
                {NIVEL_OPTS.map(n => <option key={n.valor} value={n.valor}>{n.label}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Bimestre</label>
            <select className="form-input" value={bimestre} onChange={e => setBimestre(e.target.value)}>
              {["1","2","3","4"].map(b => <option key={b} value={b}>Bimestre {b}</option>)}
            </select>
          </div>
          {(modo === "grado" || modo === "nivel") && (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 8, padding: "8px 12px" }}>
              Se descargará un ZIP con sub-ZIPs por sección.
              {modo === "nivel" && " Puede tomar varios segundos."}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario btn-icono" onClick={descargar} disabled={!puedeDescargar || descargando}>
            <Icon name="descargar" /> {descargando ? "Generando..." : "Descargar ZIP"}
          </button>
        </div>
      </div>
    </div>
  );
}
