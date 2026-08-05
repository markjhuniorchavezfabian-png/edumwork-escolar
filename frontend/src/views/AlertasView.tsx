import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { Cargando } from "../components/ui/Spinner";
import Card from "../components/ui/Card";

interface Alerta {
  id: number;
  nombre: string;
  seccion: string;
  seccion_id: number;
  areas_c: string[];
  faltas_mes: number;
  nivel_riesgo: "alto" | "medio";
}

interface Seccion {
  id: number;
  nombre: string;
}

const BADGE_NIVEL: Record<string, { label: string; bg: string; color: string }> = {
  alto:  { label: "Alto",  bg: "var(--danger-bg-subtle)",  color: "var(--danger-text)" },
  medio: { label: "Medio", bg: "var(--warning-bg-subtle)", color: "var(--warning-text)" },
};

export default function AlertasView() {
  const { usuario } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [seccionFiltro, setSeccionFiltro] = useState("");
  const [umbral, setUmbral] = useState(3);
  const [cargando, setCargando] = useState(true);
  const [reporteIA, setReporteIA] = useState<string | null>(null);
  const [generandoReporte, setGenerandoReporte] = useState(false);

  const esDirector = usuario?.rol === "director" || usuario?.rol === "subdirector";

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params: Record<string, string> = { umbral_faltas: String(umbral) };
      if (seccionFiltro) params.seccion_id = seccionFiltro;
      const { data } = await api.get<Alerta[]>("/notas/alertas-riesgo/", { params });
      setAlertas(data);
    } catch {
      // silencioso
    } finally {
      setCargando(false);
    }
  }, [seccionFiltro, umbral]);

  useEffect(() => {
    if (esDirector) {
      api.get<Seccion[]>("/usuarios/secciones/")
        .then(({ data }) => setSecciones(data))
        .catch(() => {});
    }
  }, [esDirector]);

  useEffect(() => { cargar(); }, [cargar]);

  async function generarReporteIA() {
    setGenerandoReporte(true);
    setReporteIA(null);
    try {
      const seccionNombre = seccionFiltro
        ? secciones.find((s) => String(s.id) === seccionFiltro)?.nombre ?? "la sección"
        : "todas las secciones";
      const { data } = await api.post("/ia/reporte-riesgo/", {
        estudiantes: alertas,
        seccion_nombre: seccionNombre,
      });
      if (data.sin_config) { setReporteIA("Sin IA configurada."); return; }
      setReporteIA(data.reporte);
    } catch {
      setReporteIA("Error al generar el reporte.");
    } finally {
      setGenerandoReporte(false);
    }
  }

  const altos  = alertas.filter((a) => a.nivel_riesgo === "alto");
  const medios = alertas.filter((a) => a.nivel_riesgo === "medio");

  return (
    <div>
      <h2 className="page-title">Alertas tempranas</h2>
      <p style={{ color: "var(--muted-foreground)", marginBottom: 20, fontSize: 14 }}>
        Estudiantes con C en algún área y/o {umbral}+ faltas este mes.
      </p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {esDirector && secciones.length > 0 && (
          <select
            className="form-input"
            style={{ maxWidth: 200 }}
            value={seccionFiltro}
            onChange={(e) => setSeccionFiltro(e.target.value)}
          >
            <option value="">Todas las secciones</option>
            {secciones.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <label style={{ color: "var(--muted-foreground)" }}>Umbral faltas:</label>
          <select
            className="form-input"
            style={{ width: 70 }}
            value={umbral}
            onChange={(e) => setUmbral(Number(e.target.value))}
          >
            {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Resumen chips + botón IA */}
      {!cargando && alertas.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <Chip color="var(--danger-text)" bg="var(--danger-bg-subtle)" label={`${altos.length} riesgo alto`} />
          <Chip color="var(--warning-text)" bg="var(--warning-bg-subtle)" label={`${medios.length} riesgo medio`} />
          <Chip color="var(--info-text)" bg="var(--info-bg-subtle)" label={`${alertas.length} total`} />
          <button
            className="btn btn-secundario"
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
            onClick={generarReporteIA}
            disabled={generandoReporte}
          >
            {generandoReporte
              ? <><RefreshCw size={13} className="spin" /> Generando...</>
              : <><Sparkles size={13} /> Generar reporte IA</>
            }
          </button>
        </div>
      )}

      {cargando ? (
        <Cargando />
      ) : alertas.length === 0 ? (
        <div style={{
          background: "var(--success-bg-subtle)", border: "1px solid color-mix(in srgb, var(--success-text) 45%, transparent)",
          borderRadius: 10, padding: 24, textAlign: "center", color: "var(--success-text)", fontSize: 14,
        }}>
          Sin alertas activas. Todos los estudiantes están al día en notas y asistencia.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Estudiante", "Sección", "Áreas con C", "Faltas este mes", "Riesgo"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertas.map((a) => {
                const badge = BADGE_NIVEL[a.nivel_riesgo];
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--borde)" }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>{a.nombre}</span>
                    </td>
                    <td style={tdStyle}>{a.seccion}</td>
                    <td style={tdStyle}>
                      {a.areas_c.length === 0
                        ? <span style={{ color: "var(--muted-foreground)" }}>—</span>
                        : a.areas_c.map((area) => (
                          <span key={area} style={{
                            display: "inline-block", marginRight: 4, marginBottom: 2,
                            background: "var(--danger-bg-subtle)", color: "var(--danger-text)",
                            border: "1px solid var(--danger-border-subtle)", borderRadius: 4,
                            padding: "1px 6px", fontSize: 11, fontWeight: 600,
                          }}>{area}</span>
                        ))
                      }
                    </td>
                    <td style={tdStyle}>
                      {a.faltas_mes > 0
                        ? <span style={{ color: a.faltas_mes >= umbral ? "var(--danger-text)" : "var(--texto)", fontWeight: a.faltas_mes >= umbral ? 700 : 400 }}>
                            {a.faltas_mes}
                          </span>
                        : <span style={{ color: "var(--muted-foreground)" }}>0</span>
                      }
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        background: badge.bg, color: badge.color,
                        border: `1px solid ${badge.color}40`,
                        borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* F2: Reporte narrativo IA */}
      {reporteIA && (
        <div style={{ marginTop: 20 }}>
          <Card titulo="Reporte de riesgo (IA)">
            <div style={{ borderLeft: "3px solid var(--danger-border-subtle)", paddingLeft: 16 }}>
              {reporteIA.split("\n").map((line, i) => {
                if (line.startsWith("## ")) return <h3 key={i} style={{ margin: "12px 0 4px", fontSize: 15 }}>{line.slice(3)}</h3>;
                if (line.startsWith("**") && line.endsWith("**")) return <strong key={i} style={{ display: "block" }}>{line.slice(2, -2)}</strong>;
                if (line.startsWith("- ")) return <li key={i} style={{ marginLeft: 16, fontSize: 13 }}>{line.slice(2)}</li>;
                return line ? <p key={i} style={{ margin: "4px 0", fontSize: 13 }}>{line}</p> : <br key={i} />;
              })}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 12 }}>
              Generado con IA a partir de los datos actuales. Revisa antes de compartir.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Chip({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <div style={{
      background: bg, color, border: `1px solid ${color}40`,
      borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600,
    }}>
      {label}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  background: "var(--muted)",
  padding: "8px 12px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  borderBottom: "2px solid var(--borde)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  verticalAlign: "middle",
};
