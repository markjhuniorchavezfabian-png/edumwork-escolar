import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ClipboardCheck, Package, DoorOpen, Cpu, BarChart3,
  BookOpen, Clock, Shield, Users, ArrowRight, Sparkles, TrendingUp,
  School, GraduationCap, Wand2, MailWarning, RefreshCw, type LucideIcon,
  GraduationCap as Risk,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useModoUI } from "../hooks/useModoUI";
import { useInstitucion } from "../context/InstitucionContext";
import { getOnboardingStatus, getEmailStatus, type OnboardingStatus, type EmailStatus } from "../services/onboarding";
import EstudianteDashboardView from "./EstudianteDashboardView";
import PanelFamiliarView from "./PanelFamiliarView";
import { cn } from "../lib/utils";

const ROL_LABELS: Record<string, string> = {
  director: "Director",
  subdirector: "Subdirector",
  docente: "Docente",
  admin_tic: "Administrador TIC",
  secretaria: "Secretaría",
  auxiliar: "Auxiliar",
  psicologa: "Psicólogo/a",
  conserje: "Portería",
  padre: "Padre de Familia",
  estudiante: "Estudiante",
};

interface Atajo {
  titulo: string;
  texto: string;
  ruta: string;
  icono: LucideIcon;
  color: string; // tailwind bg tint
  badge?: string;
}

