import { useEffect, useState, useCallback, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { KPIsAsistencia, EstadoAsistencia, EstudianteLista, RegistroAsistencia } from "../../types/asistencia";
import { ESTADO_ASISTENCIA_LABEL } from "../../types/asistencia";
import { obtenerKPIsAsistencia, listarEstudiantes, registrosDelDia, marcarMasivo, type MarcaItem } from "../../services/asistencia";
import ExportarMensualBtn from "../../components/asistencia/ExportarMensualBtn";
import { Cargando } from "../../components/ui/Spinner";
import Icon from "../../components/ui/Icon";
import { useToast } from "../../components/ui/Toast";
import { ChevronLeft } from "lucide-react";

const COLORES: Record<string, string> = {
  presente: "#16A34A",
  tardanza: "#EAB308",
  ausente: "#DC2626",
  justificado: "#2563EB",
};

const NIVELES = [
  { key: "inicial",    label: "Inicial",    color: "#8B5CF6", grados: ["3 años","4 años","5 años"] },
  { key: "primaria",   label: "Primaria",   color: "#0EA5E9", grados: ["1ro","2do","3ro","4to","5to","6to"] },
  { key: "secundaria", label: "Secundaria", color: "#F59E0B", grados: ["1ro","2do","3ro","4to","5to"] },
];

const CICLO: EstadoAsistencia[] = ["presente", "tardanza", "ausente", "justificado"];
const BADGE: Record<EstadoAsistencia, { label: string; bg: string; text: string }> = {
  presente:    { label: "P", bg: "#D1FAE5", text: "#065F46" },
  tardanza:    { label: "T", bg: "#FEF3C7", text: "#92400E" },
  ausente:     { label: "A", bg: "#FEE2E2", text: "#991B1B" },
  justificado: { label: "J", bg: "#DBEAFE", text: "#1E40AF" },
};

export default function DirectorAsistenciaView() {
  const toast = useToast();
  const [kpis, setKpis] = useState<KPIsAsistencia | null>(null);
  const [cargandoKpis, setCargandoKpis] = useState(true);
  const [nivelActual, setNivelActual] = useState<string | null>(null);

  // Estado del marcado por nivel
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [busqueda, setBusqueda] = useState("");
  const [filtroGrado, setFiltroGrado] = useState("");
  const [filtroSeccion, setFiltroSeccion] = useState("");
  const [estudiantes, setEstudiantes] = useState<EstudianteLista[]>([]);
  const [registros, setRegistros] = useState<Record<number, RegistroAsistencia>>({});
  const [cambios, setCambios] = useState<Record<number, EstadoAsistencia>>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerKPIsAsistencia().then(setKpis).finally(() => setCargandoKpis(false));
  }, []);

  const cargar = useCallback(async () => {
    if (!nivelActual) return;
    setCargando(true);
    try {
      const [ests, dia] = await Promise.all([
        listarEstudiantes(filtroGrado ? { grado: filtroGrado, seccion: filtroSeccion || undefined } : {}),
        registrosDelDia(fecha),
      ]);
      // Filtra solo estudiantes del nivel
      const nivel = NIVELES.find(n => n.key === nivelActual);
      const gradosNivel = nivel?.grados ?? [];
      const filtrados = ests.filter(e => gradosNivel.some(g => e.grado?.toLowerCase().startsWith(g.toLowerCase().slice(0, 3))));
      setEstudiantes(filtrados);
      const mapa: Record<number, RegistroAsistencia> = {};
      dia.registros.forEach((r) => { mapa[r.estudiante] = r; });
      setRegistros(mapa);
      setCambios({});
    } finally {
      setCargando(false);
    }
  }, [nivelActual, fecha, filtroGrado, filtroSeccion]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return estudiantes;
    return estudiantes.filter(e => e.nombre_completo.toLowerCase().includes(q));
  }, [estudiantes, busqueda]);

  function ciclarEstado(estId: number) {
    const actual = cambios[estId] ?? registros[estId]?.estado;
    const idx = actual ? CICLO.indexOf(actual) : -1;
    setCambios(c => ({ ...c, [estId]: CICLO[(idx + 1) % CICLO.length] }));
  }

  function estadoActual(estId: number): EstadoAsistencia | undefined {
    return cambios[estId] ?? registros[estId]?.estado;
  }

  async function guardar() {
    setGuardando(true);
    try {
      const items: MarcaItem[] = Object.entries(cambios).map(([id, estado]) => ({ estudiante: Number(id), estado }));
      if (!items.length) { toast.advertencia("No hay cambios."); return; }
      const r = await marcarMasivo(fecha, items);
      toast.ok(`Guardado: ${r.creados} nuevos, ${r.actualizados} actualizados.`);
      cargar();
    } catch { toast.error("Error al guardar."); }
    finally { setGuardando(false); }
  }

  const totalCambios = Object.keys(cambios).length;
  const nivelInfo = NIVELES.find(n => n.key === nivelActual);

  if (cargandoKpis) return <p>Cargando panel...</p>;

  const datosEstado = kpis ? Object.entries(kpis.por_estado)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ nombre: ESTADO_ASISTENCIA_LABEL[k as keyof typeof ESTADO_ASISTENCIA_LABEL] ?? k, valor: v, key: k })) : [];

  // ── Vista de marcado por nivel ────────────────────────────────────────────
  if (nivelActual) {
    const gradosNivel = nivelInfo?.grados ?? [];
    const seccionesPresentes = [...new Set(
      estudiantes.filter(e => !filtroGrado || e.grado === filtroGrado).map(e => e.seccion)
    )].filter(Boolean).sort();

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => { setNivelActual(null); setEstudiantes([]); setCambios({}); setFiltroGrado(""); setFiltroSeccion(""); setBusqueda(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)", fontSize: 13 }}
            >
              <ChevronLeft size={16} /> Niveles
            </button>
            <h2 className="page-title" style={{ marginBottom: 0 }}>
              Asistencia · {nivelInfo?.label}
            </h2>
          </div>
          <ExportarMensualBtn />
        </div>

        <div className="card">
          <div className="card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label">Fecha</label>
              <input type="date" className="form-input" value={fecha} onChange={e => setFecha(e.target.value)} style={{ minWidth: 160 }} />
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label">Grado</label>
              <select className="form-input" value={filtroGrado} onChange={e => { setFiltroGrado(e.target.value); setFiltroSeccion(""); }}>
                <option value="">Todos</option>
                {gradosNivel.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {filtroGrado && seccionesPresentes.length > 0 && (
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label className="form-label">Sección</label>
                <select className="form-input" value={filtroSeccion} onChange={e => setFiltroSeccion(e.target.value)}>
                  <option value="">Todas</option>
                  {seccionesPresentes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="form-field" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
              <label className="form-label">Buscar</label>
              <input className="form-input" placeholder="Nombre o apellido..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span>Estudiantes ({filtrados.length}){totalCambios > 0 && ` · ${totalCambios} cambios`}</span>
          </div>
          {cargando ? (
            <div className="card-body"><Cargando inline /></div>
          ) : (
            <div className="asistencia-lista">
              {filtrados.map(est => {
                const actual = estadoActual(est.id);
                return (
                  <div key={est.id} className={`asistencia-fila ${cambios[est.id] ? "asistencia-fila-cambio" : ""}`}>
                    <div className="asistencia-est">
                      <div className="asistencia-avatar">
                        {est.nombre_completo.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="asistencia-nombre">{est.nombre_completo}</div>
                        <div className="asistencia-sub">{est.grado} {est.seccion} · {est.codigo_matricula || "sin código"}</div>
                      </div>
                    </div>
                    <div className="asistencia-botones">
                      <button
                        onClick={() => ciclarEstado(est.id)}
                        style={{
                          padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                          fontWeight: 700, fontSize: 14, minWidth: 44,
                          background: actual ? BADGE[actual].bg : "#F3F4F6",
                          color: actual ? BADGE[actual].text : "#6B7280",
                        }}
                      >
                        {actual ? BADGE[actual].label : "—"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="card-body" style={{ borderTop: "1px solid var(--borde)", display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primario btn-icono" style={{ width: "auto" }} onClick={guardar} disabled={guardando || totalCambios === 0}>
              <Icon name="guardar" /> {guardando ? "Guardando..." : `Guardar ${totalCambios} cambios`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Panel principal con KPIs + cards de nivel ─────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Panel de Asistencia</h2>
        <ExportarMensualBtn />
      </div>

      {/* Cards de nivel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        {NIVELES.map(n => (
          <button
            key={n.key}
            onClick={() => setNivelActual(n.key)}
            style={{
              padding: "20px 16px", borderRadius: 12,
              border: `2px solid ${n.color}30`,
              background: `${n.color}08`,
              cursor: "pointer", textAlign: "left",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = n.color; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${n.color}30`; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: n.color, marginBottom: 4 }}>{n.label}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Ver y marcar asistencia →</div>
          </button>
        ))}
      </div>

      {kpis && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">% Asistencia</span>
              <span className="kpi-valor" style={{ color: kpis.porcentaje_asistencia >= 90 ? "var(--verde-600)" : kpis.porcentaje_asistencia >= 75 ? "var(--amarillo-600)" : "var(--rojo-600)" }}>
                {kpis.porcentaje_asistencia}%
              </span>
              <span className="kpi-sub">Últimos 30 días</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Registros</span>
              <span className="kpi-valor">{kpis.total_registros}</span>
              <span className="kpi-sub">Total del periodo</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Estudiantes</span>
              <span className="kpi-valor">{kpis.total_estudiantes}</span>
              <span className="kpi-sub">Matriculados</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Ausencias</span>
              <span className="kpi-valor" style={{ color: "var(--rojo-600)" }}>{kpis.por_estado.ausente}</span>
              <span className="kpi-sub">En el periodo</span>
            </div>
          </div>

          <div className="graficos-grid">
            <div className="card">
              <div className="card-header">Distribución de asistencia</div>
              <div className="card-body" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datosEstado} dataKey="valor" nameKey="nombre" cx="50%" cy="50%" outerRadius={80} label>
                      {datosEstado.map((d, i) => <Cell key={i} fill={COLORES[d.key] ?? "#64748B"} />)}
                    </Pie>
                    <Legend fontSize={11} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">Volumen por categoría</div>
              <div className="card-body" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosEstado} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="nombre" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                      {datosEstado.map((d, i) => <Cell key={i} fill={COLORES[d.key] ?? "#64748B"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {kpis.top_ausentes.length > 0 && (
            <div className="card">
              <div className="card-header">Top estudiantes con más ausencias</div>
              <div className="card-body">
                <table className="tabla-incidencias">
                  <thead>
                    <tr><th>Estudiante</th><th>Grado</th><th>Sección</th><th>Ausencias</th></tr>
                  </thead>
                  <tbody>
                    {kpis.top_ausentes.map((a, i) => (
                      <tr key={i}>
                        <td>{a.nombre}</td>
                        <td>{a.grado}</td>
                        <td>{a.seccion}</td>
                        <td><strong style={{ color: "var(--rojo-600)" }}>{a.ausencias}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
