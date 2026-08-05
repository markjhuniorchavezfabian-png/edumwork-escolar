import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import SeccionCard from "../components/ui/SeccionCard";
import Card from "../components/ui/Card";
import { useToast } from "../components/ui/Toast";
import { Cargando } from "../components/ui/Spinner";
import { Sparkles, RefreshCw, FileSpreadsheet, FileText, File, AlertTriangle, ChevronLeft } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useInstitucion } from "../context/InstitucionContext";
import { useModoRol } from "../hooks/useModoRol";

interface Seccion {
  id: number;
  nombre: string;
  grado: string;
  letra: string;
  nivel?: string;
}

interface DistribucionArea {
  area: string;
  distribucion: { AD?: number; A?: number; B?: number; C?: number };
}

interface InformeData {
  seccion: string;
  bimestre: string;
  total_estudiantes: number;
  areas: DistribucionArea[];
  narrativa: string | null;
}

const NL_COLORS: Record<string, string> = {
  AD: "#1e6b2e", A: "#2563eb", B: "#d97706", C: "#dc2626",
};
const NL_BG: Record<string, string> = {
  AD: "#dcfce7", A: "#dbeafe", B: "#fef3c7", C: "#fee2e2",
};
const BIMESTRES = ["1", "2", "3", "4"] as const;
type Bim = typeof BIMESTRES[number];

// ── Barra horizontal AD/A/B/C ────────────────────────────────────────────────
function BarrasNL({ dist, total, compact }: { dist: DistribucionArea["distribucion"]; total: number; compact?: boolean }) {
  const niveles: Array<"AD" | "A" | "B" | "C"> = ["AD", "A", "B", "C"];
  const suma = Object.values(dist).reduce((s, v) => s + (v || 0), 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height: compact ? 18 : 24, borderRadius: 5, overflow: "hidden", marginBottom: 4 }}>
        {niveles.map((nl) => {
          const v = dist[nl] || 0;
          const pct = Math.round((v / suma) * 100);
          if (pct === 0) return null;
          return (
            <div key={nl} title={`${nl}: ${v} (${pct}%)`} style={{
              width: `${pct}%`, background: NL_COLORS[nl],
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: "#fff", fontWeight: 700,
            }}>
              {pct > 10 ? `${pct}%` : ""}
            </div>
          );
        })}
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {niveles.map((nl) => {
            const v = dist[nl] || 0;
            if (v === 0) return null;
            const pct = Math.round((v / suma) * 100);
            return (
              <span key={nl} style={{
                fontSize: 11, padding: "1px 7px", borderRadius: 10,
                background: NL_BG[nl], color: NL_COLORS[nl], fontWeight: 600,
              }}>
                {nl} {v} ({pct}%)
              </span>
            );
          })}
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>de {total}</span>
        </div>
      )}
    </div>
  );
}

// ── Celda de % para tabla comparativa ───────────────────────────────────────
function CeldaNL({ dist, nl }: { dist?: DistribucionArea["distribucion"]; nl: "AD" | "A" | "B" | "C" }) {
  if (!dist) return <td style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 12 }}>—</td>;
  const suma = Object.values(dist).reduce((s, v) => s + (v || 0), 0) || 1;
  const v = dist[nl] || 0;
  const pct = Math.round((v / suma) * 100);
  if (v === 0) return <td style={{ textAlign: "center", color: "var(--muted-foreground)", fontSize: 12 }}>—</td>;
  return (
    <td style={{ textAlign: "center" }}>
      <span style={{
        fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
        background: NL_BG[nl], color: NL_COLORS[nl],
      }}>
        {pct}%
      </span>
    </td>
  );
}

function NarrativaMarkdown({ texto }: { texto: string }) {
  const partes = texto.split(/^(##\s.+)$/m);
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7 }}>
      {partes.map((parte, i) => {
        if (parte.startsWith("## ")) {
          return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)", marginTop: 18, marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>{parte.replace("## ", "")}</h3>;
        }
        return <p key={i} style={{ marginBottom: 8, color: "var(--foreground)" }}>{parte.trim()}</p>;
      })}
    </div>
  );
}


