/**
 * Modal 3 pasos para trabajar con el Excel oficial de SIAGIE:
 *   1. Subir Excel oficial     → backend detecta estructura (cache/IA/heurística)
 *   2. Preview (dry-run)       → cuántas filas se rellenarán, DNIs sin notas
 *   3. Descargar el mismo Excel relleno para cargarlo en SIAGIE
 *
 * Extras: editor manual de mapeo por hoja + botón "re-analizar" si es incorrecto.
 */
import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Loader2,
  Download, X, Sparkles, Cpu, Database, Edit3, RotateCw } from "lucide-react";
import api from "../../services/api";
import { useToast } from "../ui/Toast";

interface Props {
  onCerrar: () => void;
  secciones: { id: number; nombre: string }[];
  area?: string;
  numCompetencias?: number;
  competencias?: { numero: number; nombre: string }[];
}

type Paso = "subir" | "analizando" | "resultado" | "preview" | "rellenando" | "editar-mapeo";

interface CompetenciaSiagie {
  codigo: string;
  nombre: string;
  competencia_default: number;
  campo_nl: string;
  campo_conclusion: string;
}

interface HojaAnalisis {
  hoja: string;
  hash: string;
  nivel: string;
  tiene_conclusiones: boolean;
  fila_datos: number;
  metodo: "cache" | "ia" | "heuristica" | "manual";
  muestra_header: string;
  leyenda: Record<string, string>;
  competencias_detectadas: CompetenciaSiagie[];
  columnas_detectadas: Record<string, string>;
  n_columnas_mapeadas: number;
  error?: string;
}

interface AnalisisResp { ok: boolean; n_hojas: number; hojas: HojaAnalisis[] }

interface PreviewResp {
  ok: boolean;
  total_filas: number;
  se_rellenaran: number;
  sin_notas: number;
  dnis_sin_notas: string[];
  notas_disponibles: number;
  hojas_procesadas: string[];
}

const METODO_INFO = {
  cache:      { icon: Database, color: "#10B981", label: "Formato conocido (sin costo)" },
  ia:         { icon: Sparkles, color: "#8B5CF6", label: "Analizado con IA" },
  heuristica: { icon: Cpu,      color: "#F59E0B", label: "Heurística (sin IA)" },
  manual:     { icon: Edit3,    color: "#3B82F6", label: "Corregido manualmente" },
};

// Campos válidos que el usuario puede asignar a columnas
const CAMPOS_VALIDOS = [
  "ignorar", "orden", "codigo", "dni", "apellidos", "nombres", "sexo",
  "nota_nl_1", "nota_nl_2", "nota_nl_3", "nota_nl_4",
  "conclusion_1", "conclusion_2", "conclusion_3", "conclusion_4",
];

