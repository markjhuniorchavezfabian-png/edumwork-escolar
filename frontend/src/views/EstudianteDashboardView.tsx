import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck, Clock, X, FileCheck, ArrowRight, Megaphone, BookOpen,
  Loader2, Sparkles, GraduationCap, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useInstitucion } from "../context/InstitucionContext";
import api from "../services/api";
import { cn } from "../lib/utils";
import { parseFecha } from "../utils/fechas";

interface RegistroAsis {
  id: number;
  fecha: string;
  estado: string;
  hora_llegada: string | null;
  justificacion: string;
}

interface Comunicado {
  id: number;
  titulo: string;
  categoria_label: string;
  fecha_publicacion: string;
  autor_nombre: string;
}

interface Tarea {
  id: number;
  titulo: string;
  descripcion?: string;
  fecha_entrega: string;
  curso_titulo?: string;
  curso?: number;
}

const ESTADO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  presente:    { label: "Presente",    color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  tardanza:    { label: "Tardanza",    color: "text-amber-700 dark:text-amber-400",     bg: "bg-amber-500/10" },
  ausente:     { label: "Ausente",     color: "text-rose-700 dark:text-rose-400",       bg: "bg-rose-500/10" },
  justificado: { label: "Justificada", color: "text-slate-700 dark:text-slate-300",     bg: "bg-slate-500/10" },
};

