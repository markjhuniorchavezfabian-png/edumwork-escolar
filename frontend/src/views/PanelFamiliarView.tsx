import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck, Clock, X, Users, TrendingUp, FileText, AlertCircle,
  Download, Paperclip, Loader2, ArrowRight, School, BookOpen,
  ShieldAlert, ClipboardCheck, type LucideIcon,
} from "lucide-react";
import TextoExpandible from "../components/ui/TextoExpandible";
import api from "../services/api";
import { useToast } from "../components/ui/Toast";
import { useInstitucion } from "../context/InstitucionContext";
import { cn } from "../lib/utils";

/* ═════════════════════════════════════════════════════════════════ TIPOS ════ */
interface HijoResumen {
  estudiante_id: number;
  nombre: string;
  grado: string;
  seccion: string;
  total_registros: number;
  porcentaje_asistencia: number;
  por_estado: Record<string, number>;
  ultimos_10: Array<{
    id: number; fecha: string; estado: string;
    hora_llegada: string | null; justificacion: string;
  }>;
}

interface Justificacion {
  id: number; estudiante: number; estudiante_nombre: string;
  fecha_falta: string; motivo: string; motivo_label: string;
  descripcion: string; constancia: string | null;
  estado: string; estado_label: string; razon_rechazo: string; creado_en: string;
}

interface Nota {
  id: number; estudiante: number; area: string;
  bimestre: string; bimestre_label: string;
  calificacion: string; calificacion_label: string;
  calificacion_numerica: string | null;
}

interface Motivo { codigo: string; etiqueta: string; }

interface IncidenciaHijo {
  id: number; titulo: string; descripcion: string;
  ubicacion: string; tipo: string; prioridad: string; estado: string;
  reportado_por_nombre?: string;
  estudiante_afectado: number | null;
  creado_en: string; solucion: string;
}

