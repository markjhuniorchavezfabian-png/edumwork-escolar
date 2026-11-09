import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Card from "../components/ui/Card";
import { Cargando } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";

interface KPICalendario {
  anio: number;
  cumple_norma: boolean;
  detalle: string;
  dias_lectivos_actuales: number;
  dias_gestion_actuales: number;
  dias_feriado: number;
  minimo_lectivos: number;
  minimo_gestion: number;
  fecha_inicio: string;
  fecha_fin: string;
}

interface DiaCal {
  id: number;
  fecha: string;
  tipo: string;
  tipo_label: string;
  descripcion: string;
  anio_lectivo: number;
}

const TIPOS = [
  { code: "gestion", label: "Semana de gestión" },
  { code: "feriado_regional", label: "Feriado regional" },
  { code: "feriado_local", label: "Feriado local / municipal" },
  { code: "no_laborable", label: "No laborable" },
  { code: "suspendido", label: "Suspendido (clima / emergencia)" },
];

const TIPO_COLOR: Record<string, { bg: string; text: string }> = {
  lectivo: { bg: "var(--info-bg-subtle)", text: "var(--info-text)" },
  gestion: { bg: "var(--warning-bg-subtle)", text: "var(--warning-text)" },
  feriado_nacional: { bg: "var(--danger-bg-subtle)", text: "var(--danger-text)" },
  feriado_regional: { bg: "var(--danger-bg-subtle)", text: "var(--danger-text)" },
  feriado_local: { bg: "var(--danger-bg-subtle)", text: "var(--danger-text)" },
  no_laborable: { bg: "var(--empty-state-bg)", text: "var(--texto)" },
  suspendido: { bg: "var(--empty-state-bg)", text: "var(--empty-state-text)" },
};

export default function CalendarioView() {
  const toast = useToast();
  const [anio] = useState(new Date().getFullYear());
  const [kpi, setKpi] = useState<KPICalendario | null>(null);
  const [dias, setDias] = useState<DiaCal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({ fecha: "", tipo: "gestion", descripcion: "" });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [k, d] = await Promise.all([
        api.get<KPICalendario>(`/calendario/kpi/?anio=${anio}`).then(r => r.data),
        api.get<DiaCal[] | { results: DiaCal[] }>(`/calendario/dias/?anio=${anio}&limit=200`).then(r => Array.isArray(r.data) ? r.data : r.data.results),
      ]);
      setKpi(k);
      setDias(d);
    } catch { toast.error("Error al cargar calendario."); }
    finally { setCargando(false); }
  }, [anio, toast]);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregarDia() {
    if (!nuevo.fecha) return;
    setCreando(true);
    try {
      await api.post("/calendario/dias/", { ...nuevo, anio_lectivo: anio });
      toast.ok("Día agregado.");
      setNuevo({ fecha: "", tipo: "gestion", descripcion: "" });
      cargar();
    } catch { toast.error("Error al agregar."); }
    finally { setCreando(false); }
  }

  async function eliminar(id: number) {
    try {
      await api.delete(`/calendario/dias/${id}/`);
      toast.ok("Eliminado.");
      cargar();
    } catch { toast.error("Error."); }
  }

  return (
    <div>
      <h2 className="page-title">Calendario escolar {anio}</h2>
      <p style={{ color: "var(--muted-foreground)", marginBottom: 16, fontSize: 14 }}>
        Gestión del calendario según <strong>RM 501-2025-MINEDU</strong>: mínimo 160 días lectivos y 30 días de gestión (8 semanas de gestión distribuidas en el año escolar 2026).
      </p>

      {cargando ? <Cargando inline /> : (
        <>
          {/* KPI de cumplimiento */}
          {kpi && (
            <Card>
              <div style={{
                background: kpi.cumple_norma ? "var(--success-bg-subtle)" : "var(--danger-bg-subtle)",
                border: `1px solid ${kpi.cumple_norma ? "color-mix(in srgb, var(--success-text) 45%, transparent)" : "var(--danger-border-subtle)"}`,
                borderRadius: 10, padding: 16, display: "flex", gap: 24, flexWrap: "wrap",
              }}>
                <div style={{ flex: "1 0 200px" }}>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.5 }}>Estado</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: kpi.cumple_norma ? "var(--success-text)" : "var(--danger-text)" }}>
                    {kpi.cumple_norma ? "Cumple RM 501-2025-MINEDU" : "No cumple todavía"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>{kpi.detalle}</div>
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Días lectivos</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: kpi.dias_lectivos_actuales >= kpi.minimo_lectivos ? "var(--success-text)" : "var(--danger-text)" }}>
                      {kpi.dias_lectivos_actuales}<span style={{ fontSize: 12, opacity: 0.6 }}> / {kpi.minimo_lectivos}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Días gestión</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: kpi.dias_gestion_actuales >= kpi.minimo_gestion ? "var(--success-text)" : "var(--danger-text)" }}>
                      {kpi.dias_gestion_actuales}<span style={{ fontSize: 12, opacity: 0.6 }}> / {kpi.minimo_gestion}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Feriados</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--danger-text)" }}>{kpi.dias_feriado}</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted-foreground)" }}>
                Año escolar: {kpi.fecha_inicio} → {kpi.fecha_fin}
              </div>
            </Card>
          )}

          {/* Formulario agregar */}
          <Card titulo="Agregar día especial">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-field" style={{ minWidth: 150 }}>
                <label className="form-label">Fecha</label>
                <input type="date" className="form-input" value={nuevo.fecha}
                  onChange={e => setNuevo({ ...nuevo, fecha: e.target.value })} />
              </div>
              <div className="form-field" style={{ minWidth: 220 }}>
                <label className="form-label">Tipo</label>
                <select className="form-input" value={nuevo.tipo}
                  onChange={e => setNuevo({ ...nuevo, tipo: e.target.value })}>
                  {TIPOS.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: 250 }}>
                <label className="form-label">Descripción</label>
                <input className="form-input" value={nuevo.descripcion}
                  placeholder="Ej: Semana de planificación bimestral"
                  onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} />
              </div>
              <button className="btn btn-primario" onClick={agregarDia}
                disabled={creando || !nuevo.fecha} style={{ width: "auto" }}>
                {creando ? "..." : "Agregar"}
              </button>
            </div>
          </Card>

          {/* Lista de días especiales */}
          <Card titulo={`Días especiales del año ${anio} (${dias.length})`}>
            {dias.length === 0 ? (
              <p style={{ color: "var(--muted-foreground)" }}>Sin días especiales registrados.</p>
            ) : (
              <table className="tabla-incidencias" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Fecha</th>
                    <th style={{ width: 180 }}>Tipo</th>
                    <th>Descripción</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map(d => {
                    const col = TIPO_COLOR[d.tipo] ?? { bg: "var(--empty-state-bg)", text: "var(--texto)" };
                    return (
                      <tr key={d.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.fecha}</td>
                        <td>
                          <span style={{ fontSize: 11, background: col.bg, color: col.text, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                            {d.tipo_label}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{d.descripcion}</td>
                        <td>
                          <button onClick={() => eliminar(d.id)}
                            style={{ background: "none", border: "1px solid var(--danger-border-subtle)", color: "var(--danger-text)", padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
