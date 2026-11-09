import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck, Clock, X, Users, TrendingUp, FileText, AlertCircle,
  Download, Paperclip, Loader2, ArrowRight, School, BookOpen,
  ShieldAlert, ClipboardCheck, CreditCard, Landmark,
  AlertTriangle, ExternalLink, PlusCircle, type LucideIcon,
} from "lucide-react";
import TextoExpandible from "../components/ui/TextoExpandible";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { consentirDatos } from "../services/gestion";
import { useToast } from "../components/ui/Toast";
import { useInstitucion } from "../context/InstitucionContext";
import { useHijo } from "../context/HijoContext";
import { cn } from "../lib/utils";
import { parseFecha, fechaCorta } from "../utils/fechas";
import {
  getObligaciones, getPagos, subirVoucherPago,
  type ObligacionPago, type Pago,
} from "../services/finanzas";
import { getConfig, type ConfigInstitucional } from "../services/onboarding";

/* ═════════════════════════════════════════════════════════════════ TIPOS ════ */
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
  const { usuario, logout, refreshUsuario } = useAuth();
  const { hijos, hijoActivo, hijoActivoId, seleccionarHijo, cargandoHijos, recargarHijos } = useHijo();
  const [modalConsentimiento, setModalConsentimiento] = useState(false);
  const [guardandoConsentimiento, setGuardandoConsentimiento] = useState(false);
  const [justificaciones, setJustificaciones] = useState<Justificacion[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [incidencias, setIncidencias] = useState<IncidenciaHijo[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [pidiendoJust, setPidiendoJust] = useState<{ estId: number; fecha: string } | null>(null);

  const [obligaciones, setObligaciones] = useState<ObligacionPago[]>([]);
  const [pagosFamilia, setPagosFamilia] = useState<Pago[]>([]);
  const [configInst, setConfigInst] = useState<ConfigInstitucional | null>(null);
  const [cargandoFinanzas, setCargandoFinanzas] = useState(false);
  const [modalVoucher, setModalVoucher] = useState<{ open: boolean; obligacionId?: number } | null>(null);
  const [hijoIdForzado, setHijoIdForzado] = useState<number | null>(() => {
    try {
      const g = localStorage.getItem("edumwork_hijo_activo") || localStorage.getItem("thales_hijo_activo");
      return g ? Number(g) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (usuario && usuario.rol === "padre" && usuario.consentimiento_datos === false) {
      setModalConsentimiento(true);
    }
  }, [usuario?.consentimiento_datos, usuario?.rol]);

  async function handleAceptarConsentimiento() {
    setGuardandoConsentimiento(true);
    try {
      await consentirDatos();
      toast.ok("Consentimiento registrado conforme a la Ley N° 29733.");
      setModalConsentimiento(false);
      await refreshUsuario();
    } catch {
      toast.error("Error al registrar consentimiento. Inténtelo nuevamente.");
    } finally {
      setGuardandoConsentimiento(false);
    }
  }

  useEffect(() => {
    const handleCambiado = (e: any) => {
      const val = e.detail?.id ?? e.detail;
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        setHijoIdForzado(num);
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === "edumwork_hijo_activo" || e.key === "thales_hijo_activo") && e.newValue) {
        const num = Number(e.newValue);
        if (!isNaN(num) && num > 0) {
          setHijoIdForzado(num);
        }
      }
    };
    window.addEventListener("edumwork_hijo_cambiado", handleCambiado as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("edumwork_hijo_cambiado", handleCambiado as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const cargar = useCallback(async () => {
    setCargandoDatos(true);
    try {
      const [j, m, inc] = await Promise.all([
        api.get<{ results?: Justificacion[] } | Justificacion[]>("/justificaciones/"),
        api.get<Motivo[]>("/justificaciones/motivos/"),
        api.get<{ results?: IncidenciaHijo[] } | IncidenciaHijo[]>("/incidencias/"),
      ]);
      const jList = Array.isArray(j.data) ? j.data : (j.data as { results?: Justificacion[] }).results ?? [];
      setJustificaciones(jList);
      setMotivos(m.data);
      const incList = Array.isArray(inc.data) ? inc.data : (inc.data as { results?: IncidenciaHijo[] }).results ?? [];
      setIncidencias(incList);

      if (hijos.length > 0) {
        const notasAll: Nota[] = [];
        for (const h of hijos) {
          try {
            const { data } = await api.get<{ results?: Nota[] } | Nota[]>(`/notas/?estudiante=${h.estudiante_id}`);
            const list = Array.isArray(data) ? data : (data as { results?: Nota[] }).results ?? [];
            notasAll.push(...list);
          } catch { /* ignore */ }
        }
        setNotas(notasAll);
      }
    } finally {
      setCargandoDatos(false);
    }
  }, [hijos]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hijo =
    (hijoIdForzado ? hijos.find((h) => Number(h.estudiante_id) === Number(hijoIdForzado)) : null) ??
    hijoActivo ??
    (hijoActivoId ? hijos.find((h) => Number(h.estudiante_id) === Number(hijoActivoId)) : null) ??
    (hijos.length > 0 ? hijos[0] : null);
  const justificacionesHijo = justificaciones.filter((j) => Number(j.estudiante) === Number(hijo?.estudiante_id));
  const notasHijo = notas.filter((n) => Number(n.estudiante) === Number(hijo?.estudiante_id));
  const incidenciasHijo = incidencias.filter((i) => Number(i.estudiante_afectado) === Number(hijo?.estudiante_id));

  const cargarFinanzas = useCallback(async (estId: number) => {
    setCargandoFinanzas(true);
    try {
      const [ob, pg, cfg] = await Promise.all([
        getObligaciones({ estudiante_id: estId }),
        getPagos({ estudiante_id: estId }),
        getConfig().catch(() => null),
      ]);
      setObligaciones(ob);
      setPagosFamilia(pg);
      if (cfg) setConfigInst(cfg);
    } catch {
      // Finanzas deshabilitado o sin datos
    } finally {
      setCargandoFinanzas(false);
    }
  }, []);

  useEffect(() => {
    if (hijo?.estudiante_id) {
      cargarFinanzas(hijo.estudiante_id);
    }
  }, [hijo?.estudiante_id, cargarFinanzas]);

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
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: unknown } };
      if (anyErr.response?.data instanceof Blob) {
        try {
          const text = await anyErr.response.data.text();
          const json = JSON.parse(text);
          if (json.detail) {
            toast.error(json.detail);
            return;
          }
        } catch { /* ignore */ }
      }
      toast.error("No se pudo descargar la boleta. Verifica que no existan restricciones o que haya notas cargadas.");
    }
  }

  if ((cargandoHijos || cargandoDatos) && hijos.length === 0) {
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
  const totalDeudaPendiente = obligaciones
    .filter((o) => o.estado !== "PAGADO" && o.estado !== "EXONERADO")
    .reduce((sum, o) => sum + parseFloat(o.saldo_pendiente || "0"), 0);
  const cuotasVencidas = obligaciones.filter((o) => o.estado === "VENCIDO").length;
  const estaBloqueado = Boolean(
    configInst?.bloquear_boleta_por_deuda &&
    cuotasVencidas >= (configInst.max_cuotas_vencidas_bloqueo || 1)
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Encabezado Institucional Sobrio */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
              <School size={13} />
              <span>{institucion.nombre || "Institución Educativa"} · Seguimiento Familiar {institucion.anio_lectivo_activo || 2026}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground pt-1">
              {saludo} · Seguimiento de {hijo ? hijo.nombre : "tus hijos"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {hijo ? `Estudiante matriculado en ${hijo.grado} ${hijo.seccion}` : "Resumen académico y asistencia"} · {new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {hijo && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span>{hijo.grado} {hijo.seccion}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{hijo.porcentaje_asistencia}% asistencia</span>
            </div>
          )}
        </div>
      </section>

      {/* Banner de Consentimiento Pendiente Ley 29733 */}
      {usuario?.rol === "padre" && usuario?.consentimiento_datos === false && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Autorización de Tratamiento de Datos Personales (Ley N° 29733)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Para garantizar la privacidad y seguridad pedagógica de sus hijos conforme a ley, requerimos su consentimiento informado digital.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalConsentimiento(true)}
            className="shrink-0 text-xs font-semibold px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs flex items-center gap-1.5"
          >
            <ShieldAlert size={14} /> Revisar y Autorizar
          </button>
        </section>
      )}

      {/* Selector de hijo sincronizado */}
      {hijos.length > 1 && (
        <section className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-muted-foreground mr-1">Seleccionar hijo:</span>
          {hijos.map((h) => {
            const esActivo = Number(h.estudiante_id) === Number(hijo?.estudiante_id);
            return (
              <button
                key={h.estudiante_id}
                type="button"
                aria-pressed={esActivo}
                data-selected={esActivo}
                data-estudiante-id={h.estudiante_id}
                onClick={() => seleccionarHijo(h.estudiante_id)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all text-xs select-none",
                  esActivo
                    ? "bg-blue-50 border-blue-600 text-blue-700 font-semibold dark:bg-blue-950/60 dark:border-blue-500 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30"
                    : "bg-card border-border text-foreground hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                <Users size={14} className={esActivo ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"} />
                <div className="text-left">
                  <span className="font-semibold block leading-tight">{h.nombre.split(" ")[0]}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{h.grado} {h.seccion}</span>
                </div>
              </button>
            );
          })}
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
          <Panel
            titulo={`Asistencia reciente de ${hijo.nombre.split(" ")[0]}`}
            icono={CalendarCheck}
            accionExtra={
              <button
                type="button"
                onClick={() => setPidiendoJust({ estId: hijo.estudiante_id, fecha: new Date().toISOString().slice(0, 10) })}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
              >
                <FileText size={12} /> + Justificar fecha
              </button>
            }
          >
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
                          {parseFecha(r.fecha)!.toLocaleDateString("es-PE", { weekday: "short" })}
                        </div>
                        <div className="text-lg font-bold">{parseFecha(r.fecha)!.getDate()}</div>
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
                        {(r.estado === "ausente" || r.estado === "tardanza") && !jExiste && (
                          <button
                            type="button"
                            onClick={() => setPidiendoJust({ estId: hijo.estudiante_id, fecha: r.fecha })}
                            className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                          >
                            <FileText size={12} /> Justificar {r.estado === "tardanza" ? "tardanza" : "falta"}
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
            <Panel
              titulo={`Justificaciones (${justificacionesHijo.length})`}
              icono={ClipboardCheck}
              accionExtra={
                <button
                  type="button"
                  onClick={() => setPidiendoJust({ estId: hijo.estudiante_id, fecha: new Date().toISOString().slice(0, 10) })}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                >
                  <FileText size={12} /> + Nueva
                </button>
              }
            >
              {justificacionesHijo.length === 0 ? (
                <EstadoVacio
                  icono={ClipboardCheck}
                  titulo="Sin justificaciones registradas"
                  descripcion="Si su hijo/a tuvo una falta o tardanza, puede reportar aquí la justificación médica o familiar con su constancia."
                />
              ) : (
                <div className="space-y-2">
                  {justificacionesHijo.map((j) => (
                    <div key={j.id} className="p-3 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <div className="text-sm font-medium">
                          {fechaCorta(j.fecha_falta)} · {j.motivo_label}
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
              )}
            </Panel>

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
                <EstadoVacio icono={TrendingUp} titulo="Notas en revisión" descripcion="La institución publicará las notas y boletas cuando cierre el bimestre." />
              </Panel>
            )}
          </div>

          {/* Finanzas: Pensiones y Pagos */}
          <Panel
            titulo={`Pensiones y Pagos Escolares · ${hijo.nombre.split(" ")[0]}`}
            icono={CreditCard}
          >
            {/* Banner de alerta de bloqueo */}
            {estaBloqueado && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 mb-4 flex items-start gap-3">
                <AlertTriangle className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-rose-800 dark:text-rose-300">
                  <strong className="font-semibold block text-sm mb-0.5">Descarga de boletas restringida por morosidad</strong>
                  Presenta {cuotasVencidas} cuota(s) vencida(s). Por disposición institucional, la descarga de la libreta de notas oficial está temporalmente bloqueada. Regularice sus pagos reportando su voucher para habilitarla.
                </div>
              </div>
            )}

            {/* Resumen y Cuentas Bancarias */}
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-border/70 bg-card p-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Saldo Pendiente Total
                  </div>
                  <div className={cn(
                    "text-2xl font-bold tracking-tight mt-0.5",
                    totalDeudaPendiente > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {totalDeudaPendiente > 0 ? `S/ ${totalDeudaPendiente.toFixed(2)}` : "Al día ✓"}
                  </div>
                  {cuotasVencidas > 0 && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                      {cuotasVencidas} cuota(s) vencida(s)
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setModalVoucher({ open: true })}
                  className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <PlusCircle size={14} /> Reportar voucher
                </button>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-xs space-y-1 text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
                  <Landmark size={14} className="text-primary" /> Cuentas institucionales para abonos:
                </div>
                <div>
                  <strong className="text-foreground">BCP:</strong> {configInst?.cuenta_recaudacion_bcp || "Ventanilla / Agente BCP con DNI del alumno"}
                </div>
                <div>
                  <strong className="text-foreground">BBVA:</strong> {configInst?.cuenta_recaudacion_bbva || "Banca por internet o agente con DNI"}
                </div>
                <div className="text-[11px] text-muted-foreground/90 pt-0.5">
                  Suba la foto clara del comprobante indicando el número de operación.
                </div>
              </div>
            </div>

            {/* Cronograma vs Vouchers reportados */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Cronograma de Pensiones ({obligaciones.length})
                </h4>
                {cargandoFinanzas ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <Loader2 size={20} className="animate-spin mx-auto mb-1" /> Cargando estado de cuenta...
                  </div>
                ) : obligaciones.length === 0 ? (
                  <EstadoVacio icono={CreditCard} titulo="Sin obligaciones programadas" descripcion="No hay pensiones registradas para este periodo lectivo." />
                ) : (
                  <div className="space-y-2">
                    {obligaciones.map((ob) => {
                      const esVencido = ob.estado === "VENCIDO";
                      const esPagado = ob.estado === "PAGADO";
                      const esParcial = ob.estado === "PARCIAL";
                      return (
                        <div
                          key={ob.id}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-3 transition-colors",
                            esVencido ? "border-rose-500/30 bg-rose-500/5" : "border-border/60 bg-card"
                          )}
                        >
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                              {ob.concepto_nombre}
                              {ob.mes && (
                                <span className="text-xs font-normal text-muted-foreground">
                                  ({new Date(2026, ob.mes - 1, 1).toLocaleDateString("es-PE", { month: "long" })})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Vence: <strong className={cn(esVencido && "text-rose-600 font-semibold")}>{fechaCorta(ob.fecha_vencimiento)}</strong>
                              {parseFloat(ob.descuento) > 0 && (
                                <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                  (Dscto: -S/ {ob.descuento} {ob.motivo_descuento ? `· ${ob.motivo_descuento}` : ""})
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 self-end sm:self-center">
                            <div className="text-right">
                              <div className="text-sm font-bold text-foreground">
                                S/ {parseFloat(ob.saldo_pendiente) > 0 ? ob.saldo_pendiente : ob.total_a_pagar}
                              </div>
                              <span className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
                                esPagado ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : esVencido ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                  : esParcial ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {ob.estado}
                              </span>
                            </div>

                            {!esPagado && (
                              <button
                                onClick={() => setModalVoucher({ open: true, obligacionId: ob.id })}
                                className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium flex items-center gap-1 transition-colors"
                              >
                                <Paperclip size={12} /> Pagar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Historial de Pagos y Vouchers Reportados */}
              {pagosFamilia.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Vouchers y Pagos Reportados ({pagosFamilia.length})
                  </h4>
                  <div className="space-y-2">
                    {pagosFamilia.map((p) => {
                      const esPendiente = p.estado === "PENDIENTE_VALIDACION";
                      const esConfirmado = p.estado === "CONFIRMADO";
                      return (
                        <div key={p.id} className="p-3 rounded-lg border border-border/60 bg-muted/20 text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <span>Recibo {p.nro_recibo}</span>
                              <span className="text-muted-foreground font-normal">· {p.concepto_nombre}</span>
                            </div>
                            <span className={cn(
                              "text-[10px] font-semibold px-2 py-0.5 rounded uppercase",
                              esConfirmado ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : esPendiente ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                            )}>
                              {esPendiente ? "En revisión" : esConfirmado ? "Aprobado" : "Rechazado"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-muted-foreground flex-wrap gap-2">
                            <div>
                              Fecha: {fechaCorta(p.fecha_pago)} · Método: <strong>{p.metodo_pago}</strong>
                              {p.nro_operacion && ` · Op: ${p.nro_operacion}`}
                            </div>
                            <div className="text-sm font-bold text-foreground">
                              S/ {parseFloat(p.monto).toFixed(2)}
                            </div>
                          </div>

                          {p.motivo_anulacion && (
                            <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2 rounded">
                              <strong>Motivo rechazo:</strong> {p.motivo_anulacion}
                            </div>
                          )}

                          <div className="flex items-center gap-3 pt-1">
                            {p.comprobante_img && (
                              <a
                                href={p.comprobante_img}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 font-medium"
                              >
                                <Paperclip size={12} /> Ver voucher subido
                              </a>
                            )}
                            {p.sunat_enlace_pdf && (
                              <a
                                href={p.sunat_enlace_pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                              >
                                <ExternalLink size={12} /> Boleta Electrónica SUNAT ({p.sunat_numero_comprobante || "PDF"})
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Panel>

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
          onEnviada={() => { setPidiendoJust(null); toast.ok("Justificación enviada. La I.E. la revisará."); cargar(); recargarHijos(); }}
        />
      )}

      {modalVoucher?.open && hijo && (
        <SubirVoucherModal
          estudianteId={hijo.estudiante_id}
          estudianteNombre={hijo.nombre}
          obligaciones={obligaciones.filter((o) => o.estado !== "PAGADO" && o.estado !== "EXONERADO")}
          obligacionInicialId={modalVoucher.obligacionId}
          onCerrar={() => setModalVoucher(null)}
          onGuardado={() => {
            setModalVoucher(null);
            cargarFinanzas(hijo.estudiante_id);
          }}
        />
      )}

      {/* Modal Consentimiento Ley 29733 */}
      {modalConsentimiento && (
        <ModalConsentimientoDatos
          nombreInstitucion={institucion.nombre || "la Institución Educativa"}
          hijosNombres={hijos.map((h) => h.nombre).join(", ")}
          onAceptar={handleAceptarConsentimiento}
          onCerrarSesion={logout}
          cargando={guardandoConsentimiento}
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

function Panel({ titulo, icono: Icono, linkTo, linkTexto, accionExtra, children }: {
  titulo: string; icono: LucideIcon; linkTo?: string; linkTexto?: string;
  accionExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Icono size={16} className="text-primary" />
          <h3 className="text-sm font-semibold">{titulo}</h3>
        </div>
        <div className="flex items-center gap-2">
          {accionExtra}
          {linkTo && (
            <a href={linkTo} className="text-xs text-primary hover:underline flex items-center gap-1">
              {linkTexto} <ArrowRight size={12} />
            </a>
          )}
        </div>
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
  const [fechaFalta, setFechaFalta] = useState(fecha || new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState(motivos[0]?.codigo ?? "enfermedad");
  const [descripcion, setDescripcion] = useState("");
  const [constancia, setConstancia] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!fechaFalta) { toast.error("Selecciona la fecha."); return; }
    if (descripcion.trim().length < 5) { toast.error("Escribe una descripción de al menos 5 caracteres."); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("estudiante", String(estudianteId));
      fd.append("fecha_falta", fechaFalta);
      fd.append("motivo", motivo);
      fd.append("descripcion", descripcion.trim());
      if (constancia) fd.append("constancia", constancia);
      await api.post("/justificaciones/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onEnviada();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; [key: string]: unknown } } };
      const mensaje = err.response?.data?.error || "Error al enviar justificación.";
      toast.error(String(mensaje));
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
            <h3 className="text-lg font-semibold">Justificar inasistencia o tardanza</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reporte oficial ante la I.E. para justificar ausencia o tardanza.
            </p>
          </div>
          <button onClick={onCerrar} className="p-1 rounded-md hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-800 dark:text-blue-200">
            Tu justificación será revisada por el/la tutor/a o auxiliar de la sección. Recibirás una notificación cuando sea evaluada.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Fecha de la falta o tardanza *</label>
            <input
              type="date"
              value={fechaFalta}
              onChange={(e) => setFechaFalta(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
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
              placeholder="Explique brevemente la razón de la ausencia o tardanza."
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
              Foto o PDF de constancia médica, receta, oficio, etc.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onCerrar}
            disabled={enviando}
            className="px-4 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={enviando}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {enviando && <Loader2 size={13} className="animate-spin" />}
            {enviando ? "Enviando..." : "Enviar justificación"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════ MODAL CONSENTIMIENTO LEY 29733 ═ */
function ModalConsentimientoDatos({
  nombreInstitucion,
  hijosNombres,
  onAceptar,
  onCerrarSesion,
  cargando,
}: {
  nombreInstitucion: string;
  hijosNombres: string;
  onAceptar: () => Promise<void>;
  onCerrarSesion: () => void;
  cargando: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 border-b border-border bg-blue-50/50 dark:bg-blue-950/20">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-sm">
            <ShieldAlert size={24} />
          </div>
          <h3 className="text-lg font-bold tracking-tight text-foreground">
            Consentimiento Requerido — Ley N° 29733
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tratamiento seguro de datos personales de menores de edad
          </p>
        </div>

        <div className="p-6 space-y-4 text-xs text-muted-foreground leading-relaxed max-h-[60vh] overflow-y-auto">
          <p className="text-foreground font-medium">
            Estimado/a padre, madre o apoderado/a de <strong>{hijosNombres || "sus menores hijos"}</strong>:
          </p>

          <p>
            En cumplimiento de la <strong>Ley N° 29733</strong> (Ley de Protección de Datos Personales del Perú) y su Reglamento (D.S. N° 003-2013-JUS), <strong>{nombreInstitucion}</strong> requiere su autorización expresa previa para registrar, consultar y procesar digitalmente la información escolar de sus hijos en esta intranet.
          </p>

          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2">
            <div className="font-semibold text-foreground">Finalidades pedagógicas e institucionales exclusivas:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Control diario de asistencia, tardanzas y justificaciones oficiales.</li>
              <li>Registro y evaluación de competencias CNEB y emisión de boletas de notas (SIAGIE).</li>
              <li>Seguimiento de convivencia escolar y soporte psicopedagógico (SíseVe).</li>
              <li>Envío de alertas tempranas, comunicados institucionales y estados de cuenta.</li>
            </ul>
          </div>

          <p>
            <strong>Garantía de privacidad:</strong> Los datos se almacenan bajo estrictos controles de seguridad,
            cifrado en tránsito y reposo, y <strong>nunca</strong> serán comercializados ni cedidos a terceros
            ajenos a las obligaciones con el Ministerio de Educación (MINEDU) y UGEL.
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 p-5 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onCerrarSesion}
            disabled={cargando}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            No acepto (Cerrar sesión)
          </button>
          <button
            type="button"
            onClick={onAceptar}
            disabled={cargando}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {cargando ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
            {cargando ? "Registrando..." : "Autorizo y acepto los términos"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════ MODAL SUBIR VOUCHER DE PAGO ═ */
function SubirVoucherModal({
  estudianteId,
  estudianteNombre,
  obligaciones,
  obligacionInicialId,
  onCerrar,
  onGuardado,
}: {
  estudianteId: number;
  estudianteNombre: string;
  obligaciones: ObligacionPago[];
  obligacionInicialId?: number;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const toast = useToast();
  const [obligacionId, setObligacionId] = useState<string>(obligacionInicialId ? String(obligacionInicialId) : "");
  const [monto, setMonto] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<string>("YAPE");
  const [nroOperacion, setNroOperacion] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (obligacionId) {
      const sel = obligaciones.find((o) => o.id === Number(obligacionId));
      if (sel) {
        setMonto(sel.saldo_pendiente);
      }
    }
  }, [obligacionId, obligaciones]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!monto || parseFloat(monto) <= 0) {
      toast.error("Ingrese un monto válido mayor a 0.");
      return;
    }
    if (!archivo) {
      toast.error("Debe adjuntar una foto o captura del comprobante/voucher de pago.");
      return;
    }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("estudiante", String(estudianteId));
      if (obligacionId) {
        fd.append("obligacion", obligacionId);
      }
      fd.append("monto", monto);
      fd.append("metodo_pago", metodoPago);
      fd.append("nro_operacion", nroOperacion);
      fd.append("fecha_pago", fechaPago);
      fd.append("comprobante_img", archivo);
      if (observaciones) {
        fd.append("observaciones", observaciones);
      }
      await subirVoucherPago(fd);
      toast.ok("Voucher enviado con éxito. Tesorería revisará su abono.");
      onGuardado();
    } catch {
      toast.error("Error al registrar voucher. Verifique los datos ingresados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden my-8"
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">Reportar comprobante de pago</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{estudianteNombre}</p>
          </div>
          <button onClick={onCerrar} className="p-1 rounded-md hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={enviar} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Cuota / Concepto a pagar</label>
            <select
              value={obligacionId}
              onChange={(e) => setObligacionId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Pago general / Varios conceptos --</option>
              {obligaciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.concepto_nombre} (Saldo: S/ {o.saldo_pendiente})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Monto pagado (S/) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Método de pago *</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="YAPE">Yape</option>
                <option value="PLIN">Plin</option>
                <option value="TRANSFERENCIA">Transferencia bancaria</option>
                <option value="DEPOSITO">Depósito en agente / ventanilla</option>
                <option value="EFECTIVO">Efectivo en secretaría</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nro. de Operación</label>
              <input
                type="text"
                value={nroOperacion}
                onChange={(e) => setNroOperacion(e.target.value)}
                placeholder="Ej: 0459281"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Fecha de pago *</label>
              <input
                type="date"
                required
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Foto o captura del Voucher *</label>
            <input
              type="file"
              required
              accept="image/*,.pdf"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium hover:file:bg-primary/90"
            />
            <p className="text-[11px] text-muted-foreground">
              Adjunte la captura legible de Yape/Plin o voucher del banco.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Observación (opcional)</label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Abono pensión marzo"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2 rounded-md text-sm border border-border hover:bg-muted font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-5 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-semibold disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
            >
              {enviando && <Loader2 size={14} className="animate-spin" />}
              {enviando ? "Enviando..." : "Subir comprobante"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