export default function EstudianteDashboardView() {
  const { usuario } = useAuth();
  const institucion = useInstitucion();
  const [asistencias, setAsistencias] = useState<RegistroAsis[]>([]);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/asistencia/registros/?estudiante=" + usuario?.id).catch(() => ({ data: [] })),
      api.get("/comunicados/").catch(() => ({ data: [] })),
      api.get("/aula-virtual/tareas/pendientes/").catch(() => ({ data: [] })),
    ])
      .then(([a, c, t]) => {
        const aList = Array.isArray(a.data) ? a.data : (a.data as { results?: RegistroAsis[] }).results ?? [];
        const cList = Array.isArray(c.data) ? c.data : (c.data as { results?: Comunicado[] }).results ?? [];
        const tList = Array.isArray(t.data) ? t.data : (t.data as { results?: Tarea[] }).results ?? [];
        setAsistencias(aList.slice(0, 15));
        setComunicados(cList.slice(0, 5));
        setTareas(tList.slice(0, 5));
      })
      .finally(() => setCargando(false));
  }, [usuario?.id]);

  const total = asistencias.length;
  const presentes = asistencias.filter((a) => a.estado === "presente").length;
  const tardanzas = asistencias.filter((a) => a.estado === "tardanza").length;
  const ausentes = asistencias.filter((a) => a.estado === "ausente").length;
  const justificadas = asistencias.filter((a) => a.estado === "justificado").length;
  const porcentaje = total > 0 ? Math.round(((presentes + tardanzas + justificadas) / total) * 100) : 0;

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

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
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary-foreground/80 text-xs font-medium mb-1">
              <GraduationCap size={14} /> {institucion.nombre}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {saludo}, {usuario?.first_name}
            </h2>
            <p className="text-primary-foreground/80 text-sm mt-1">
              {new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
              {tareas.length > 0 && ` · Tienes ${tareas.length} tarea${tareas.length === 1 ? "" : "s"} pendiente${tareas.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="text-center rounded-xl bg-white/10 backdrop-blur px-5 py-3 ring-1 ring-white/20 min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wide text-primary-foreground/70">Asistencia</div>
            <div className="text-3xl font-bold">{porcentaje}%</div>
            <div className="text-[10px] text-primary-foreground/70">últimos 15 días</div>
          </div>
        </div>
      </section>

      {/* KPIs asistencia */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Presente"    valor={presentes}   icon={CalendarCheck} color="emerald" />
        <KpiCard label="Tardanzas"   valor={tardanzas}   icon={Clock}         color="amber" />
        <KpiCard label="Ausencias"   valor={ausentes}    icon={X}             color="rose" />
        <KpiCard label="Justificadas" valor={justificadas} icon={FileCheck}   color="slate" />
      </section>

      {/* Grid: Tareas pendientes + Comunicados */}
      <section className="grid lg:grid-cols-2 gap-4">
        {/* Tareas */}
        <Panel titulo="Tareas pendientes" icono={BookOpen} linkTexto="Ir al aula virtual" linkTo="/aprender">
          {tareas.length === 0 ? (
            <EstadoVacio
              icono={FileCheck}
              titulo="Sin tareas pendientes"
              descripcion="Estás al día con tus entregas. ¡Sigue así!"
            />
          ) : (
            <div className="space-y-2">
              {tareas.map((t) => {
                const dias = Math.ceil((new Date(t.fecha_entrega).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const urgente = dias <= 2;
                return (
                  <Link
                    key={t.id}
                    to={t.curso ? `/aprender/curso/${t.curso}` : "/aprender"}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/50 transition-colors group"
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-md flex items-center justify-center shrink-0",
                      urgente ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    )}>
                      <BookOpen size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.titulo}</div>
                      {t.curso_titulo && (
                        <div className="text-xs text-muted-foreground truncate">{t.curso_titulo}</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        "text-xs font-semibold",
                        urgente ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
                      )}>
                        {dias < 0 ? "Vencida" : dias === 0 ? "Hoy" : `${dias} día${dias === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Comunicados */}
        <Panel titulo="Comunicados recientes" icono={Megaphone} linkTexto="Ver todos" linkTo="/comunicados">
          {comunicados.length === 0 ? (
            <EstadoVacio
              icono={Megaphone}
              titulo="Sin comunicados"
              descripcion="Cuando la I.E. publique algo aparecerá aquí."
            />
          ) : (
            <div className="space-y-2">
              {comunicados.map((c) => (
                <Link
                  key={c.id}
                  to="/comunicados"
                  className="block p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide">
                      {c.categoria_label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(c.fecha_publicacion).toLocaleDateString("es-PE")}
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate">{c.titulo}</div>
                  {c.autor_nombre && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{c.autor_nombre}</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* Asistencia detalle */}
      <Panel titulo="Mi asistencia — últimos 15 días" icono={CalendarCheck}>
        {asistencias.length === 0 ? (
          <EstadoVacio icono={CalendarCheck} titulo="Sin registros" descripcion="Aún no hay registros de asistencia." />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
            {asistencias.map((a) => {
              const cfg = ESTADO_CFG[a.estado] ?? ESTADO_CFG.presente;
              const d = parseFecha(a.fecha)!;
              return (
                <div
                  key={a.id}
                  className={cn("rounded-lg border border-border/60 p-2 text-center", cfg.bg)}
                >
                  <div className="text-[10px] text-muted-foreground uppercase">
                    {d.toLocaleDateString("es-PE", { weekday: "short" })}
                  </div>
                  <div className="text-lg font-bold">{d.getDate()}</div>
                  <div className={cn("text-[10px] font-semibold uppercase mt-0.5", cfg.color)}>
                    {cfg.label}
                  </div>
                  {a.hora_llegada && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">{a.hora_llegada.slice(0, 5)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Accesos rápidos */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <AccesoRapido to="/aprender"     icono={BookOpen}   label="Aula Virtual" desc="Cursos, lecciones y tareas" color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" />
        <AccesoRapido to="/comunicados" icono={Megaphone}  label="Comunicados"  desc="Avisos de la institución" color="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        <AccesoRapido to="/mi-perfil"    icono={Sparkles}   label="Mi perfil"    desc="Configura tu cuenta"      color="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ HELPERS ════ */
function KpiCard({ label, valor, icon: Icon, color }: {
  label: string; valor: number; icon: LucideIcon;
  color: "emerald" | "amber" | "rose" | "slate";
}) {
  const bgMap = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    rose:    "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    slate:   "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  };
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", bgMap[color])}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight">{valor}</div>
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
          <Link to={linkTo} className="text-xs text-primary hover:underline flex items-center gap-1">
            {linkTexto} <ArrowRight size={12} />
          </Link>
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

function AccesoRapido({ to, icono: Icono, label, desc, color }: {
  to: string; icono: LucideIcon; label: string; desc: string; color: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border/60 bg-card p-4 shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all flex items-center gap-3"
    >
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icono size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
      </div>
    </Link>
  );
}