// ── Vista DOCENTE: sus áreas por bimestre ───────────────────────────────────
function VistaDocente({ secciones, anio }: { secciones: Seccion[]; anio: number }) {
  const toast = useToast();
  const [seccionId, setSeccionId] = useState("");
  const [datos, setDatos] = useState<Record<Bim, InformeData | null>>({ "1": null, "2": null, "3": null, "4": null });
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    if (!seccionId) return;
    setCargando(true);
    try {
      const resultados = await Promise.allSettled(
        BIMESTRES.map(b => api.get<InformeData>("/notas/informe/", { params: { seccion_id: seccionId, bimestre: b, anio, solo_datos: 1 } }))
      );
      const nuevo: Record<Bim, InformeData | null> = { "1": null, "2": null, "3": null, "4": null };
      BIMESTRES.forEach((b, i) => {
        const r = resultados[i];
        if (r.status === "fulfilled") nuevo[b] = r.value.data;
      });
      setDatos(nuevo);
    } catch { toast.error("Error al cargar datos."); }
    finally { setCargando(false); }
  }

  useEffect(() => { if (seccionId) cargar(); }, [seccionId, anio]); // eslint-disable-line

  // Recopilar áreas únicas con datos
  const todasAreas = Array.from(new Set(
    BIMESTRES.flatMap(b => datos[b]?.areas.map(a => a.area) ?? [])
  )).sort();

  const totalEst = datos["1"]?.total_estudiantes ?? datos["2"]?.total_estudiantes ?? 0;

  // Áreas críticas: >30% en C en algún bimestre
  const areasCriticas = new Set(
    todasAreas.filter(area =>
      BIMESTRES.some(b => {
        const d = datos[b]?.areas.find(a => a.area === area)?.distribucion;
        if (!d) return false;
        const suma = Object.values(d).reduce((s, v) => s + (v || 0), 0) || 1;
        return (d.C || 0) / suma > 0.3;
      })
    )
  );

  // Pantalla de selección de sección
  if (!seccionId) {
    return (
      <div>
        <h3 style={{ marginBottom: 12, fontSize: 15, fontWeight: 600 }}>Seleccioná la sección:</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {secciones.map(s => (
            <SeccionCard
              key={s.id}
              grado={s.grado}
              letra={s.letra}
              nivel={s.nivel ?? "primaria"}
              onClick={() => setSeccionId(String(s.id))}
            />
          ))}
        </div>
      </div>
    );
  }

  const seccionActual = secciones.find(s => String(s.id) === seccionId);

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => setSeccionId("")}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)", fontSize: 13 }}
        >
          <ChevronLeft size={16} /> Secciones
        </button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>
          {seccionActual ? `${seccionActual.grado} ${seccionActual.letra}` : ""}
        </span>
        <div style={{ marginLeft: "auto" }}>
        <button className="btn btn-secundario" onClick={cargar} disabled={cargando}>
          <RefreshCw size={14} className={cargando ? "spin" : ""} /> Actualizar
        </button>
        </div>
      </div>

      {cargando && <Cargando />}

      {!cargando && todasAreas.length > 0 && (
        <>
          {areasCriticas.size > 0 && (
            <div className="ui-alert ui-alert-danger">
              <AlertTriangle size={16} />
              <span><strong>Áreas críticas (&gt;30% en C):</strong> {[...areasCriticas].join(", ")}</span>
            </div>
          )}

          <Card titulo="Mis áreas — comparativa por bimestre">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700 }}>Área</th>
                    {BIMESTRES.map(b => (
                      <th key={b} colSpan={4} style={{ textAlign: "center", padding: "8px 4px", fontWeight: 700, borderLeft: "1px solid var(--border)" }}>
                        Bimestre {b}
                        {datos[b] && <div style={{ fontSize: 10, fontWeight: 400, color: "var(--muted-foreground)" }}>{datos[b]!.total_estudiantes} est.</div>}
                      </th>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
                    <th />
                    {BIMESTRES.map(b => (
                      ["AD", "A", "B", "C"].map(nl => (
                        <th key={`${b}-${nl}`} style={{ textAlign: "center", padding: "4px 6px", fontSize: 11, color: NL_COLORS[nl], fontWeight: 700, borderLeft: nl === "AD" ? "1px solid var(--border)" : undefined }}>
                          {nl}
                        </th>
                      ))
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todasAreas.map((area, idx) => {
                    const critica = areasCriticas.has(area);
                    return (
                      <tr key={area} className={critica ? "ui-row-danger" : undefined} style={{ borderBottom: "1px solid var(--border)", background: critica ? undefined : idx % 2 === 0 ? "transparent" : "var(--muted)" }}>
                        <td className={critica ? "ui-text-danger" : undefined} style={{ padding: "7px 10px", fontWeight: critica ? 700 : 500 }}>
                          {critica && <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />}
                          {area}
                        </td>
                        {BIMESTRES.map(b => {
                          const dist = datos[b]?.areas.find(a => a.area === area)?.distribucion;
                          return (["AD", "A", "B", "C"] as const).map(nl => (
                            <CeldaNL key={`${b}-${nl}`} dist={dist} nl={nl} />
                          ));
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 14, fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 10, flexWrap: "wrap" }}>
              {(["AD", "A", "B", "C"] as const).map(nl => (
                <span key={nl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: NL_COLORS[nl], display: "inline-block" }} />
                  <strong>{nl}</strong> {nl === "AD" ? "Dest." : nl === "A" ? "Esperado" : nl === "B" ? "Proceso" : "Inicio"}
                </span>
              ))}
              <span style={{ color: "var(--muted-foreground)" }}>· Total estudiantes: {totalEst}</span>
            </div>
          </Card>

          {/* Barras visuales por bimestre */}
          <Card titulo="Distribución visual por bimestre">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
              {BIMESTRES.map(b => {
                const inf = datos[b];
                if (!inf || inf.areas.length === 0) return (
                  <div key={b} style={{ background: "var(--muted)", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>Bimestre {b}</div>
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Sin datos</div>
                  </div>
                );
                return (
                  <div key={b} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: "var(--primary)" }}>
                      Bimestre {b} · {inf.total_estudiantes} estudiantes
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {inf.areas.map(a => (
                        <div key={a.area}>
                          <div className={areasCriticas.has(a.area) ? "ui-text-danger" : undefined} style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                            {areasCriticas.has(a.area) && "⚠ "}{a.area}
                          </div>
                          <BarrasNL dist={a.distribucion} total={inf.total_estudiantes} compact />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {!cargando && todasAreas.length === 0 && seccionId && (
        <div style={{ background: "var(--muted)", borderRadius: 10, padding: 24, textAlign: "center", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--foreground)" }}>Todavía no hay notas para mostrar.</strong>
          <div>Carga notas desde <strong>Registro de notas</strong> o importa la plantilla Excel para activar gráficos, alertas e informes.</div>
        </div>
      )}
    </div>
  );
}

// ── Vista DIRECTOR: multi-sección + comparativa ──────────────────────────────
function VistaDirector({ secciones, anio }: { secciones: Seccion[]; anio: number }) {
  const toast = useToast();
  const [bimestre, setBimestre] = useState<Bim | "todos">("1");
  const [datos, setDatos] = useState<Record<number, InformeData | null>>({});
  const [cargando, setCargando] = useState(false);
  // Para comparativa: una sección seleccionada
  const [seccionComp, setSeccionComp] = useState(secciones[0] ? String(secciones[0].id) : "");
  const [datosComp, setDatosComp] = useState<Record<Bim, InformeData | null>>({ "1": null, "2": null, "3": null, "4": null });
  const [cargandoComp, setCargandoComp] = useState(false);
  const [tab, setTab] = useState<"resumen" | "comparativa">("resumen");
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [exportando, setExportando] = useState<string | null>(null);

  async function cargarResumen() {
    setCargando(true);
    try {
      const resultados = await Promise.allSettled(
        secciones.map(s => api.get<InformeData>("/notas/informe/", {
          params: { seccion_id: s.id, ...(bimestre !== "todos" ? { bimestre } : {}), anio, solo_datos: 1 }
        }))
      );
      const nuevo: Record<number, InformeData | null> = {};
      secciones.forEach((s, i) => {
        const r = resultados[i];
        nuevo[s.id] = r.status === "fulfilled" ? r.value.data : null;
      });
      setDatos(nuevo);
    } catch { toast.error("Error al cargar resumen."); }
    finally { setCargando(false); }
  }

  async function cargarComparativa() {
    if (!seccionComp) return;
    setCargandoComp(true);
    try {
      const resultados = await Promise.allSettled(
        BIMESTRES.map(b => api.get<InformeData>("/notas/informe/", { params: { seccion_id: seccionComp, bimestre: b, anio, solo_datos: 1 } }))
      );
      const nuevo: Record<Bim, InformeData | null> = { "1": null, "2": null, "3": null, "4": null };
      BIMESTRES.forEach((b, i) => {
        const r = resultados[i];
        if (r.status === "fulfilled") nuevo[b] = r.value.data;
      });
      setDatosComp(nuevo);
    } catch { toast.error("Error al cargar comparativa."); }
    finally { setCargandoComp(false); }
  }

  useEffect(() => { cargarResumen(); }, [bimestre, anio]); // eslint-disable-line
  useEffect(() => { if (tab === "comparativa") cargarComparativa(); }, [tab, seccionComp, anio]); // eslint-disable-line

  async function descargar(secId: number, formato: "xlsx" | "pdf" | "docx") {
    setExportando(`${secId}-${formato}`);
    try {
      const params: Record<string, string | number> = { seccion_id: secId, anio, formato };
      if (bimestre !== "todos") params.bimestre = bimestre;
      const resp = await api.get("/notas/informe/exportar/", { params, responseType: "blob" });
      const blob = new Blob([resp.data], { type: String(resp.headers["content-type"] ?? "application/octet-stream") });
      const url = URL.createObjectURL(blob);
      const a = anchorRef.current!;
      a.href = url; a.download = `informe_seccion_${secId}.${formato}`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Error al exportar."); }
    finally { setExportando(null); }
  }

  // Todas las áreas en el bimestre seleccionado
  const todasAreas = Array.from(new Set(
    Object.values(datos).flatMap(d => d?.areas.map(a => a.area) ?? [])
  )).sort();

  // Áreas críticas globales
  const areasCriticas = new Set(
    todasAreas.filter(area =>
      Object.values(datos).some(d => {
        const dist = d?.areas.find(a => a.area === area)?.distribucion;
        if (!dist) return false;
        const suma = Object.values(dist).reduce((s, v) => s + (v || 0), 0) || 1;
        return (dist.C || 0) / suma > 0.3;
      })
    )
  );

  // Comparativa: áreas únicas de la sección elegida
  const areasComp = Array.from(new Set(
    BIMESTRES.flatMap(b => datosComp[b]?.areas.map(a => a.area) ?? [])
  )).sort();

  return (
    <div>
      <a ref={anchorRef} style={{ display: "none" }} />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid var(--border)", paddingBottom: 0 }}>
        {(["resumen", "comparativa"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 18px", fontSize: 14, fontWeight: tab === t ? 700 : 400,
            background: "transparent", border: "none", cursor: "pointer",
            borderBottom: tab === t ? "2px solid var(--primary)" : "2px solid transparent",
            color: tab === t ? "var(--primary)" : "var(--muted-foreground)",
            marginBottom: -2,
          }}>
            {t === "resumen" ? "Resumen multi-sección" : "Comparativa bimestral"}
          </button>
        ))}
      </div>

      {/* ── TAB RESUMEN ───────────────────────────────────────────────────── */}
      {tab === "resumen" && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
            <div className="form-field">
              <label className="form-label">Bimestre</label>
              <select className="form-input" value={bimestre} onChange={e => setBimestre(e.target.value as Bim | "todos")}>
                <option value="todos">Anual</option>
                {BIMESTRES.map(b => <option key={b} value={b}>Bimestre {b}</option>)}
              </select>
            </div>
            <button className="btn btn-secundario" onClick={cargarResumen} disabled={cargando} style={{ marginBottom: 2 }}>
              <RefreshCw size={14} className={cargando ? "spin" : ""} /> Actualizar
            </button>
          </div>

          {areasCriticas.size > 0 && (
            <div className="ui-alert ui-alert-danger">
              <AlertTriangle size={16} />
              <span><strong>Áreas críticas en alguna sección (&gt;30% en C):</strong> {[...areasCriticas].join(", ")}</span>
            </div>
          )}

          {cargando ? <Cargando /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {secciones.map(sec => {
                const inf = datos[sec.id];
                const secNombre = sec.nombre || `${sec.grado} ${sec.letra}`;
                return (
                  <Card key={sec.id} titulo={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                      <span>{secNombre} {inf && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)" }}>· {inf.total_estudiantes} estudiantes</span>}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["xlsx", "pdf", "docx"] as const).map(fmt => {
                          const Icon = fmt === "xlsx" ? FileSpreadsheet : fmt === "pdf" ? File : FileText;
                          return (
                            <button key={fmt} onClick={() => descargar(sec.id, fmt)} disabled={exportando !== null}
                              title={`Exportar ${fmt.toUpperCase()}`}
                              style={{ padding: "3px 8px", fontSize: 11, borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                              {exportando === `${sec.id}-${fmt}` ? <RefreshCw size={11} className="spin" /> : <Icon size={11} />}
                              {fmt.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  }>
                    {!inf ? (
                      <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.6 }}>
                        Sin datos para este período. Cuando el docente registre notas, aquí aparecerá la distribución AD/A/B/C y los botones de exportación servirán para entregar informes.
                      </div>
                    ) : inf.areas.length === 0 ? (
                      <div style={{ color: "var(--muted-foreground)", fontSize: 13, lineHeight: 1.6 }}>
                        Sin notas registradas. Primero carga notas o importa el Excel de evaluación.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {inf.areas.map(a => {
                          const critica = areasCriticas.has(a.area);
                          return (
                            <div key={a.area}>
                              <div className={critica ? "ui-text-danger" : undefined} style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                                {critica && "⚠ "}{a.area}
                              </div>
                              <BarrasNL dist={a.distribucion} total={inf.total_estudiantes} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB COMPARATIVA BIMESTRAL ─────────────────────────────────────── */}
      {tab === "comparativa" && (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Sección</label>
              <select className="form-input" value={seccionComp} onChange={e => setSeccionComp(e.target.value)}>
                {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre || `${s.grado} ${s.letra}`}</option>)}
              </select>
            </div>
            <button className="btn btn-secundario" onClick={cargarComparativa} disabled={cargandoComp} style={{ marginBottom: 2 }}>
              <RefreshCw size={14} className={cargandoComp ? "spin" : ""} /> Actualizar
            </button>
          </div>

          {cargandoComp ? <Cargando /> : areasComp.length === 0 ? (
            <div style={{ background: "var(--muted)", borderRadius: 10, padding: 24, textAlign: "center", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--foreground)" }}>Sin notas registradas en esta sección.</strong>
              <div>La comparativa bimestral aparecerá cuando existan notas en al menos un bimestre.</div>
            </div>
          ) : (
            <Card titulo="Comparativa por bimestre">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700 }}>Área</th>
                      {BIMESTRES.map(b => (
                        <th key={b} colSpan={4} style={{ textAlign: "center", padding: "8px 4px", fontWeight: 700, borderLeft: "1px solid var(--border)" }}>
                          Bimestre {b}
                          {datosComp[b] && <div style={{ fontSize: 10, fontWeight: 400, color: "var(--muted-foreground)" }}>{datosComp[b]!.total_estudiantes} est.</div>}
                        </th>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
                      <th />
                      {BIMESTRES.map(b => (
                        (["AD", "A", "B", "C"] as const).map(nl => (
                          <th key={`${b}-${nl}`} style={{ textAlign: "center", padding: "4px 6px", fontSize: 11, color: NL_COLORS[nl], fontWeight: 700, borderLeft: nl === "AD" ? "1px solid var(--border)" : undefined }}>
                            {nl}
                          </th>
                        ))
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {areasComp.map((area, idx) => {
                      // Detectar tendencia negativa (B1→B4 aumenta C)
                      const pctC = BIMESTRES.map(b => {
                        const d = datosComp[b]?.areas.find(a => a.area === area)?.distribucion;
                        if (!d) return null;
                        const suma = Object.values(d).reduce((s, v) => s + (v || 0), 0) || 1;
                        return (d.C || 0) / suma;
                      });
                      const pctCFiltrado = pctC.filter((v): v is number => v !== null);
                      const tendenciaNeg = pctCFiltrado.length >= 2 &&
                        pctCFiltrado[pctCFiltrado.length - 1] > pctCFiltrado[0] + 0.1;

                      return (
                        <tr key={area} className={tendenciaNeg ? "ui-row-danger" : undefined} style={{ borderBottom: "1px solid var(--border)", background: tendenciaNeg ? undefined : idx % 2 === 0 ? "transparent" : "var(--muted)" }}>
                          <td className={tendenciaNeg ? "ui-text-danger" : undefined} style={{ padding: "7px 10px", fontWeight: tendenciaNeg ? 700 : 500 }}>
                            {tendenciaNeg && <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />}
                            {area}
                          </td>
                          {BIMESTRES.map(b => {
                            const dist = datosComp[b]?.areas.find(a => a.area === area)?.distribucion;
                            return (["AD", "A", "B", "C"] as const).map(nl => (
                              <CeldaNL key={`${b}-${nl}`} dist={dist} nl={nl} />
                            ));
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 14, fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 10, flexWrap: "wrap" }}>
                {(["AD", "A", "B", "C"] as const).map(nl => (
                  <span key={nl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: NL_COLORS[nl], display: "inline-block" }} />
                    <strong>{nl}</strong> {nl === "AD" ? "Dest." : nl === "A" ? "Esperado" : nl === "B" ? "Proceso" : "Inicio"}
                  </span>
                ))}
                <span className="ui-text-danger" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} /> Tendencia negativa (C aumenta entre bimestres)
                </span>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function InformesView() {
  const toast = useToast();
  useAuth();
  const { rolEfectivo } = useModoRol();
  const esDocente = rolEfectivo === "docente";
  const institucion = useInstitucion();
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [anio, setAnio] = useState(institucion.anio_lectivo_activo || new Date().getFullYear());
  const [cargandoSec, setCargandoSec] = useState(true);

  // Informe IA individual (tab separado para director)
  const [seccionIA, setSeccionIA] = useState("");
  const [bimestreIA, setBimestreIA] = useState("");
  const [informeIA, setInformeIA] = useState<InformeData | null>(null);
  const [generando, setGenerando] = useState(false);
  const [cierreBimestre, setCierreBimestre] = useState<string | null>(null);
  const [generandoCierre, setGenerandoCierre] = useState(false);
  const [exportandoIA, setExportandoIA] = useState<string | null>(null);
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const [tabPrincipal, setTabPrincipal] = useState<"consolidado" | "ia">("consolidado");

  useEffect(() => {
    if (esDocente) {
      api.get<{ id: number; nombre: string; grado: string; letra: string; nivel: string }[]>("/asistencia/secciones/mis/")
        .then(({ data }) => {
          setSecciones(data.map(s => ({ id: s.id, nombre: s.nombre, grado: s.grado, letra: s.letra, nivel: s.nivel })));
        })
        .catch(() => toast.error("Error al cargar secciones."))
        .finally(() => setCargandoSec(false));
    } else {
      api.get<{ results?: Seccion[] } | Seccion[]>("/usuarios/secciones/?limit=200")
        .then(({ data }) => {
          const arr = Array.isArray(data) ? data : ((data as { results?: Seccion[] }).results ?? []);
          setSecciones(arr);
          if (arr.length > 0) setSeccionIA(String(arr[0].id));
        })
        .catch(() => toast.error("Error al cargar secciones."))
        .finally(() => setCargandoSec(false));
    }
  }, [esDocente]); // eslint-disable-line

  async function generarIA() {
    const sid = esDocente ? (secciones[0] ? String(secciones[0].id) : "") : seccionIA;
    if (!sid) { toast.error("Selecciona una sección."); return; }
    setGenerando(true); setInformeIA(null);
    try {
      const params: Record<string, string | number> = { seccion_id: sid, anio };
      if (bimestreIA) params.bimestre = bimestreIA;
      const { data } = await api.get<InformeData>("/notas/informe/", { params });
      setInformeIA(data);
      if (!data.narrativa) toast.error("No hay IA configurada. Se muestran solo estadísticas.");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? "Error al generar informe.");
    } finally { setGenerando(false); }
  }

  async function descargarIA(formato: "xlsx" | "pdf" | "docx") {
    const sid = esDocente ? (secciones[0] ? String(secciones[0].id) : "") : seccionIA;
    if (!sid) return;
    setExportandoIA(formato);
    try {
      const params: Record<string, string | number> = { seccion_id: sid, anio, formato };
      if (bimestreIA) params.bimestre = bimestreIA;
      const resp = await api.get("/notas/informe/exportar/", { params, responseType: "blob" });
      const blob = new Blob([resp.data], { type: String(resp.headers["content-type"] ?? "") });
      const url = URL.createObjectURL(blob);
      const a = anchorRef.current!;
      a.href = url;
      const disposition = resp.headers["content-disposition"];
      a.download = (typeof disposition === "string" ? disposition : "").split("filename=")[1]?.replace(/"/g, "") ?? `informe.${formato}`;
      a.click(); URL.revokeObjectURL(url);
      toast.ok(`Informe ${formato.toUpperCase()} descargado.`);
    } catch { toast.error("Error al exportar."); }
    finally { setExportandoIA(null); }
  }

  async function generarCierre() {
    const sid = esDocente ? (secciones[0] ? String(secciones[0].id) : "") : seccionIA;
    if (!sid) return;
    if (!bimestreIA || bimestreIA.includes(",")) { toast.error("Selecciona un bimestre específico (1, 2, 3 o 4)."); return; }
    setGenerandoCierre(true); setCierreBimestre(null);
    try {
      const { data } = await api.post("/ia/cierre-bimestre/", { seccion_id: Number(sid), bimestre: bimestreIA, anio });
      if (data.sin_config) { toast.error("No hay IA configurada."); return; }
      setCierreBimestre(data.cierre);
    } catch { toast.error("Error al generar cierre de bimestre."); }
    finally { setGenerandoCierre(false); }
  }

  if (cargandoSec) return <Cargando />;

  const anioSelector = (
    <div className="form-field">
      <label className="form-label">Año</label>
      <select className="form-input" value={anio} onChange={e => setAnio(Number(e.target.value))}>
        {Array.from(
          { length: (institucion.anio_lectivo_activo || anio) - (institucion.primer_anio_lectivo || anio) + 1 },
          (_, i) => (institucion.primer_anio_lectivo || anio) + i
        ).map(y => <option key={y} value={y}>{y}{y === institucion.anio_lectivo_activo ? " (activo)" : ""}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <a ref={anchorRef} style={{ display: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>Informes de aprendizaje</h2>
          <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: 0 }}>
            {esDocente ? "Tus áreas y secciones asignadas." : "Consolidado multi-sección + análisis con IA."}
          </p>
        </div>
        {anioSelector}
      </div>

      {esDocente && secciones.length === 0 && (
        <div style={{ background: "var(--amarillo-50)", border: "1px solid var(--amarillo-300)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <strong>Sin secciones asignadas.</strong> El director debe asignarte secciones en <strong>Administración → Asignaciones de docentes</strong>.
        </div>
      )}

      {!esDocente && secciones.length === 0 && (
        <div style={{ background: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 12, padding: 22, marginBottom: 16, lineHeight: 1.6 }}>
          <strong>Aún no hay secciones creadas.</strong>
          <div style={{ color: "var(--muted-foreground)", fontSize: 14 }}>
            Crea secciones en <strong>Administración → Secciones</strong> y luego registra notas para activar informes, gráficos, exportes e IA.
          </div>
        </div>
      )}

      {/* DOCENTE: solo vista comparativa de sus áreas */}
      {esDocente && secciones.length > 0 && (
        <VistaDocente secciones={secciones} anio={anio} />
      )}

      {/* DIRECTOR: tabs consolidado + IA */}
      {!esDocente && secciones.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid var(--border)" }}>
            {(["consolidado", "ia"] as const).map(t => (
              <button key={t} onClick={() => setTabPrincipal(t)} style={{
                padding: "8px 20px", fontSize: 14, fontWeight: tabPrincipal === t ? 700 : 400,
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: tabPrincipal === t ? "2px solid var(--primary)" : "2px solid transparent",
                color: tabPrincipal === t ? "var(--primary)" : "var(--muted-foreground)",
                marginBottom: -2,
              }}>
                {t === "consolidado" ? "Consolidado" : "Análisis IA"}
              </button>
            ))}
          </div>

          {tabPrincipal === "consolidado" && (
            <VistaDirector secciones={secciones} anio={anio} />
          )}

          {tabPrincipal === "ia" && (
            <div>
              <Card titulo="Generar análisis narrativo con IA">
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div className="form-field" style={{ flex: 2, minWidth: 200 }}>
                    <label className="form-label">Sección</label>
                    <select className="form-input" value={seccionIA} onChange={e => setSeccionIA(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre || `${s.grado} ${s.letra}`}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Período</label>
                    <select className="form-input" value={bimestreIA} onChange={e => setBimestreIA(e.target.value)}>
                      <option value="">Anual (todos)</option>
                      <optgroup label="── Semestral ──">
                        <option value="1,2">Semestre 1 (B1+B2)</option>
                        <option value="3,4">Semestre 2 (B3+B4)</option>
                      </optgroup>
                      <optgroup label="── Bimestral ──">
                        {BIMESTRES.map(b => <option key={b} value={b}>Bimestre {b}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 2 }}>
                    <button className="btn btn-primary" disabled={generando || !seccionIA} onClick={generarIA} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {generando ? <><RefreshCw size={14} className="spin" /> Generando...</> : <><Sparkles size={14} /> Generar informe</>}
                    </button>
                    <button className="btn btn-secundario" disabled={generandoCierre || !seccionIA} onClick={generarCierre} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {generandoCierre ? <><RefreshCw size={14} className="spin" /> Generando...</> : <><Sparkles size={14} /> Cierre de bimestre</>}
                    </button>
                    <div style={{ borderLeft: "1px solid var(--border)", height: 28, margin: "0 2px" }} />
                    {(["xlsx", "pdf", "docx"] as const).map(fmt => {
                      const Icon = fmt === "xlsx" ? FileSpreadsheet : fmt === "pdf" ? File : FileText;
                      return (
                        <button key={fmt} className="btn btn-secundario" disabled={exportandoIA !== null || !seccionIA} onClick={() => descargarIA(fmt)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
                          {exportandoIA === fmt ? <RefreshCw size={13} className="spin" /> : <Icon size={13} />}
                          {fmt === "xlsx" ? "Excel" : fmt === "pdf" ? "PDF" : "Word"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {generando && (
                <div style={{ textAlign: "center", padding: 32, color: "var(--muted-foreground)" }}>
                  <RefreshCw size={24} className="spin" style={{ marginBottom: 8 }} />
                  <div>Analizando resultados y generando narrativa pedagógica...</div>
                </div>
              )}

              {informeIA && !generando && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ background: "var(--primary)", color: "var(--primary-foreground)", borderRadius: 12, padding: "14px 20px", marginBottom: 16 }}>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{informeIA.seccion}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                      {informeIA.bimestre === "todos" ? "Informe anual" : `Bimestre ${informeIA.bimestre}`} · {informeIA.total_estudiantes} estudiantes
                    </div>
                  </div>
                  {informeIA.areas.length > 0 && (
                    <Card titulo="Distribución por área">
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {informeIA.areas.map(a => (
                          <div key={a.area}>
                            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>{a.area}</div>
                            <BarrasNL dist={a.distribucion} total={informeIA.total_estudiantes} />
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                  {informeIA.narrativa ? (
                    <Card titulo="Análisis pedagógico (IA)">
                      <div style={{ borderLeft: "3px solid var(--primary)", paddingLeft: 16, marginBottom: 8 }}>
                        <NarrativaMarkdown texto={informeIA.narrativa} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 12 }}>Generado con IA. Revisa antes de compartir.</div>
                    </Card>
                  ) : (
                    <div style={{ background: "var(--muted)", borderRadius: 10, padding: 16, fontSize: 14, color: "var(--muted-foreground)" }}>
                      <Sparkles size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                      Para el análisis narrativo, configura una API de IA en <strong>Administración → Configurar IA</strong>.
                    </div>
                  )}
                </div>
              )}

              {cierreBimestre && (
                <div style={{ marginTop: 20 }}>
                <Card titulo="Cierre de bimestre (IA)">
                  <div style={{ borderLeft: "3px solid var(--azul-600)", paddingLeft: 16, marginBottom: 8 }}>
                    <NarrativaMarkdown texto={cierreBimestre} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 12 }}>Incluye comparación con bimestre anterior. Generado con IA.</div>
                </Card>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
