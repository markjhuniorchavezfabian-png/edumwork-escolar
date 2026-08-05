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
    { titulo: "Reportar incidencia", texto: "Cuenta un problema en tus palabras. La IA extrae los detalles.", ruta: "/incidencias", icono: AlertTriangle, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", badge: "IA" },
    { titulo: "Marcar asistencia", texto: "Registra la asistencia de tus estudiantes del día.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { titulo: "Mi asistencia", texto: "Marca tu entrada y salida del día.", ruta: "/asistencia-personal", icono: Clock, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { titulo: "Mis notas", texto: "Cargar notas del bimestre de tus estudiantes.", ruta: "/cargar-notas", icono: BookOpen, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { titulo: "Aula Virtual", texto: "Cursos, lecciones y tareas.", ruta: "/aprender", icono: GraduationCap, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  ],
  admin_tic: [
    { titulo: "Bandeja de incidencias", texto: "Ver, tomar y resolver reportes. Consulta sugerencias de la IA.", ruta: "/incidencias", icono: AlertTriangle, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", badge: "IA" },
    { titulo: "Inventario TI", texto: "Alta, baja, edición y control de equipos TIC.", ruta: "/inventario", icono: Package, color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { titulo: "Asistencia", texto: "Marca asistencia de estudiantes.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { titulo: "Control de visitas", texto: "Registro con gafete QR imprimible.", ruta: "/visitas", icono: DoorOpen, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { titulo: "Configurar IA", texto: "Elige proveedor y clave BYOK.", ruta: "/config-ia", icono: Cpu, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ],
  director: [
    { titulo: "Panel de incidencias", texto: "KPIs, gráficos y resumen ejecutivo automático.", ruta: "/incidencias", icono: BarChart3, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", badge: "IA" },
    { titulo: "Panel de asistencia", texto: "% de asistencia, distribución y top ausencias.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { titulo: "Casos SíseVe", texto: "Convivencia con plazos legales automáticos.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { titulo: "Gestión de notas", texto: "Cargar Excel de bimestre, generar boletas PDF.", ruta: "/notas", icono: BookOpen, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { titulo: "Inventario TI", texto: "Estado y valor total de los activos TIC.", ruta: "/inventario", icono: Package, color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { titulo: "Configurar IA", texto: "Elige proveedor (DeepSeek, Claude, Ollama...) y clave.", ruta: "/config-ia", icono: Sparkles, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  ],
  subdirector: [
    { titulo: "Panel de asistencia", texto: "% de asistencia y ausencias.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { titulo: "Casos SíseVe", texto: "Convivencia y plazos legales.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { titulo: "Notas", texto: "Revisar notas de bimestre.", ruta: "/notas", icono: BookOpen, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ],
  secretaria: [
    { titulo: "Fichas de estudiantes", texto: "Ver y editar fichas SIAGIE.", ruta: "/estudiantes", icono: Users, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { titulo: "Comunicados", texto: "Enviar comunicados a padres y docentes.", ruta: "/comunicados", icono: BookOpen, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { titulo: "Visitas", texto: "Control de portería.", ruta: "/visitas", icono: DoorOpen, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ],
  auxiliar: [
    { titulo: "Asistencia", texto: "Marcar asistencia de estudiantes.", ruta: "/asistencia", icono: ClipboardCheck, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { titulo: "Justificaciones", texto: "Revisar justificaciones de faltas.", ruta: "/justificaciones", icono: ClipboardCheck, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { titulo: "Convivencia", texto: "Reportar casos SíseVe.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  ],
  psicologa: [
    { titulo: "Casos SíseVe", texto: "Gestión de casos de convivencia escolar.", ruta: "/convivencia", icono: Shield, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { titulo: "Justificaciones", texto: "Revisar justificaciones.", ruta: "/justificaciones", icono: ClipboardCheck, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  ],
  conserje: [
    { titulo: "Visitas", texto: "Registro de portería.", ruta: "/visitas", icono: DoorOpen, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { titulo: "Comunicados", texto: "Ver comunicados institucionales.", ruta: "/comunicados", icono: BookOpen, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ],
};

function KpiCard({
  label, valor, sub, icono: Icono, color, alerta = false,
}: {
  label: string; valor: string; sub: string;
  icono: LucideIcon; color: string; alerta?: boolean;
}) {
  const bg = `bg-${color}-500/10`;
  const txt = `text-${color}-600 dark:text-${color}-400`;
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-5 shadow-card hover:shadow-card-hover transition-shadow",
      alerta ? "border-rose-400/60" : "border-border/60"
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", bg)}>
          <Icono size={20} className={txt} />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{valor}</div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
        <TrendingUp size={12} /> {sub}
      </div>
    </div>
  );
}

interface KpisData {
  asistencia_hoy: { pct: number | null; presentes: number | null; total: number; hay_registros: boolean };
  incidencias: { abiertas: number; nuevas: number };
  convivencia: { activos: number; por_vencer: number };
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
    <div className="space-y-6 max-w-6xl">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground p-6 sm:p-8">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 15% 20%, white 1px, transparent 1px), radial-gradient(circle at 85% 60%, white 1px, transparent 1px)`,
            backgroundSize: "50px 50px, 80px 80px",
          }}
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-primary-foreground/80 text-xs font-medium mb-1">
              <School size={14} /> {institucion.nombre}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {saludo}, {usuario?.first_name}
            </h2>
            <p className="text-primary-foreground/80 text-sm mt-1">
              {usuario?.rol ? ROL_LABELS[usuario.rol] : ""}
              {" · "}
              {new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          {modo === "completo" && (
            <div className="flex items-center gap-2 text-xs text-primary-foreground/80">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sistema operativo
            </div>
          )}
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
              : !kpis?.asistencia_hoy.hay_registros ? "Sin datos"
              : kpis.asistencia_hoy.pct !== null ? `${kpis.asistencia_hoy.pct}%`
              : "—"
            }
            sub={
              kpis?.asistencia_hoy.hay_registros
                ? `${kpis.asistencia_hoy.presentes ?? 0} de ${kpis.asistencia_hoy.total}`
                : "Aún no marcada"
            }
            icono={ClipboardCheck}
            color="emerald"
            alerta={kpis ? (kpis.asistencia_hoy.pct ?? 100) < 80 : false}
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
            sub={kpis ? `${kpis.convivencia.por_vencer} próximos a vencer` : ""}
            icono={Shield}
            color="rose"
            alerta={kpis ? kpis.convivencia.por_vencer > 0 : false}
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
                  "group relative rounded-2xl border border-border/60 bg-card p-5 shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all",
                  modo === "simple" && "p-5 flex items-center gap-4"
                )}
              >
                <div className={cn(
                  "rounded-xl flex items-center justify-center shrink-0",
                  a.color,
                  modo === "simple" ? "w-16 h-16" : "w-12 h-12"
                )}>
                  <a.icono size={modo === "simple" ? 28 : 22} />
                </div>

                <div className={cn(modo === "simple" ? "flex-1" : "mt-3")}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={cn(
                      "font-semibold text-foreground",
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
                  <ArrowRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                ) : (
                  <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Entrar <ArrowRight size={12} />
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
