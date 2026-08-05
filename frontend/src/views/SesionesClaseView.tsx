import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../services/api";
import { AREAS_CNEB } from "../constants/curriculo";
import type { SesionClase, KPIsUsoAmbientes } from "../types/sesion";
import {
  listarSesiones,
  iniciarSesion,
  cerrarSesion,
  marcarQREnSesion,
  obtenerSesion,
  kpisUsoAmbientes,
} from "../services/sesiones";
import type { AmbienteReservable } from "../services/reservas";
import { listarAmbientesReservables } from "../services/reservas";
import { useAuth } from "../hooks/useAuth";
import { useInstitucion } from "../context/InstitucionContext";
import { useToast } from "../components/ui/Toast";
import Card from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { EmptyState, Cargando } from "../components/ui/Spinner";
import { Sparkles, ExternalLink, Printer, Clipboard, Save, Trash2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { fechaCorta } from "../utils/fechas";

const ROLES_DICTAN = ["docente", "auxiliar", "psicologa"];
const ROLES_KPI = ["director", "subdirector", "admin_tic"];

export default function SesionesClaseView() {
  const { usuario } = useAuth();
  const toast = useToast();
  const puedeDictar = usuario ? ROLES_DICTAN.includes(usuario.rol) : false;
  const veKPIs = usuario ? ROLES_KPI.includes(usuario.rol) : false;

  const [sesiones, setSesiones] = useState<SesionClase[]>([]);
  const [ambientes, setAmbientes] = useState<AmbienteReservable[]>([]);
  const [kpis, setKpis] = useState<KPIsUsoAmbientes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [sesionActiva, setSesionActiva] = useState<SesionClase | null>(null);
  const [nuevaAmbiente, setNuevaAmbiente] = useState<number | "">("");
  const [nuevaTema, setNuevaTema] = useState("");
  const [nuevaArea, setNuevaArea] = useState("");
  const [nuevaCompId, setNuevaCompId] = useState<number | null>(null);
  const [nuevaCapId, setNuevaCapId] = useState<number | null>(null);
  const [compsSesion, setCompsSesion] = useState<CompCNEB[]>([]);
  const [capsSesion, setCapsSesion] = useState<CapCNEB[]>([]);
  const [planIA, setPlanIA] = useState<string | null>(null); // texto IA a guardar en observaciones
  const formRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [s, a, k] = await Promise.all([
        listarSesiones(),
        puedeDictar ? listarAmbientesReservables() : Promise.resolve([] as AmbienteReservable[]),
        veKPIs ? kpisUsoAmbientes() : Promise.resolve(null),
      ]);
      setSesiones(s);
      setAmbientes(a);
      setKpis(k);
      const activa = s.find((x) => !x.hora_fin && x.docente === usuario?.id);
      if (activa) setSesionActiva(activa);
    } finally { setCargando(false); }
  }, [puedeDictar, veKPIs, usuario?.id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function iniciar() {
    if (!nuevaAmbiente) { toast.error("Elige un ambiente."); return; }
    setIniciando(true);
    try {
      const s = await iniciarSesion({
        ambiente: Number(nuevaAmbiente),
        tema: nuevaTema,
        area_curricular: nuevaArea || undefined,
        competencia_cneb: nuevaCompId || undefined,
        capacidad_cneb: nuevaCapId || undefined,
        observaciones: planIA || undefined,
      });
      toast.ok(`Sesión iniciada en ${s.ambiente_nombre}.${planIA ? " Plan IA guardado." : ""}`);
      setNuevaTema(""); setNuevaAmbiente(""); setNuevaArea("");
      setNuevaCompId(null); setNuevaCapId(null); setPlanIA(null);
      setSesionActiva(s);
      cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally { setIniciando(false); }
  }

  // Callback desde GeneradorSesionIA: pre-llena el form y hace scroll
  function recibirPlanIA(plan: string, area: string, aulaHorario: string) {
    setPlanIA(plan);
    setNuevaArea(area);
    // Intenta pre-seleccionar el ambiente que coincide con el aula del horario
    if (aulaHorario) {
      const match = ambientes.find(a =>
        a.nombre.toLowerCase().includes(aulaHorario.toLowerCase()) ||
        aulaHorario.toLowerCase().includes(a.nombre.toLowerCase())
      );
      if (match) setNuevaAmbiente(match.id);
    }
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  async function cerrar() {
    if (!sesionActiva) return;
    try {
      await cerrarSesion(sesionActiva.id);
      toast.ok("Sesión cerrada.");
      setSesionActiva(null);
      cargar();
    } catch { toast.error("Error."); }
  }

  return (
    <div>
      <h2 className="page-title">Sesiones de clase</h2>

      {/* Generador de sesiones de aprendizaje con IA */}
      {puedeDictar && <GeneradorSesionIA onUsarPlan={recibirPlanIA} />}

      {kpis && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Sesiones últimos 30 días</span>
            <span className="kpi-valor">{kpis.total_sesiones}</span>
          </div>
          {kpis.por_ambiente_top10.slice(0, 3).map((r) => (
            <div key={r.ambiente} className="kpi-card">
              <span className="kpi-label">{r.ambiente}</span>
              <span className="kpi-valor" style={{ fontSize: 22 }}>{r.sesiones}</span>
              <span className="kpi-sub">{r.tipo}</span>
            </div>
          ))}
        </div>
      )}

      {puedeDictar && !sesionActiva && (
        <div ref={formRef}>
        <Card titulo={planIA ? "Iniciar sesión con plan IA" : "Iniciar nueva sesión de clase"}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-field" style={{ minWidth: 220 }}>
              <label className="form-label">Ambiente *</label>
              <select className="form-input" value={nuevaAmbiente} onChange={(e) => setNuevaAmbiente(Number(e.target.value))}>
                <option value="">— Elige —</option>
                {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ minWidth: 180 }}>
              <label className="form-label">Área curricular</label>
              <select className="form-input" value={nuevaArea}
                onChange={(e) => {
                  const area = e.target.value;
                  setNuevaArea(area); setNuevaCompId(null); setNuevaCapId(null);
                  setCompsSesion([]); setCapsSesion([]);
                  if (!area) return;
                  api.get<{ results?: CompCNEB[] } | CompCNEB[]>(
                    `/curricula/competencias/?area_nombre=${encodeURIComponent(area)}&limit=20`
                  ).then(({ data }) => {
                    const c: CompCNEB[] = Array.isArray(data) ? data : (data as { results?: CompCNEB[] }).results ?? [];
                    setCompsSesion(c);
                  }).catch(() => {});
                }}>
                <option value="">— Sin especificar —</option>
                {AREAS_CNEB.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {compsSesion.length > 0 && (
              <div className="form-field" style={{ minWidth: 220 }}>
                <label className="form-label">Competencia</label>
                <select className="form-input" value={nuevaCompId ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value) || null;
                    setNuevaCompId(id); setNuevaCapId(null); setCapsSesion([]);
                    if (!id) return;
                    api.get<{ results?: CapCNEB[] } | CapCNEB[]>(
                      `/curricula/capacidades/?competencia=${id}&limit=20`
                    ).then(({ data }) => {
                      const c: CapCNEB[] = Array.isArray(data) ? data : (data as { results?: CapCNEB[] }).results ?? [];
                      setCapsSesion(c);
                    }).catch(() => {});
                  }}>
                  <option value="">— Sin especificar —</option>
                  {compsSesion.map(c => <option key={c.id} value={c.id}>C{c.numero}: {c.nombre.slice(0, 50)}</option>)}
                </select>
              </div>
            )}
            {capsSesion.length > 0 && (
              <div className="form-field" style={{ minWidth: 200 }}>
                <label className="form-label">Capacidad</label>
                <select className="form-input" value={nuevaCapId ?? ""}
                  onChange={(e) => setNuevaCapId(Number(e.target.value) || null)}>
                  <option value="">— Sin especificar —</option>
                  {capsSesion.map(c => <option key={c.id} value={c.id}>{c.nombre.slice(0, 50)}</option>)}
                </select>
              </div>
            )}
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Tema / actividad</label>
              <input className="form-input" placeholder="Ej: Práctica de titulación ácido-base" value={nuevaTema} onChange={(e) => setNuevaTema(e.target.value)} />
            </div>
            <button className="btn btn-primario" onClick={iniciar} disabled={iniciando || !nuevaAmbiente} style={{ padding: "9px 18px", width: "auto" }}>
              {iniciando ? "Iniciando..." : planIA ? "▶ Iniciar con plan IA" : "▶ Iniciar sesión"}
            </button>
            {planIA && (
              <button onClick={() => setPlanIA(null)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--borde)", background: "none", cursor: "pointer", fontSize: 12, color: "var(--muted-foreground)" }}>
                × Quitar plan
              </button>
            )}
          </div>
          {planIA && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, fontSize: 12, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} /> Plan IA listo — se guardará como observaciones de la sesión al iniciar.
            </div>
          )}
        </Card>
        </div>
      )}

      {sesionActiva && <SesionActivaPanel sesion={sesionActiva} onActualizar={cargar} onCerrar={cerrar} />}

      <Card titulo={`Historial (${sesiones.length})`}>
        {cargando ? <Cargando inline /> :
          sesiones.length === 0 ? <EmptyState icono="documento" titulo="Sin sesiones" descripcion="Cuando un docente inicie una sesión aparecerá aquí." /> :
            <div className="tabla-wrap">
              <table className="tabla-incidencias">
                <thead>
                  <tr>
                    <th>Ambiente</th><th>Docente</th><th>Fecha</th><th>Horario</th><th>Presentes</th><th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sesiones.map((s) => (
                    <tr key={s.id} style={{ cursor: "default" }}>
                      <td><strong>{s.ambiente_nombre}</strong></td>
                      <td style={{ fontSize: 12 }}>{s.docente_nombre}</td>
                      <td>{fechaCorta(s.fecha)}</td>
                      <td style={{ fontSize: 12 }}>
                        {s.hora_inicio.slice(0, 5)}{s.hora_fin ? ` – ${s.hora_fin.slice(0, 5)}` : " – …"}
                        {s.duracion_minutos && ` (${s.duracion_minutos}m)`}
                      </td>
                      <td>{s.total_presentes}</td>
                      <td>
                        <span className="badge" style={{
                          background: s.hora_fin ? "var(--slate-200)" : "var(--verde-50)",
                          color: s.hora_fin ? "var(--slate-700)" : "var(--verde-600)",
                        }}>
                          {s.hora_fin ? "cerrada" : "ACTIVA"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </Card>
    </div>
  );
}

// ── Panel de sesión activa con escáner QR ──────────────────────────────────
function SesionActivaPanel({ sesion, onActualizar, onCerrar }: {
  sesion: SesionClase; onActualizar: () => void; onCerrar: () => void;
}) {
  const toast = useToast();
  const [asistencias, setAsistencias] = useState(sesion.asistencias);
  const [escaneando, setEscaneando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!escaneando) return;
    const id = "qr-sesion-scanner";
    const scanner = new Html5Qrcode(id);
    let ultimo = { codigo: "", ts: 0 };

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 260 } },
      async (codigo) => {
        const ahora = Date.now();
        if (ultimo.codigo === codigo && ahora - ultimo.ts < 3000) return;
        ultimo = { codigo, ts: ahora };
        try {
          const r = await marcarQREnSesion(sesion.id, codigo);
          toast.ok(`✓ ${r.estudiante.nombre}`);
          const nueva = await obtenerSesion(sesion.id);
          setAsistencias(nueva.asistencias);
          onActualizar();
        } catch (e: unknown) {
          const err = e as { response?: { data?: { error?: string } } };
          toast.error(err.response?.data?.error ?? "Error");
        }
      },
      () => {}
    ).catch((e) => setError(`Cámara: ${e}`));

    return () => {
      scanner.stop().catch(() => {}).finally(() => scanner.clear());
    };
  }, [escaneando, sesion.id, toast, onActualizar]);

  return (
    <Card titulo={
      <span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--verde-600)", display: "inline-block" }} /> Sesión activa · {sesion.ambiente_nombre}</span>
        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--texto-mute)" }}>
          desde {sesion.hora_inicio.slice(0, 5)}
        </span>
      </span>
    }>
      {sesion.tema && <p style={{ fontSize: 13, color: "var(--texto-mute)", marginBottom: 12 }}>{sesion.tema}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="btn btn-ia btn-icono" onClick={() => setEscaneando(!escaneando)} style={{ padding: "8px 14px" }}>
          {escaneando
            ? <><Icon name="detener" /> Detener escáner</>
            : <><Icon name="camara" /> Escanear alumno</>}
        </button>
        <button className="btn btn-peligro btn-icono" onClick={onCerrar} style={{ padding: "8px 14px" }}>
          <Icon name="detener" /> Cerrar sesión
        </button>
      </div>

      {escaneando && (
        <div>
          <div id="qr-sesion-scanner" className="qr-camara" style={{ marginBottom: 8 }} />
          {error && <p className="form-error">{error}</p>}
          <p style={{ fontSize: 12, color: "var(--texto-mute)" }}>Apunta al QR del carnet del estudiante. Cada uno queda registrado con la hora de llegada.</p>
        </div>
      )}

      <h4 style={{ marginTop: 12, marginBottom: 8, fontSize: 12, textTransform: "uppercase", color: "var(--slate-700)" }}>
        Alumnos presentes ({asistencias.filter((a) => a.presente).length})
      </h4>
      {asistencias.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--texto-mute)" }}>Aún ninguno. Escanea los QRs a medida que llegan.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {asistencias.filter((a) => a.presente).map((a) => (
            <div key={a.id} style={{ padding: "6px 10px", background: "var(--verde-50)", borderRadius: 6, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
              <strong>{a.estudiante_nombre}</strong>
              <span style={{ fontSize: 11, color: "var(--texto-mute)" }}>
                {a.hora_llegada?.slice(0, 5) ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}


/* ═══════════════════════════════ GENERADOR SESIÓN IA ════════════════════ */

const GRADOS = ["Inicial 3 años", "Inicial 4 años", "Inicial 5 años",
  "1ro Primaria", "2do Primaria", "3ro Primaria", "4to Primaria", "5to Primaria", "6to Primaria",
  "1ro Secundaria", "2do Secundaria", "3ro Secundaria", "4to Secundaria", "5to Secundaria"];

function gradoLabel(nivel: string, grado: string): string {
  const n = nivel === "inicial" ? "Inicial" : nivel === "primaria" ? "Primaria" : "Secundaria";
  return nivel === "inicial" ? `Inicial ${grado}` : `${grado} ${n}`;
}

interface CompCNEB { id: number; numero: number; nombre: string }
interface CapCNEB  { id: number; nombre: string; orden: number }
interface HorarioItem { id: number; area: string; seccion_grado: string; seccion_nivel: string; seccion_nombre: string; dia_semana: string; hora_inicio: string; hora_fin: string; aula: string }

const DIA_KEY = ["dom","lun","mar","mie","jue","vie","sab"];

function claseActual(horarios: HorarioItem[]): HorarioItem | null {
  const ahora = new Date().toTimeString().slice(0, 5); // "HH:MM"
  const diaHoy = DIA_KEY[new Date().getDay()];
  const hoy = horarios.filter(h => h.dia_semana === diaHoy);
  // Clase en curso
  const activa = hoy.find(h => h.hora_inicio <= ahora && ahora < h.hora_fin);
  if (activa) return activa;
  // Próxima del día
  const proximas = hoy.filter(h => h.hora_inicio > ahora).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  return proximas[0] ?? null;
}

function nivelFromGrado(grado: string): "inicial" | "primaria" | "secundaria" {
  const g = (grado ?? "").toLowerCase();
  if (g.includes("inicial")) return "inicial";
  if (g.includes("secundaria")) return "secundaria";
  return "primaria";
}


function txtAHtml(txt: string) {
  if (!txt) return '<p style="color:#aaa;font-style:italic">(sin contenido)</p>';
  return txt.split("\n").map(line => {
    if (line.trim() === "") return "<br>";
    if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
    return `<p>${line}</p>`;
  }).join("");
}

function imprimirPlanEstructurado(campos: { titulo:string; desempeno:string; preparacion:string; proposito:string; inicio:string; desarrollo:string; cierre:string; materiales:string; evaluacion:string }, form: { area:string; grado:string; competencia:string; capacidad:string; duracion_minutos:string }, clase: HorarioItem | null, nombreInstitucion: string, autoImprimir = false) {
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const horario = clase ? `${clase.hora_inicio.slice(0,5)} – ${clase.hora_fin.slice(0,5)}` : `${form.duracion_minutos} min`;
  const dur = Number(form.duracion_minutos);
  const ti = Math.max(10, Math.round(dur * 0.18));
  const td = Math.max(20, Math.round(dur * 0.64));
  const tc = dur - ti - td;

  const seccion = (titulo: string, contenido: string, tiempo?: string) => `
    <div class="seccion">
      <div class="sec-titulo">${titulo}${tiempo ? ` <span class="sec-tiempo">(${tiempo} min)</span>` : ""}</div>
      <div class="sec-body" contenteditable="true">${txtAHtml(contenido)}</div>
    </div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Sesión — ${campos.titulo || form.area}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; margin: 1.8cm; color: #111; line-height: 1.5; }
  h1 { font-size: 13pt; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px; }
  .subtitulo { text-align: center; font-size: 10pt; color: #555; margin-bottom: 14px; }
  table.enc { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  table.enc td { border: 1px solid #888; padding: 4px 8px; font-size: 10pt; }
  table.enc td:first-child { font-weight: bold; width: 150px; background: #f0f0f0; }
  .seccion { margin-bottom: 12px; }
  .sec-titulo { font-size: 10.5pt; font-weight: bold; text-transform: uppercase; background: #e8e8e8; padding: 4px 8px; border-left: 4px solid #333; }
  .sec-tiempo { font-weight: normal; font-size: 9pt; color: #555; }
  .sec-body { padding: 6px 8px; border: 1px solid #ccc; border-top: none; min-height: 32px; }
  .sec-body p { margin: 2px 0; }
  .sec-body li { margin-left: 18px; margin-bottom: 1px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  [contenteditable] { outline: none; }
  .no-print { background: #fffbe6; border: 1px solid #f0c040; border-radius: 4px; padding: 8px 12px; font-size: 9pt; margin-bottom: 14px; }
  @media print { .no-print { display: none; } body { margin: 1.2cm; } }
</style></head><body>
<h1>Sesión de Aprendizaje</h1>
<div class="subtitulo">${nombreInstitucion || "Sistema TIC EduMWork"}</div>
<p class="no-print">✏️ Puedes editar cualquier campo antes de imprimir. Cuando esté listo: <strong>Ctrl+P</strong> → Guardar como PDF.</p>
<table class="enc">
  <tr><td>Área curricular</td><td contenteditable="true">${form.area}</td><td>Grado / Sección</td><td contenteditable="true">${form.grado}</td></tr>
  <tr><td>Título de la sesión</td><td colspan="3" contenteditable="true">${campos.titulo || "—"}</td></tr>
  <tr><td>Competencia</td><td colspan="3" contenteditable="true">${form.competencia}</td></tr>
  <tr><td>Capacidad</td><td contenteditable="true">${form.capacidad || "—"}</td><td>Duración</td><td contenteditable="true">${horario}</td></tr>
  <tr><td>Desempeño</td><td colspan="3" contenteditable="true">${campos.desempeno || "—"}</td></tr>
  <tr><td>Fecha</td><td contenteditable="true">${fecha}</td><td>Docente</td><td contenteditable="true"></td></tr>
</table>
${campos.preparacion ? seccion("¿Qué necesitamos hacer antes?", campos.preparacion) : ""}
${seccion("Propósito de aprendizaje", campos.proposito)}
<div class="grid2">
  ${seccion("Inicio", campos.inicio, String(ti))}
  ${seccion("Desarrollo", campos.desarrollo, String(td))}
</div>
${seccion("Cierre", campos.cierre, String(tc))}
<div class="grid2">
  ${seccion("Materiales y recursos", campos.materiales)}
  ${seccion("Evaluación", campos.evaluacion)}
</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); if (autoImprimir) setTimeout(() => w.print(), 600); }
}

type CamposSesion = {
  titulo: string; desempeno: string; preparacion: string; proposito: string;
  inicio: string; desarrollo: string; cierre: string;
  materiales: string; evaluacion: string;
};
const CAMPOS_VACIOS: CamposSesion = {
  titulo: "", desempeno: "", preparacion: "", proposito: "",
  inicio: "", desarrollo: "", cierre: "",
  materiales: "", evaluacion: "",
};

function GeneradorSesionIA({ onUsarPlan }: { onUsarPlan?: (plan: string, area: string, aula: string) => void }) {
  const { usuario } = useAuth();
  const toast = useToast();
  const institucion = useInstitucion();
  const [abierto, setAbierto] = useState(false);
  const [rellenando, setRellenando] = useState(false);
  const [mejorando, setMejorando] = useState<keyof CamposSesion | null>(null);
  const [guardadoTs, setGuardadoTs] = useState<number | null>(null);

  const LS_KEY = "sesion_borrador";
  function guardarBorrador(c: CamposSesion, f: typeof form) {
    localStorage.setItem(LS_KEY, JSON.stringify({ campos: c, form: f, ts: Date.now() }));
    setGuardadoTs(Date.now());
  }
  const [sugiriendoTemas, setSugiriendoTemas] = useState(false);
  const [temasIA, setTemasIA] = useState<string[]>([]);
  const [sinConfig, setSinConfig] = useState(false);
  const [campos, setCampos] = useState<CamposSesion>(CAMPOS_VACIOS);
  const [areasDocente, setAreasDocente] = useState<string[]>([]);
  const [gradosDocente, setGradosDocente] = useState<string[]>([]);
  const [claseDetectada, setClaseDetectada] = useState<HorarioItem | null>(null);
  const [form, setForm] = useState({
    area: "Matemática", grado: "1ro Secundaria",
    competencia: "", capacidad: "", tema: "", duracion_minutos: "90",
  });
  const [competenciasCNEB, setCompetenciasCNEB] = useState<CompCNEB[]>([]);
  const [capacidadesCNEB, setCapacidadesCNEB] = useState<CapCNEB[]>([]);
  const [cargandoComp, setCargandoComp] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));
  const setCampo = (k: keyof CamposSesion, v: string) => setCampos(p => ({ ...p, [k]: v }));
  const hayContenido = Object.values(campos).some(v => v.trim().length > 0);

  // Cargar borrador al abrir el panel por primera vez
  useEffect(() => {
    if (!abierto) return;
    const raw = localStorage.getItem("sesion_borrador");
    if (!raw) return;
    try {
      const { campos: c, form: f } = JSON.parse(raw);
      if (c) setCampos(c);
      if (f?.tema) setForm(p => ({ ...p, tema: f.tema }));
    } catch { /**/ }
  }, [abierto]);

  useEffect(() => {
    if (usuario?.rol !== "docente") return;
    api.get<HorarioItem[]>("/notas/horario/").then(({ data }) => {
      const areas = [...new Set(data.map((h) => h.area))];
      const grados = [...new Set(data.map((h) => gradoLabel(h.seccion_nivel, h.seccion_grado)))];
      setAreasDocente(areas);
      setGradosDocente(grados);
      const clase = claseActual(data);
      if (clase) {
        setClaseDetectada(clase);
        const [h1, m1] = clase.hora_inicio.split(":").map(Number);
        const [h2, m2] = clase.hora_fin.split(":").map(Number);
        const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
        setForm(p => ({
          ...p, area: clase.area,
          grado: gradoLabel(clase.seccion_nivel, clase.seccion_grado),
          duracion_minutos: mins > 0 ? String(mins) : p.duracion_minutos,
        }));
      } else {
        if (areas.length) setForm(p => ({ ...p, area: areas[0] }));
        if (grados.length) setForm(p => ({ ...p, grado: grados[0] }));
      }
    }).catch(() => {});
  }, [usuario?.rol]);

  useEffect(() => {
    if (!form.area || !form.grado) return;
    const nivel = nivelFromGrado(form.grado);
    setCargandoComp(true);
    api.get<{ results?: CompCNEB[] } | CompCNEB[]>(
      `/curricula/competencias/?area_nombre=${encodeURIComponent(form.area)}&nivel=${nivel}&limit=20`
    ).then(({ data }) => {
      const comps: CompCNEB[] = Array.isArray(data) ? data : (data as { results?: CompCNEB[] }).results ?? [];
      setCompetenciasCNEB(comps);
      setCapacidadesCNEB([]);
      if (comps.length > 0) setForm(p => ({ ...p, competencia: comps[0].nombre, capacidad: "" }));
      else setForm(p => ({ ...p, competencia: "", capacidad: "" }));
    }).catch(() => { setCompetenciasCNEB([]); })
    .finally(() => setCargandoComp(false));
  }, [form.area, form.grado]);

  const compSelObj = competenciasCNEB.find(c => c.nombre === form.competencia);
  useEffect(() => {
    if (!compSelObj) { setCapacidadesCNEB([]); return; }
    api.get<{ results?: CapCNEB[] } | CapCNEB[]>(
      `/curricula/capacidades/?competencia=${compSelObj.id}&limit=20`
    ).then(({ data }) => {
      const caps: CapCNEB[] = Array.isArray(data) ? data : (data as { results?: CapCNEB[] }).results ?? [];
      setCapacidadesCNEB(caps);
      if (caps.length > 0) setForm(p => ({ ...p, capacidad: caps[0].nombre }));
    }).catch(() => setCapacidadesCNEB([]));
  }, [compSelObj?.id]);

  async function rellenarConIA() {
    if (!form.competencia || !form.tema) { toast.error("Completa Competencia y Tema antes de usar la IA."); return; }
    setRellenando(true); setSinConfig(false);
    try {
      const { data } = await api.post<{ campos?: CamposSesion; sin_config?: boolean; error?: string }>(
        "/ia/sesion/", { ...form, duracion_minutos: Number(form.duracion_minutos) }
      );
      if (data.sin_config) { setSinConfig(true); }
      else if (data.campos) { setCampos(data.campos); }
      else { toast.error(data.error ?? "Error al generar."); }
    } catch { toast.error("Error de conexión."); }
    finally { setRellenando(false); }
  }

  const LABELS_CAMPO: Record<keyof CamposSesion, string> = {
    titulo: "título de la sesión", desempeno: "desempeño CNEB",
    preparacion: "preparación previa a la sesión (materiales, espacios, instrumentos)",
    proposito: "propósito de aprendizaje",
    inicio: "actividades de inicio", desarrollo: "actividades de desarrollo", cierre: "actividades de cierre",
    materiales: "materiales y recursos", evaluacion: "criterios de evaluación",
  };

  async function mejorarCampo(campo: keyof CamposSesion) {
    setMejorando(campo);
    const actual = campos[campo];
    const prompt = actual.trim()
      ? `Mejora y completa el siguiente texto para el campo "${LABELS_CAMPO[campo]}" de una sesión de ${form.area} para ${form.grado}, competencia "${form.competencia}"${form.tema ? `, tema "${form.tema}"` : ""}. Mantén lo que ya está escrito y expándelo con más detalle pedagógico. Responde SOLO con el texto mejorado, sin encabezados ni explicaciones:\n\n${actual}`
      : `Escribe el contenido para el campo "${LABELS_CAMPO[campo]}" de una sesión de ${form.area} para ${form.grado}, competencia "${form.competencia}"${form.tema ? `, tema "${form.tema}"` : ""}. Sé concreto y práctico, estilo CNEB peruano. Responde SOLO con el contenido, sin encabezados.`;
    try {
      const { data } = await api.post<{ temas?: string[]; sin_config?: boolean; resultado?: string }>(
        "/ia/completar-campo/", { prompt, campo }
      );
      if (data.sin_config) { setSinConfig(true); }
      else if (data.resultado) { setCampo(campo, data.resultado.trim()); }
    } catch { toast.error("Error al completar campo."); }
    finally { setMejorando(null); }
  }

  function planComoTexto() {
    const t_inicio = Math.max(10, Math.round(Number(form.duracion_minutos) * 0.18));
    const t_des = Math.max(20, Math.round(Number(form.duracion_minutos) * 0.64));
    const t_cierre = Number(form.duracion_minutos) - t_inicio - t_des;
    return [
      `## ${campos.titulo || form.tema}`,
      `**Área:** ${form.area}  |  **Grado:** ${form.grado}  |  **Duración:** ${form.duracion_minutos} min`,
      `**Competencia:** ${form.competencia}`,
      campos.desempeno && `**Desempeño:** ${campos.desempeno}`,
      campos.preparacion && `\n### ¿Qué necesitamos hacer antes?\n${campos.preparacion}`,
      `\n### Propósito de aprendizaje\n${campos.proposito}`,
      `\n### Inicio (${t_inicio} min)\n${campos.inicio}`,
      `\n### Desarrollo (${t_des} min)\n${campos.desarrollo}`,
      `\n### Cierre (${t_cierre} min)\n${campos.cierre}`,
      campos.materiales && `\n### Materiales\n${campos.materiales}`,
      campos.evaluacion && `\n### Evaluación\n${campos.evaluacion}`,
    ].filter(Boolean).join("\n");
  }

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" };
  const taStyle: React.CSSProperties = { width: "100%", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };

  return (
    <div style={{ marginBottom: 16, borderRadius: 14, overflow: "hidden", border: "1px solid #7C3AED30" }}>
      <button onClick={() => setAbierto(v => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", border: "none", cursor: "pointer", textAlign: "left", background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #A855F7 100%)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={18} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "white" }}>Sesión de aprendizaje (IA)</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
            {claseDetectada
              ? <span style={{ background: "rgba(255,255,255,0.18)", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                  📚 {claseDetectada.area} · {claseDetectada.seccion_nombre} · {claseDetectada.hora_inicio.slice(0,5)}–{claseDetectada.hora_fin.slice(0,5)} · {form.duracion_minutos}min
                </span>
              : "Rellena la plantilla manualmente o deja que la IA lo haga por ti"}
          </div>
        </div>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }}>{abierto ? "▲" : "▼"}</span>
      </button>

      <div style={{ padding: abierto ? "20px" : 0, maxHeight: abierto ? 4000 : 0, overflow: "hidden", transition: "max-height .35s, padding .3s", background: "var(--fondo)" }}>
        {abierto && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {sinConfig && (
              <div style={{ background: "var(--amarillo-50)", border: "1px solid var(--amarillo-300)", borderRadius: 10, padding: 14, fontSize: 13 }}>
                <strong>Sin IA configurada.</strong> Configura tu API en{" "}
                <Link to="/mi-ia" style={{ color: "var(--azul-600)", fontWeight: 600 }}>Mi API de IA <ExternalLink size={11} /></Link>
              </div>
            )}

            {/* Fila 1: selectores */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Área</label>
                <select className="form-input" value={form.area} onChange={e => set("area", e.target.value)}>
                  {(areasDocente.length ? areasDocente : AREAS_CNEB).map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Grado</label>
                <select className="form-input" value={form.grado} onChange={e => set("grado", e.target.value)}>
                  {(gradosDocente.length ? gradosDocente : GRADOS).map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Duración</label>
                {claseDetectada
                  ? <div className="form-input" style={{ background: "var(--muted)", color: "var(--muted-foreground)", cursor: "default", display: "flex", alignItems: "center", gap: 6 }}>
                      {form.duracion_minutos} min
                      <span style={{ fontSize: 10 }}>(del horario)</span>
                    </div>
                  : <select className="form-input" value={form.duracion_minutos} onChange={e => set("duracion_minutos", e.target.value)}>
                      {["45", "60", "90", "120"].map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                }
              </div>
              <button type="button" disabled={!form.competencia || !form.tema || rellenando}
                onClick={rellenarConIA}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#4F46E5", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: (!form.competencia || !form.tema || rellenando) ? 0.6 : 1, whiteSpace: "nowrap" }}>
                <Sparkles size={13} />
                {rellenando ? "Rellenando…" : "Rellenar con IA"}
              </button>
            </div>

            {/* Fila 2: competencia + capacidad */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  Competencia *
                  {cargandoComp && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 6, color: "var(--muted-foreground)" }}>cargando…</span>}
                </label>
                {competenciasCNEB.length > 0
                  ? <select className="form-input" value={form.competencia} onChange={e => set("competencia", e.target.value)}>
                      {competenciasCNEB.map(c => <option key={c.id} value={c.nombre}>C{c.numero}: {c.nombre}</option>)}
                    </select>
                  : <input className="form-input" value={form.competencia} onChange={e => set("competencia", e.target.value)} placeholder="Escribe la competencia" />
                }
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Capacidad <span style={{ fontWeight: 400 }}>(opcional)</span></label>
                {capacidadesCNEB.length > 0
                  ? <select className="form-input" value={form.capacidad} onChange={e => set("capacidad", e.target.value)}>
                      <option value="">— Sin especificar —</option>
                      {capacidadesCNEB.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                  : <input className="form-input" value={form.capacidad} onChange={e => set("capacidad", e.target.value)} placeholder="Capacidad del CNEB" />
                }
              </div>
            </div>

            {/* Tema con sugerencia IA */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Tema / Título *</span>
                <button type="button" disabled={!form.competencia || sugiriendoTemas || mejorando === "titulo"}
                  onClick={async () => {
                    if (form.tema.trim()) { mejorarCampo("titulo"); return; }
                    setSugiriendoTemas(true); setTemasIA([]);
                    try {
                      const { data } = await api.post("/ia/sugerir-temas/", { area: form.area, grado: form.grado, competencia: form.competencia, capacidad: form.capacidad });
                      if (data.temas?.length) setTemasIA(data.temas);
                    } catch { /**/ } finally { setSugiriendoTemas(false); }
                  }}
                  style={{ fontSize: 11, padding: "2px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: !form.competencia || sugiriendoTemas ? 0.5 : 1 }}>
                  <Sparkles size={11} />{sugiriendoTemas || mejorando === "titulo" ? "…" : form.tema.trim() ? "Mejorar tema" : "Sugerir tema"}
                </button>
              </label>
              <input className="form-input" value={form.tema} onChange={e => { set("tema", e.target.value); setTemasIA([]); setCampo("titulo", e.target.value); }} placeholder="Escribe el tema o usa 'Sugerir tema'" />
              {temasIA.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {temasIA.map((t, i) => (
                    <button key={i} type="button" onClick={() => { set("tema", t); setCampo("titulo", t); setTemasIA([]); }}
                      style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", cursor: "pointer" }}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Plantilla editable */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>PLANTILLA DE SESIÓN</span>
                  {guardadoTs && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>✓ borrador guardado</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {onUsarPlan && hayContenido && (
                    <button type="button" onClick={() => { onUsarPlan(planComoTexto(), form.area, claseDetectada?.aula ?? ""); setAbierto(false); }}
                      style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "none", background: "#4F46E5", color: "white", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Sparkles size={11} /> Usar en sesión
                    </button>
                  )}
                  <button type="button" onClick={() => imprimirPlanEstructurado(campos, form, claseDetectada, institucion.nombre)}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Printer size={12} /> Ver PDF
                  </button>
                  <button type="button" onClick={() => imprimirPlanEstructurado(campos, form, claseDetectada, institucion.nombre, true)}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Download size={12} /> Descargar
                  </button>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(planComoTexto()); toast.ok("Copiado."); }}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Clipboard size={12} /> Copiar
                  </button>
                  <button type="button" onClick={() => guardarBorrador(campos, form)}
                    style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Save size={12} /> Borrador
                  </button>
                  {hayContenido && <button type="button" onClick={() => { setCampos(CAMPOS_VACIOS); localStorage.removeItem("sesion_borrador"); setGuardadoTs(null); }}
                    style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Trash2 size={12} /> Limpiar
                  </button>}
                </div>
              </div>

              {(() => {
                const btnIA = (campo: keyof CamposSesion) => (
                  <button type="button" disabled={!!mejorando || rellenando} onClick={() => mejorarCampo(campo)}
                    title={campos[campo].trim() ? "Mejorar con IA" : "Completar con IA"}
                    style={{ padding: "1px 7px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--card)", color: "var(--muted-foreground)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, opacity: mejorando === campo ? 0.7 : 1 }}>
                    <Sparkles size={9} />{mejorando === campo ? "…" : campos[campo].trim() ? "Mejorar" : "Completar"}
                  </button>
                );
                const lbl = (texto: string, campo: keyof CamposSesion) => (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={labelStyle as React.CSSProperties}>{texto}</span>
                    {btnIA(campo)}
                  </div>
                );
                const dur = Number(form.duracion_minutos);
                const ti = Math.max(10, Math.round(dur * 0.18));
                const td = Math.max(20, Math.round(dur * 0.64));
                const tc = dur - ti - td;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ gridColumn: "span 2" }}>
                      {lbl("Título de la sesión", "titulo")}
                      <input style={{ ...taStyle, padding: "8px 10px" }} value={campos.titulo} onChange={e => setCampo("titulo", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      {lbl("Desempeño (CNEB)", "desempeno")}
                      <textarea style={{ ...taStyle, minHeight: 56 }} value={campos.desempeno} onChange={e => setCampo("desempeno", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      {lbl("¿Qué necesitamos hacer antes de la sesión?", "preparacion")}
                      <textarea style={{ ...taStyle, minHeight: 72 }} value={campos.preparacion} onChange={e => setCampo("preparacion", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      {lbl("Propósito de aprendizaje", "proposito")}
                      <textarea style={{ ...taStyle, minHeight: 72 }} value={campos.proposito} onChange={e => setCampo("proposito", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div>
                      {lbl(`Inicio (~${ti} min)`, "inicio")}
                      <textarea style={{ ...taStyle, minHeight: 140 }} value={campos.inicio} onChange={e => setCampo("inicio", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div>
                      {lbl(`Desarrollo (~${td} min)`, "desarrollo")}
                      <textarea style={{ ...taStyle, minHeight: 140 }} value={campos.desarrollo} onChange={e => setCampo("desarrollo", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div>
                      {lbl(`Cierre (~${tc} min)`, "cierre")}
                      <textarea style={{ ...taStyle, minHeight: 100 }} value={campos.cierre} onChange={e => setCampo("cierre", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div>
                      {lbl("Evaluación", "evaluacion")}
                      <textarea style={{ ...taStyle, minHeight: 100 }} value={campos.evaluacion} onChange={e => setCampo("evaluacion", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      {lbl("Materiales y recursos", "materiales")}
                      <textarea style={{ ...taStyle, minHeight: 56 }} value={campos.materiales} onChange={e => setCampo("materiales", e.target.value)} placeholder={rellenando ? "Escribiendo…" : ""} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