const ATAJOS_POR_ROL: Record<string, Atajo[]> = {
  docente: [
    { titulo: "Control de Asistencia", texto: "Registra la asistencia diaria por aula y sección asignada.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { titulo: "Registro de Calificaciones", texto: "Ingreso bimestral de competencias CNEB y conclusiones.", ruta: "/cargar-notas", icono: BookOpen, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { titulo: "Sesiones de Aprendizaje", texto: "Planificación curricular, unidades y sesiones de clase.", ruta: "/sesiones-clase", icono: GraduationCap, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { titulo: "Horario Escolar", texto: "Consulta tus horas pedagógicas y distribución de aulas.", ruta: "/horario", icono: Clock, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { titulo: "Comunicados", texto: "Revisa circulares y comunicados institucionales vigentes.", ruta: "/comunicados", icono: BookOpen, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { titulo: "Reportar Incidencia TIC", texto: "Informa sobre desperfectos en proyectores, PCs o red.", ruta: "/incidencias", icono: AlertTriangle, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  ],
  admin_tic: [
    { titulo: "Bandeja de Incidencias", texto: "Atención, diagnóstico y soporte técnico del colegio.", ruta: "/incidencias", icono: AlertTriangle, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    { titulo: "Inventario Tecnológico", texto: "Equipos de cómputo, proyectores, tablets y periféricos.", ruta: "/inventario", icono: Package, color: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
    { titulo: "Control de Asistencia", texto: "Monitoreo general y escaneo por código QR.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    { titulo: "Control de Portería", texto: "Registro de ingresos y pases de visita al plantel.", ruta: "/visitas", icono: DoorOpen, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
    { titulo: "Configuración TIC", texto: "Servicios del sistema y proveedores de soporte.", ruta: "/config-ia", icono: Cpu, color: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  ],
  director: [
    { titulo: "Supervisión de Asistencia", texto: "Porcentaje de concurrencia diaria de alumnos y personal.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    { titulo: "Convivencia Escolar (SíseVe)", texto: "Casos activos, protocolos y plazos normativos MINEDU.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
    { titulo: "Notas y Boletas Oficiales", texto: "Consolidados bimestrales y actas de evaluación SIAGIE.", ruta: "/notas", icono: BookOpen, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { titulo: "Padrón de Estudiantes", texto: "Fichas de matrícula y directorio de apoderados.", ruta: "/estudiantes", icono: Users, color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" },
    { titulo: "Gestión Institucional", texto: "Datos del colegio, periodos lectivos y parámetros.", ruta: "/configuracion", icono: BarChart3, color: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
    { titulo: "Incidencias TIC", texto: "Estado de la infraestructura digital del colegio.", ruta: "/incidencias", icono: AlertTriangle, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  ],
  subdirector: [
    { titulo: "Supervisión de Asistencia", texto: "Asistencia de secciones y control de ausencias.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    { titulo: "Convivencia Escolar", texto: "Casos de aula y seguimiento de protocolos.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
    { titulo: "Notas y Rendimiento", texto: "Consolidados bimestrales por grado y sección.", ruta: "/notas", icono: BookOpen, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  ],
  secretaria: [
    { titulo: "Fichas de Matrícula", texto: "Expedientes de estudiantes y apoderados.", ruta: "/estudiantes", icono: Users, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    { titulo: "Comunicados Oficiales", texto: "Publicar avisos a familias y personal docente.", ruta: "/comunicados", icono: BookOpen, color: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
    { titulo: "Control de Visitas", texto: "Registro de ingresos a secretaría y dirección.", ruta: "/visitas", icono: DoorOpen, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  ],
  auxiliar: [
    { titulo: "Control de Asistencia", texto: "Registro de puntualidad, tardanzas e inasistencias.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    { titulo: "Justificaciones", texto: "Recepción y validación de justificaciones médicas.", ruta: "/justificaciones", icono: ClipboardCheck, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    { titulo: "Incidencias de Aula", texto: "Anotaciones preventivas de conducta.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  ],
  psicologa: [
    { titulo: "Convivencia Escolar", texto: "Atención psicopedagógica y casos SíseVe.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
    { titulo: "Revisión de Casos", texto: "Seguimiento de inasistencias y factores familiares.", ruta: "/justificaciones", icono: ClipboardCheck, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  ],
  conserje: [
    { titulo: "Control de Portería", texto: "Ingreso de visitantes y proveedores.", ruta: "/visitas", icono: DoorOpen, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
    { titulo: "Comunicados", texto: "Avisos de horario y actividades del colegio.", ruta: "/comunicados", icono: BookOpen, color: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  ],
};

const COLOR_MAP: Record<string, { bg: string; txt: string }> = {
  emerald: { bg: "bg-emerald-500/10", txt: "text-emerald-700 dark:text-emerald-400" },
  amber:   { bg: "bg-amber-500/10",   txt: "text-amber-700 dark:text-amber-400" },
  rose:    { bg: "bg-rose-500/10",    txt: "text-rose-700 dark:text-rose-400" },
  blue:    { bg: "bg-blue-500/10",    txt: "text-blue-700 dark:text-blue-400" },
  violet:  { bg: "bg-violet-500/10",  txt: "text-violet-700 dark:text-violet-400" },
  sky:     { bg: "bg-sky-500/10",     txt: "text-sky-700 dark:text-sky-400" },
  indigo:  { bg: "bg-indigo-500/10",  txt: "text-indigo-700 dark:text-indigo-400" },
  slate:   { bg: "bg-slate-500/10",   txt: "text-slate-700 dark:text-slate-300" },
};

function KpiCard({
  label, valor, sub, icono: Icono, color, alerta = false,
}: {
  label: string; valor: string; sub: string;
  icono: LucideIcon; color: string; alerta?: boolean;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 sm:p-5 shadow-xs transition-all",
      alerta ? "border-rose-300 bg-rose-50/30 dark:border-rose-900 dark:bg-rose-950/20" : "border-border hover:border-slate-300 dark:hover:border-slate-700"
    )}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", c.bg)}>
          <Icono size={18} className={c.txt} />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{valor}</div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
        <TrendingUp size={12} className="shrink-0" /> <span className="truncate">{sub}</span>
      </div>
    </div>
  );
}

interface KpisData {
  asistencia_hoy: {
    pct: number | null;
    presentes: number | null;
    total: number;
    hay_registros: boolean;
    es_dia_no_lectivo?: boolean;
    motivo_no_lectivo?: string;
  };
  incidencias: { abiertas: number; nuevas: number };
  convivencia: { activos: number; vencidos?: number; por_vencer: number };
  estudiantes: { total: number; secciones: number };
  riesgo_academico: { en_riesgo: number };
}

export default function DashboardView() {
  const { usuario } = useAuth();
  const { modo } = useModoUI();
  const institucion = useInstitucion();

  if (usuario?.rol === "estudiante") return <EstudianteDashboardView />;
  if (usuario?.rol === "padre") return <PanelFamiliarView />;

  const atajos = ATAJOS_POR_ROL[usuario?.rol ?? ""] ?? [];
  const isDirector = usuario?.rol === "director" || (usuario?.rol as string) === "subdirector";
  const puedeConfigurar = isDirector || (usuario?.rol as string) === "admin_tic";
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [email, setEmail] = useState<EmailStatus | null>(null);
  const [resumenSemanal, setResumenSemanal] = useState<string | null>(null);
  const [generandoResumen, setGenerandoResumen] = useState(false);
  const [kpis, setKpis] = useState<KpisData | null>(null);
  const [cargandoKpis, setCargandoKpis] = useState(false);

  async function generarResumenSemanal() {
    setGenerandoResumen(true);
    setResumenSemanal(null);
    try {
      const { data } = await import("../services/api").then(m => m.default.post("/ia/resumen-semanal/", { anio: institucion.anio_lectivo_activo }));
      if (data.sin_config) { setResumenSemanal("Sin IA configurada. Ve a Administración → Configurar IA."); return; }
      setResumenSemanal(data.resumen);
    } catch {
      setResumenSemanal("Error al generar el resumen.");
    } finally {
      setGenerandoResumen(false);
    }
  }

  useEffect(() => {
    if (!puedeConfigurar) return;
    getOnboardingStatus().then(setOnboarding).catch(() => { /* no crítico */ });
    getEmailStatus().then(setEmail).catch(() => { /* no crítico */ });
  }, [puedeConfigurar]);

  useEffect(() => {
    if (!isDirector) return;
    setCargandoKpis(true);
    api.get<KpisData>("/core/kpis-director/")
      .then(({ data }) => setKpis(data))
      .catch(() => { /* no crítico */ })
      .finally(() => setCargandoKpis(false));
  }, [isDirector]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6 w-full max-w-7xl">
      {/* Hero Institucional Antifatiga */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/60">
              <School size={13} />
              <span>{institucion.nombre || "Colegio César Vallejo"} · Año Lectivo {institucion.anio_lectivo_activo || 2026}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground pt-1">
              {saludo}, {usuario?.first_name} {usuario?.last_name}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {usuario?.rol ? ROL_LABELS[usuario.rol] : "Personal"} · {new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Plataforma operativa</span>
            </div>
          </div>
        </div>
      </section>

      {/* Banner SMTP no configurado */}
      {puedeConfigurar && email && !email.activo && (
        <Link
          to="/configuracion"
          className="group flex items-center gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 hover:bg-rose-500/15 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
            <MailWarning size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-rose-900 dark:text-rose-100">
              Envío de correos desactivado
            </div>
            <div className="text-xs text-rose-800/80 dark:text-rose-200/80">
              Reset de contraseña, alertas de convivencia (plazo legal) y notificaciones a padres NO se envían. Configura SMTP.
            </div>
          </div>
          <ArrowRight size={18} className="text-rose-700 dark:text-rose-300 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* Banner onboarding pendiente */}
      {puedeConfigurar && onboarding && !onboarding.completado && (
        <Link
          to="/onboarding"
          className="group flex items-center gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 hover:bg-amber-500/15 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
            <Wand2 size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Termina de configurar tu colegio
            </div>
            <div className="text-xs text-amber-800/80 dark:text-amber-200/80">
              {!onboarding.pasos.config.completo && "Faltan datos institucionales · "}
              {!onboarding.pasos.secciones.completo && "Aún no hay secciones · "}
              {!onboarding.pasos.docentes.completo && "Aún no hay docentes · "}
              {!onboarding.pasos.estudiantes.completo && "Aún no hay estudiantes"}
            </div>
          </div>
          <ArrowRight size={18} className="text-amber-700 dark:text-amber-300 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}

      {/* F1: Resumen semanal IA — solo director en modo completo */}
      {isDirector && modo === "completo" && (
        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-semibold text-sm">Resumen semanal institucional</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Incidencias TIC · Asistencia · Notas por sección · Alertas de riesgo
              </div>
            </div>
            <button
              onClick={generarResumenSemanal}
              disabled={generandoResumen}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              )}
            >
              {generandoResumen
                ? <><RefreshCw size={14} className="animate-spin" /> Generando...</>
                : <><Sparkles size={14} /> Generar resumen IA</>
              }
            </button>
          </div>
          {resumenSemanal && (
            <div className="mt-4 pt-4 border-t border-border/60 text-sm space-y-2 prose prose-sm dark:prose-invert max-w-none">
              {resumenSemanal.split("\n").map((line, i) => {
                if (line.startsWith("# ")) return <h2 key={i} className="font-semibold text-lg mt-2 mb-1">{line.slice(2)}</h2>;
                if (line.startsWith("## ")) return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>;
                if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold">{line.slice(2,-2)}</p>;
                if (line.startsWith("- ")) return <li key={i} className="ml-4 text-muted-foreground">{line.slice(2)}</li>;
                return line ? <p key={i} className="text-muted-foreground">{line}</p> : <br key={i} />;
              })}
              <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                Generado con IA. Datos en tiempo real de la institución.
              </p>
            </div>
          )}
        </section>
      )}

      {/* KPIs director — datos en tiempo real */}
      {isDirector && modo === "completo" && (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Asistencia hoy */}
          <KpiCard
            label="Asistencia hoy"
            valor={
              cargandoKpis ? "…"
              : kpis?.asistencia_hoy.es_dia_no_lectivo ? "Sin jornada"
              : !kpis?.asistencia_hoy.hay_registros ? "Sin datos"
              : kpis.asistencia_hoy.pct !== null ? `${kpis.asistencia_hoy.pct}%`
              : "—"
            }
            sub={
              kpis?.asistencia_hoy.es_dia_no_lectivo
                ? (kpis.asistencia_hoy.motivo_no_lectivo || "Día no lectivo")
                : kpis?.asistencia_hoy.hay_registros
                ? `${kpis.asistencia_hoy.presentes ?? 0} de ${kpis.asistencia_hoy.total}`
                : "Aún no marcada"
            }
            icono={ClipboardCheck}
            color={kpis?.asistencia_hoy.es_dia_no_lectivo ? "slate" : "emerald"}
            alerta={kpis && !kpis.asistencia_hoy.es_dia_no_lectivo ? (kpis.asistencia_hoy.pct ?? 100) < 80 : false}
          />
          {/* Incidencias */}
          <KpiCard
            label="Incidencias abiertas"
            valor={cargandoKpis ? "…" : String(kpis?.incidencias.abiertas ?? 0)}
            sub={kpis ? `${kpis.incidencias.nuevas} nuevas sin atender` : ""}
            icono={AlertTriangle}
            color="amber"
            alerta={kpis ? kpis.incidencias.nuevas > 0 : false}
          />
          {/* Convivencia */}
          <KpiCard
            label="Casos SíseVe"
            valor={cargandoKpis ? "…" : String(kpis?.convivencia.activos ?? 0)}
            sub={
              kpis
                ? (kpis.convivencia.vencidos ?? 0) > 0
                  ? `${kpis.convivencia.vencidos} caso(s) vencido(s)`
                  : (kpis.convivencia.por_vencer ?? 0) > 0
                  ? `${kpis.convivencia.por_vencer} próximo(s) a vencer`
                  : "Todos en plazo normativo"
                : ""
            }
            icono={Shield}
            color="rose"
            alerta={kpis ? ((kpis.convivencia.vencidos ?? 0) > 0 || (kpis.convivencia.por_vencer ?? 0) > 0) : false}
          />
          {/* Estudiantes */}
          <KpiCard
            label="Estudiantes"
            valor={cargandoKpis ? "…" : String(kpis?.estudiantes.total ?? 0)}
            sub={kpis ? `${kpis.estudiantes.secciones} secciones activas` : ""}
            icono={Users}
            color="blue"
          />
          {/* Riesgo académico */}
          <KpiCard
            label="En riesgo académico"
            valor={cargandoKpis ? "…" : String(kpis?.riesgo_academico.en_riesgo ?? 0)}
            sub="≥3 áreas con nota C"
            icono={Risk}
            color="violet"
            alerta={kpis ? kpis.riesgo_academico.en_riesgo > 0 : false}
          />
        </section>
      )}

      {/* Atajos */}
      {atajos.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Accesos rápidos</h3>
            {modo === "simple" && (
              <span className="text-xs text-muted-foreground">Toca una opción</span>
            )}
          </div>
          <div className={cn(
            "grid gap-3",
            modo === "simple" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          )}>
            {atajos.map((a) => (
              <Link
                key={a.ruta}
                to={a.ruta}
                className={cn(
                  "group relative rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-blue-500/40 hover:shadow-sm transition-all select-none",
                  modo === "simple" && "flex items-center gap-4"
                )}
              >
                <div className={cn(
                  "rounded-lg flex items-center justify-center shrink-0",
                  a.color,
                  modo === "simple" ? "w-14 h-14" : "w-11 h-11"
                )}>
                  <a.icono size={modo === "simple" ? 24 : 20} />
                </div>

                <div className={cn(modo === "simple" ? "flex-1" : "mt-3")}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={cn(
                      "font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
                      modo === "simple" ? "text-base" : "text-sm"
                    )}>
                      {a.titulo}
                    </h4>
                    {a.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                        {a.badge}
                      </span>
                    )}
                  </div>
                  {modo !== "simple" && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {a.texto}
                    </p>
                  )}
                </div>

                {modo === "simple" ? (
                  <ArrowRight size={18} className="text-muted-foreground group-hover:text-blue-600 transition-colors" />
                ) : (
                  <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Ingresar al módulo <ArrowRight size={12} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {atajos.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aún no hay módulos habilitados para el rol{" "}
          <strong className="text-foreground">{ROL_LABELS[usuario?.rol ?? ""]}</strong>.
        </div>
      )}
    </div>
  );
}