const ESTADO_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  presente:    { label: "Presente",    bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400" },
  tardanza:    { label: "Tardanza",    bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-400" },
  ausente:     { label: "Ausente",     bg: "bg-rose-500/10",    text: "text-rose-700 dark:text-rose-400" },
  justificado: { label: "Justificada", bg: "bg-blue-500/10",    text: "text-blue-700 dark:text-blue-400" },
};

const JUST_BADGE: Record<string, { bg: string; text: string }> = {
  pendiente:  { bg: "bg-amber-500/10",   text: "text-amber-700 dark:text-amber-400" },
  aprobada:   { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400" },
  rechazada:  { bg: "bg-rose-500/10",    text: "text-rose-700 dark:text-rose-400" },
};

/* ═══════════════════════════════════════════════════════════════════ MAIN ═══ */
export default function PanelFamiliarView() {
  const institucion = useInstitucion();
  const toast = useToast();
  const [hijos, setHijos] = useState<HijoResumen[]>([]);
  const [justificaciones, setJustificaciones] = useState<Justificacion[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenciaHijo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pidiendoJust, setPidiendoJust] = useState<{ estId: number; fecha: string } | null>(null);
  const [hijoActivo, setHijoActivo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [h, j, m, inc] = await Promise.all([
        api.get<{ hijos: HijoResumen[] }>("/asistencia/registros/mis-hijos/"),
        api.get<{ results?: Justificacion[] } | Justificacion[]>("/justificaciones/"),
        api.get<Motivo[]>("/justificaciones/motivos/"),
        api.get<{ results?: IncidenciaHijo[] } | IncidenciaHijo[]>("/incidencias/"),
      ]);
      setHijos(h.data.hijos);
      const jList = Array.isArray(j.data) ? j.data : (j.data as { results?: Justificacion[] }).results ?? [];
      setJustificaciones(jList);
      setMotivos(m.data);
      const incList = Array.isArray(inc.data) ? inc.data : (inc.data as { results?: IncidenciaHijo[] }).results ?? [];
      setIncidencias(incList);
      if (h.data.hijos[0] && hijoActivo === null) {
        setHijoActivo(h.data.hijos[0].estudiante_id);
      }
      const notasAll: Nota[] = [];
      for (const hijo of h.data.hijos) {
        try {
          const { data } = await api.get<{ results?: Nota[] } | Nota[]>(`/notas/?estudiante=${hijo.estudiante_id}`);
          const list = Array.isArray(data) ? data : (data as { results?: Nota[] }).results ?? [];
          notasAll.push(...list);
        } catch { /* ignore */ }
      }
      setNotas(notasAll);
    } finally { setCargando(false); }
  }, [hijoActivo]);

  useEffect(() => { cargar(); }, [cargar]);

  const hijo = hijos.find((h) => h.estudiante_id === hijoActivo) ?? hijos[0];
  const justificacionesHijo = justificaciones.filter((j) => j.estudiante === hijo?.estudiante_id);
  const notasHijo = notas.filter((n) => n.estudiante === hijo?.estudiante_id);
  const incidenciasHijo = incidencias.filter((i) => i.estudiante_afectado === hijo?.estudiante_id);

  // Agrupar notas por área+bimestre — el padre ve la calificación consolidada (la mejor competencia)
  const ORDEN_NL = ["AD", "A", "B", "C", ""];
  const notasAgrupadas = Object.values(
    notasHijo.reduce<Record<string, { area: string; bimestre_label: string; calificacion: string; calificacion_numerica: string | null }>>((acc, n) => {
      const key = `${n.area}__${n.bimestre}`;
      const prev = acc[key];
      const mejorNL = (a: string, b: string) =>
        ORDEN_NL.indexOf(a) <= ORDEN_NL.indexOf(b) ? a : b;
      if (!prev || ORDEN_NL.indexOf(mejorNL(n.calificacion, prev.calificacion)) < ORDEN_NL.indexOf(prev.calificacion)) {
        acc[key] = { area: n.area, bimestre_label: n.bimestre_label, calificacion: n.calificacion, calificacion_numerica: n.calificacion_numerica };
      }
      return acc;
    }, {})
  ).sort((a, b) => a.bimestre_label.localeCompare(b.bimestre_label) || a.area.localeCompare(b.area));

  async function descargarBoleta(estId: number, bimestre: string) {
    try {
      const { data } = await api.get(`/notas/boleta/${estId}/?bimestre=${bimestre}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      const nombre = hijo?.nombre.replace(/\s+/g, "_") ?? "estudiante";
      link.href = url;
      link.download = `boleta_${nombre}_B${bimestre}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.ok(`Boleta bimestre ${bimestre} descargada.`);
    } catch {
      toast.error("No se pudo descargar la boleta. Verificá que haya notas cargadas.");
    }
  }

  if (cargando && hijos.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (hijos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center max-w-md mx-auto">
        <Users size={48} className="mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Sin hijos vinculados</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Contacta a la I.E. para que vinculen a tus hijos a tu cuenta y puedas ver
          asistencia, notas, boletas y comunicados desde acá.
        </p>
      </div>
    );
  }

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const justPendientes = justificacionesHijo.filter((j) => j.estado === "pendiente").length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground p-6 sm:p-8">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 15% 20%, white 1px, transparent 1px), radial-gradient(circle at 85% 60%, white 1px, transparent 1px)`,
            backgroundSize: "50px 50px, 80px 80px",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-primary-foreground/80 text-xs font-medium mb-1">
            <School size={14} /> {institucion.nombre}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {saludo}
          </h2>
          <p className="text-primary-foreground/80 text-sm mt-1">
            Panel familiar · Seguimiento diario de tus {hijos.length === 1 ? "hijo/a" : "hijos"}
          </p>
        </div>
      </section>

      {/* Selector de hijo */}
      {hijos.length > 1 && (
        <section className="flex flex-wrap gap-2">
          {hijos.map((h) => (
            <button
              key={h.estudiante_id}
              onClick={() => setHijoActivo(h.estudiante_id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors",
                h.estudiante_id === hijoActivo
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/40"
              )}
            >
              <Users size={14} />
              <div className="text-left">
                <div className="text-sm font-semibold leading-tight">{h.nombre.split(" ")[0]}</div>
                <div className={cn(
                  "text-[11px] leading-tight",
                  h.estudiante_id === hijoActivo ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {h.grado} {h.seccion}
                </div>
              </div>
            </button>
          ))}
        </section>
      )}

      {hijo && (
        <>
          {/* KPIs del hijo */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Asistencia
                </span>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  hijo.porcentaje_asistencia >= 90 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : hijo.porcentaje_asistencia >= 75 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className={cn(
                "text-3xl font-bold tracking-tight",
                hijo.porcentaje_asistencia >= 90 ? "text-emerald-600 dark:text-emerald-400"
                  : hijo.porcentaje_asistencia >= 75 ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400"
              )}>
                {hijo.porcentaje_asistencia}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">{hijo.grado} {hijo.seccion}</div>
            </div>

            <KpiHijo label="Presente"  valor={hijo.por_estado.presente ?? 0} icon={CalendarCheck} color="emerald" />
            <KpiHijo label="Ausente"   valor={hijo.por_estado.ausente ?? 0}  icon={X}             color="rose" />
            <KpiHijo label="Justif. pendientes" valor={justPendientes} icon={AlertCircle} color="amber" />
          </section>

          {/* Asistencia reciente */}
          <Panel titulo={`Asistencia reciente de ${hijo.nombre.split(" ")[0]}`} icono={CalendarCheck}>
            {hijo.ultimos_10.length === 0 ? (
              <EstadoVacio icono={CalendarCheck} titulo="Sin registros" descripcion="Aún no hay marcas de asistencia." />
            ) : (
              <div className="space-y-1.5">
                {hijo.ultimos_10.map((r) => {
                  const cfg = ESTADO_BADGE[r.estado] ?? ESTADO_BADGE.presente;
                  const jExiste = justificacionesHijo.find((j) => j.fecha_falta === r.fecha);
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60">
                      <div className="w-12 text-center">
                        <div className="text-[10px] uppercase text-muted-foreground">
                          {new Date(r.fecha).toLocaleDateString("es-PE", { weekday: "short" })}
                        </div>
                        <div className="text-lg font-bold">{new Date(r.fecha).getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", cfg.bg, cfg.text)}>
                            {cfg.label}
                          </span>
                          {r.hora_llegada && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock size={11} /> {r.hora_llegada.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        {r.justificacion && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">{r.justificacion}</div>
                        )}
                      </div>
                      <div className="shrink-0">
                        {r.estado === "ausente" && !jExiste && (
                          <button
                            onClick={() => setPidiendoJust({ estId: hijo.estudiante_id, fecha: r.fecha })}
                            className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                          >
                            <FileText size={12} /> Justificar
                          </button>
                        )}
                        {jExiste && (
                          <span className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
                            JUST_BADGE[jExiste.estado]?.bg, JUST_BADGE[jExiste.estado]?.text
                          )}>
                            {jExiste.estado_label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Grid: Justificaciones + Notas/Boletas */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Justificaciones */}
            {justificacionesHijo.length > 0 && (
              <Panel titulo={`Justificaciones (${justificacionesHijo.length})`} icono={ClipboardCheck}>
                <div className="space-y-2">
                  {justificacionesHijo.map((j) => (
                    <div key={j.id} className="p-3 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="text-sm font-medium">
                          {new Date(j.fecha_falta).toLocaleDateString("es-PE")} · {j.motivo_label}
                        </div>
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
                          JUST_BADGE[j.estado]?.bg, JUST_BADGE[j.estado]?.text
                        )}>
                          {j.estado_label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground"><TextoExpandible texto={j.descripcion} maxChars={80} /></div>
                      {j.constancia && (
                        <a href={j.constancia} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1">
                          <Paperclip size={11} /> Ver constancia
                        </a>
                      )}
                      {j.razon_rechazo && (
                        <div className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                          <strong>Rechazo:</strong> {j.razon_rechazo}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Notas + Boletas PDF */}
            {notasAgrupadas.length > 0 ? (
              <Panel titulo="Notas y boletas" icono={BookOpen}>
                <div className="rounded-lg bg-muted/50 p-3 mb-3">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Download size={12} /> Descargar boleta oficial PDF por bimestre:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["1", "2", "3", "4"].map((b) => (
                      <button
                        key={b}
                        onClick={() => descargarBoleta(hijo.estudiante_id, b)}
                        className="text-xs font-medium px-3 py-1.5 rounded-md bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                      >
                        <Download size={11} /> Bimestre {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  {notasAgrupadas.map((n, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-md border border-border/60">
                      <div>
                        <div className="text-sm font-medium">{n.area}</div>
                        <div className="text-[11px] text-muted-foreground">{n.bimestre_label}</div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-lg font-bold",
                          n.calificacion === "AD" ? "text-emerald-600"
                            : n.calificacion === "A" ? "text-blue-600"
                            : n.calificacion === "B" ? "text-amber-600"
                            : "text-rose-600"
                        )}>
                          {n.calificacion || "—"}
                        </div>
                        {n.calificacion_numerica && (
                          <div className="text-[10px] text-muted-foreground">{n.calificacion_numerica}/20</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : (
              <Panel titulo="Notas y boletas" icono={BookOpen}>
                <EstadoVacio icono={TrendingUp} titulo="Sin notas" descripcion="Aún no hay notas cargadas del bimestre." />
              </Panel>
            )}
          </div>

          {/* Incidencias TIC */}
          {incidenciasHijo.length > 0 && (
            <Panel titulo={`Incidencias donde participó ${hijo.nombre.split(" ")[0]}`} icono={ShieldAlert}>
              <div className="space-y-2">
                {incidenciasHijo.map((i) => (
                  <div key={i.id} className="p-3 rounded-lg border border-border/60">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                      <div className="text-sm font-medium">{i.titulo}</div>
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
                        i.estado === "resuelta" || i.estado === "cerrada"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : i.estado === "en_atencion"
                          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      )}>
                        {i.estado.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      {new Date(i.creado_en).toLocaleDateString("es-PE")} · {i.ubicacion}
                      {i.reportado_por_nombre && ` · por ${i.reportado_por_nombre}`}
                    </div>
                    <p className="text-xs"><TextoExpandible texto={i.descripcion} maxChars={100} /></p>
                    {i.solucion && (
                      <div className="text-xs bg-emerald-500/10 rounded p-2 mt-2">
                        <strong className="text-emerald-700 dark:text-emerald-400">Solución:</strong>{" "}
                        <TextoExpandible texto={i.solucion} maxChars={100} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}

      {pidiendoJust && (
        <JustificacionModal
          estudianteId={pidiendoJust.estId}
          fecha={pidiendoJust.fecha}
          motivos={motivos}
          onCerrar={() => setPidiendoJust(null)}
          onEnviada={() => { setPidiendoJust(null); toast.ok("Justificación enviada. La I.E. la revisará."); cargar(); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ HELPERS ════ */
function KpiHijo({ label, valor, icon: Icon, color }: {
  label: string; valor: number; icon: LucideIcon;
  color: "emerald" | "amber" | "rose";
}) {
  const bg = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[color];
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bg)}>
          <Icon size={18} />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{valor}</div>
    </div>
  );
}

function Panel({ titulo, icono: Icono, linkTo, linkTexto, children }: {
  titulo: string; icono: LucideIcon; linkTo?: string; linkTexto?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icono size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{titulo}</h3>
        </div>
        {linkTo && (
          <a href={linkTo} className="text-xs text-primary hover:underline flex items-center gap-1">
            {linkTexto} <ArrowRight size={12} />
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

function EstadoVacio({ icono: Icono, titulo, descripcion }: {
  icono: LucideIcon; titulo: string; descripcion: string;
}) {
  return (
    <div className="text-center py-8">
      <Icono size={36} className="mx-auto mb-2 text-muted-foreground" />
      <div className="text-sm font-semibold">{titulo}</div>
      <div className="text-xs text-muted-foreground mt-1">{descripcion}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════ MODAL JUSTIFICACIÓN ═ */
function JustificacionModal({ estudianteId, fecha, motivos, onCerrar, onEnviada }: {
  estudianteId: number; fecha: string; motivos: Motivo[]; onCerrar: () => void; onEnviada: () => void;
}) {
  const toast = useToast();
  const [motivo, setMotivo] = useState(motivos[0]?.codigo ?? "enfermedad");
  const [descripcion, setDescripcion] = useState("");
  const [constancia, setConstancia] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (descripcion.length < 5) { toast.error("Escribe una descripción."); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("estudiante", String(estudianteId));
      fd.append("fecha_falta", fecha);
      fd.append("motivo", motivo);
      fd.append("descripcion", descripcion);
      if (constancia) fd.append("constancia", constancia);
      await api.post("/justificaciones/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onEnviada();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally { setEnviando(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">Justificar ausencia</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(fecha).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <button onClick={onCerrar} className="p-1 rounded-md hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-800 dark:text-blue-200">
            Tu justificación será revisada por el/la tutor/a de la sección. Recibirás una notificación cuando sea aprobada o rechazada.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Motivo *</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {motivos.map((m) => <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Descripción *</label>
            <textarea
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Explique brevemente la razón de la ausencia."
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Constancia (opcional)</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setConstancia(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium hover:file:bg-primary/90"
            />
            <div className="text-[11px] text-muted-foreground">
              Foto o PDF de constancia médica, oficio, etc.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onCerrar}
            className="h-9 px-4 rounded-md text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={enviando}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