export default function SiagieRellenarModal({ onCerrar, secciones, area = "", numCompetencias = 4, competencias = [] }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [paso, setPaso] = useState<Paso>("subir");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisResp | null>(null);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [bimestre, setBimestre] = useState("1");
  const [seccionId, setSeccionId] = useState(secciones[0] ? String(secciones[0].id) : "");
  const [hojaEditando, setHojaEditando] = useState<HojaAnalisis | null>(null);
  const [mapeoEdit, setMapeoEdit] = useState<Record<string, string>>({});
  const [hojasSeleccionadas, setHojasSeleccionadas] = useState<Set<string>>(new Set());
  const [competenciasMap, setCompetenciasMap] = useState<Record<string, Record<string, string>>>({});
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);

  function inicializarSeleccion(data: AnalisisResp) {
    const hojasOk = data.hojas.filter(h => !h.error).map(h => h.hoja);
    setHojasSeleccionadas(new Set(hojasOk.length === 1 ? hojasOk : []));
    const mapa: Record<string, Record<string, string>> = {};
    data.hojas.forEach(h => {
      mapa[h.hoja] = {};
      h.competencias_detectadas?.forEach(c => {
        const destino = Math.min(c.competencia_default || 1, Math.max(numCompetencias, 1));
        mapa[h.hoja][c.codigo] = String(destino);
      });
    });
    setCompetenciasMap(mapa);
  }

  function toggleHoja(hoja: string) {
    const next = new Set(hojasSeleccionadas);
    if (next.has(hoja)) next.delete(hoja);
    else next.add(hoja);
    setHojasSeleccionadas(next);
  }

  function setCompetenciaDestino(hoja: string, codigo: string, destino: string) {
    setCompetenciasMap({
      ...competenciasMap,
      [hoja]: { ...(competenciasMap[hoja] ?? {}), [codigo]: destino },
    });
  }

  async function handleArchivo(file: File) {
    setArchivo(file);
    setPaso("analizando");
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const { data } = await api.post<AnalisisResp>("/notas/siagie/analizar/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAnalisis(data);
      inicializarSeleccion(data);
      setPaso("resultado");
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      if (err.response?.status === 429) {
        toast.error(err.response.data?.error || "Límite diario de IA superado.");
      } else {
        toast.error(err.response?.data?.error ?? "Error al analizar el archivo.");
      }
      setPaso("subir");
    }
  }

  async function handlePreview() {
    if (!archivo) return;
    setPaso("preview");
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("bimestre", bimestre);
      if (seccionId) fd.append("seccion_id", seccionId);
      if (area) fd.append("area", area);
      fd.append("hojas", JSON.stringify([...hojasSeleccionadas]));
      fd.append("competencias", JSON.stringify(competenciasMap));
      const { data } = await api.post<PreviewResp>("/notas/siagie/preview/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Error en preview.";
      toast.error(msg);
      setPaso("resultado");
    }
  }

  async function handleRellenar() {
    if (!archivo) return;
    setPaso("rellenando");
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("bimestre", bimestre);
      if (seccionId) fd.append("seccion_id", seccionId);
      if (area) fd.append("area", area);
      fd.append("hojas", JSON.stringify([...hojasSeleccionadas]));
      fd.append("competencias", JSON.stringify(competenciasMap));
      const resp = await api.post("/notas/siagie/rellenar/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        responseType: "blob",
      });
      const nRellenadas = resp.headers["x-filas-rellenadas"] || "?";
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.ok(`Excel descargado. ${nRellenadas} filas rellenadas. Listo para subir a SIAGIE.`);
      onCerrar();
    } catch {
      toast.error("Error al rellenar el template.");
      setPaso("preview");
    }
  }

  async function handleReAnalizar(hoja: HojaAnalisis) {
    if (!archivo) return;
    try {
      await api.delete(`/notas/siagie/mapeos/${hoja.hash}/`);
      toast.ok("Mapeo borrado. Re-analizando...");
      await handleArchivo(archivo);
    } catch {
      toast.error("No se pudo re-analizar.");
    }
  }

  function abrirEditor(hoja: HojaAnalisis) {
    setHojaEditando(hoja);
    setMapeoEdit({ ...hoja.columnas_detectadas });
    setPaso("editar-mapeo");
  }

  async function guardarMapeoEditado() {
    if (!hojaEditando) return;
    try {
      await api.patch(`/notas/siagie/mapeos/${hojaEditando.hash}/`, { columnas: mapeoEdit });
      toast.ok("Mapeo actualizado.");
      // Re-cargar análisis desde caché con el nuevo mapeo
      if (archivo) await handleArchivo(archivo);
    } catch {
      toast.error("No se pudo guardar el mapeo.");
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "var(--background)", borderRadius: 12, width: "100%", maxWidth: 620,
        maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "var(--background)", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileSpreadsheet size={20} color="#10B981" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Preparar Excel SIAGIE</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                EduMWork lee el archivo oficial, revisas coincidencias y descargas listo
              </div>
            </div>
          </div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>

          {/* ── PASO SUBIR ── */}
          {paso === "subir" && (
            <>
              <div onClick={() => inputRef.current?.click()}
                style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: "32px 20px",
                  textAlign: "center", cursor: "pointer" }}>
                <Upload size={32} style={{ color: "var(--muted-foreground)", margin: "0 auto 10px" }} />
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Sube el Excel oficial descargado de SIAGIE</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  SIAGIE → Evaluación → Registro de calificaciones → Por Excel → Generar Excel
                  </div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                  onChange={e => e.target.files?.[0] && handleArchivo(e.target.files[0])} />
              </div>
              <div style={{ marginTop: 12, padding: 12, background: "var(--muted)", borderRadius: 8, fontSize: 11, color: "var(--muted-foreground)" }}>
                No cambies el nombre del archivo. EduMWork no entra a SIAGIE: tú descargas desde SIAGIE, aquí se rellena, y luego tú lo subes manualmente.
                {area && <><br />Área actual en EduMWork: <strong>{area}</strong></>}
              </div>
            </>
          )}

          {/* ── PASO ANALIZANDO ── */}
          {paso === "analizando" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "var(--primary)" }} />
              <div style={{ fontWeight: 600 }}>Analizando estructura...</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                Detectando hojas, estudiantes, columnas NL y leyenda de competencias
              </div>
            </div>
          )}

          {/* ── PASO RESULTADO ANÁLISIS ── */}
          {paso === "resultado" && analisis && (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5 }}>
                <strong>{analisis.n_hojas}</strong> {analisis.n_hojas === 1 ? "hoja válida detectada" : "hojas válidas detectadas"}.
                {analisis.n_hojas > 1 && " Elige solo la hoja que corresponde al área que estás preparando."}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {analisis.hojas.map((h, i) => {
                  const M = METODO_INFO[h.metodo] || METODO_INFO.heuristica;
                  const seleccionada = hojasSeleccionadas.has(h.hoja);
                  return (
                    <div key={i} style={{ background: seleccionada ? "var(--info-bg-subtle)" : "var(--muted)", border: seleccionada ? "1px solid var(--info-border-subtle)" : "1px solid transparent", borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                        <label style={{ display: "flex", gap: 8, alignItems: "start", cursor: "pointer" }}>
                          <input type="checkbox" checked={seleccionada} onChange={() => toggleHoja(h.hoja)} style={{ marginTop: 2 }} />
                          <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{h.hoja}</div>
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                            Nivel: <strong style={{ textTransform: "capitalize" }}>{h.nivel || "?"}</strong> ·
                            {" "}{h.n_columnas_mapeadas} columnas mapeadas ·
                            {" "}fila datos: {h.fila_datos}
                          </div>
                          </div>
                        </label>
                        <div style={{ display: mostrarAvanzado ? "flex" : "none", gap: 4 }}>
                          <button onClick={() => abrirEditor(h)} title="Editar mapeo manualmente"
                            style={{ padding: 5, borderRadius: 4, border: "1px solid var(--border)", background: "var(--background)", cursor: "pointer" }}>
                            <Edit3 size={12} />
                          </button>
                          <button onClick={() => handleReAnalizar(h)} title="Borrar cache y re-analizar"
                            style={{ padding: 5, borderRadius: 4, border: "1px solid var(--border)", background: "var(--background)", cursor: "pointer" }}>
                            <RotateCw size={12} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: M.color }}>
                        <M.icon size={12} /> {M.label}
                      </div>
                      {h.competencias_detectadas?.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                          {h.competencias_detectadas.map(c => (
                            <div key={c.codigo} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 150px", gap: 8, alignItems: "center", fontSize: 12 }}>
                              <div>
                                <strong>{c.codigo}</strong>{" "}{c.nombre || "Competencia detectada sin texto en leyenda"}
                                <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                                  {c.campo_conclusion ? "NL + conclusión" : "Solo NL"}
                                </div>
                              </div>
                              <select value={competenciasMap[h.hoja]?.[c.codigo] ?? String(c.competencia_default)}
                                onChange={e => setCompetenciaDestino(h.hoja, c.codigo, e.target.value)}
                                disabled={!seleccionada}
                                style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 11 }}>
                                {Array.from({ length: Math.max(numCompetencias, h.competencias_detectadas.length, 1) }).map((_, idx) => {
                                  const n = idx + 1;
                                  const nombre = competencias.find(cn => cn.numero === n)?.nombre;
                                  return <option key={n} value={String(n)}>EduMWork C{n}{nombre ? ` · ${nombre.slice(0, 32)}` : ""}</option>;
                                })}
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                      {h.n_columnas_mapeadas < 3 && (
                        <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "#92400E" }}>
                          <AlertCircle size={12} /> Pocas columnas mapeadas — considera editar manualmente
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button onClick={() => setMostrarAvanzado(!mostrarAvanzado)}
                style={{ marginBottom: 12, background: "none", border: "none", color: "var(--muted-foreground)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
                {mostrarAvanzado ? "Ocultar opciones avanzadas" : "Mostrar opciones avanzadas"}
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Bimestre</span>
                  <select value={bimestre} onChange={e => setBimestre(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13 }}>
                    {["1","2","3","4"].map(b => <option key={b} value={b}>Bimestre {b}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Sección</span>
                  <select value={seccionId} onChange={e => setSeccionId(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13 }}>
                    <option value="">Todas</option>
                    {secciones.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setPaso("subir"); setArchivo(null); setAnalisis(null); }}
                  style={{ padding: "9px 16px", borderRadius: 7, border: "1px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer" }}>
                  Cambiar archivo
                </button>
                <button onClick={handlePreview}
                  disabled={hojasSeleccionadas.size === 0}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "9px 16px", borderRadius: 7, border: "none",
                    background: hojasSeleccionadas.size === 0 ? "var(--muted)" : "var(--primary)",
                    color: hojasSeleccionadas.size === 0 ? "var(--muted-foreground)" : "white", fontWeight: 600, fontSize: 13, cursor: hojasSeleccionadas.size === 0 ? "not-allowed" : "pointer" }}>
                  Ver preview
                </button>
              </div>
            </>
          )}

          {/* ── PASO PREVIEW (dry-run) ── */}
          {paso === "preview" && preview && (
            <>
              <div style={{ background: "var(--muted)", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{preview.total_filas}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Estudiantes en template</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#10B981" }}>{preview.se_rellenaran}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Se rellenarán</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#F59E0B" }}>{preview.sin_notas}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Sin notas</div>
                  </div>
                </div>
              </div>

              {preview.dnis_sin_notas.length > 0 && (
                <div style={{ marginBottom: 14, padding: 12, background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 6 }}>
                    Estudiantes/códigos en el Excel sin notas en EduMWork:
                  </div>
                  <div style={{ fontSize: 11, color: "#92400E", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {preview.dnis_sin_notas.join(", ")}
                    {preview.sin_notas > preview.dnis_sin_notas.length && ` … y ${preview.sin_notas - preview.dnis_sin_notas.length} más`}
                  </div>
                </div>
              )}

              {preview.se_rellenaran === 0 && (
                <div style={{ marginBottom: 14, padding: 12, background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 12, color: "#991B1B" }}>
                  Ninguna fila se rellenará. Verifica que las notas del bimestre {bimestre} estén cargadas y que la sección coincida.
                </div>
              )}

              {preview.hojas_procesadas?.length > 0 && (
                <div style={{ marginBottom: 14, fontSize: 11, color: "var(--muted-foreground)" }}>
                  Hojas que se prepararán: <strong>{preview.hojas_procesadas.join(", ")}</strong>
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPaso("resultado")}
                  style={{ padding: "9px 16px", borderRadius: 7, border: "1px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer" }}>
                  Atrás
                </button>
                <button onClick={handleRellenar} disabled={preview.se_rellenaran === 0}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "9px 16px", borderRadius: 7, border: "none",
                    background: preview.se_rellenaran === 0 ? "var(--muted)" : "#10B981",
                    color: preview.se_rellenaran === 0 ? "var(--muted-foreground)" : "white",
                    fontWeight: 600, fontSize: 13, cursor: preview.se_rellenaran === 0 ? "not-allowed" : "pointer" }}>
                  <Download size={15} /> Confirmar y descargar
                </button>
              </div>
            </>
          )}

          {/* ── PASO RELLENANDO ── */}
          {paso === "rellenando" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "#10B981" }} />
              <div style={{ fontWeight: 600 }}>Rellenando template...</div>
            </div>
          )}

          {/* ── PASO EDITOR DE MAPEO ── */}
          {paso === "editar-mapeo" && hojaEditando && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Editar mapeo — hoja "{hojaEditando.hoja}"</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                  Asigná cada columna al campo correcto del sistema. Los cambios se guardan y se aplicarán a próximos uploads con este mismo formato.
                </div>
              </div>

              <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8, marginBottom: 12 }}>
                <table style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "4px 6px" }}>Col #</th>
                      <th style={{ textAlign: "left", padding: "4px 6px" }}>Encabezado</th>
                      <th style={{ textAlign: "left", padding: "4px 6px" }}>Campo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hojaEditando.muestra_header.split(" | ").map((header, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "4px 6px", color: "var(--muted-foreground)" }}>{idx}</td>
                        <td style={{ padding: "4px 6px" }}>{header || <em style={{ opacity: 0.5 }}>(vacío)</em>}</td>
                        <td style={{ padding: "4px 6px" }}>
                          <select value={mapeoEdit[String(idx)] || "ignorar"}
                            onChange={e => setMapeoEdit({ ...mapeoEdit, [String(idx)]: e.target.value })}
                            style={{ width: "100%", padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--background)" }}>
                            {CAMPOS_VALIDOS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPaso("resultado")}
                  style={{ padding: "9px 16px", borderRadius: 7, border: "1px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={guardarMapeoEditado}
                  style={{ flex: 1, padding: "9px 16px", borderRadius: 7, border: "none",
                    background: "var(--primary)", color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  Guardar mapeo
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
