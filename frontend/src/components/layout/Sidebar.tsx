import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home, GraduationCap, ClipboardCheck, BookOpen, Users, User, UserPlus,
  Megaphone, CalendarDays, DoorOpen, Cpu, Package, AlertTriangle,
  Shield, FileSpreadsheet, Grid3x3, Settings, LogOut,
  ChevronRight, Sparkles, Wallet, Layers, School, Calendar, ShieldAlert, Coins,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useModoRol } from "../../hooks/useModoRol";
import { useModoUI } from "../../hooks/useModoUI";
import { useSidebar } from "../../hooks/useSidebar";
import { useInstitucion } from "../../context/InstitucionContext";
import { cn } from "../../lib/utils";
import { rutaVisible } from "../../lib/modulos";

type Rol = string;

interface Item { to: string; label: string; icon: LucideIcon; roles: Rol[] }
interface Grupo { titulo: string; icono: LucideIcon; items: Item[]; soloAvanzado?: boolean }

const GRUPOS: Grupo[] = [
  {
    titulo: "Académico", icono: GraduationCap,
    items: [
      { to: "/asistencia", label: "Asistencia", icon: ClipboardCheck, roles: ["docente", "admin_tic", "director", "subdirector", "auxiliar"] },
      { to: "/justificaciones", label: "Justificaciones", icon: FileSpreadsheet, roles: ["director", "subdirector", "docente", "auxiliar", "psicologa", "secretaria"] },
      { to: "/cargar-notas", label: "Registro de notas", icon: BookOpen, roles: ["docente"] },
      { to: "/notas", label: "Gestión de notas y boletas", icon: BookOpen, roles: ["director", "subdirector", "secretaria"] },
      { to: "/informes", label: "Informes de aprendizaje", icon: FileSpreadsheet, roles: ["director", "subdirector", "docente", "secretaria"] },
      { to: "/sesiones-clase", label: "Sesiones de clase", icon: Layers, roles: ["docente", "auxiliar", "psicologa"] },
      { to: "/alertas", label: "Alertas tempranas", icon: ShieldAlert, roles: ["director", "subdirector", "docente", "auxiliar", "psicologa"] },
      { to: "/horario", label: "Horario semanal", icon: Calendar, roles: ["docente"] },
      { to: "/aprender", label: "Aula Virtual", icon: BookOpen, roles: ["director", "subdirector", "docente", "admin_tic", "psicologa", "estudiante"] },
      { to: "/matricula", label: "Matrícula", icon: UserPlus, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/estudiantes", label: "Fichas de estudiantes", icon: User, roles: ["director", "subdirector", "admin_tic", "secretaria", "docente", "auxiliar", "psicologa"] },
    ],
  },
  {
    titulo: "Comunicación", icono: Megaphone,
    items: [
      { to: "/comunicados", label: "Comunicados", icon: Megaphone, roles: ["director", "subdirector", "docente", "admin_tic", "secretaria", "auxiliar", "psicologa", "conserje", "padre", "estudiante"] },
      { to: "/reservas", label: "Reservas", icon: CalendarDays, roles: ["director", "subdirector", "docente", "auxiliar", "psicologa", "admin_tic", "secretaria"] },
      { to: "/visitas", label: "Visitas", icon: DoorOpen, roles: ["admin_tic", "director", "subdirector", "secretaria", "conserje"] },
    ],
  },
  {
    titulo: "Finanzas", icono: Wallet,
    items: [
      { to: "/finanzas", label: "Gestión de Cobranzas", icon: Wallet, roles: ["director", "subdirector", "secretaria", "admin_tic"] },
      { to: "/caja", label: "Caja Chica y Flujo", icon: Coins, roles: ["director", "subdirector", "secretaria", "admin_tic"] },
    ],
  },
  {
    titulo: "TIC", icono: Cpu,
    items: [
      { to: "/incidencias", label: "Incidencias TI", icon: AlertTriangle, roles: ["docente", "admin_tic", "director"] },
      { to: "/inventario", label: "Inventario TI", icon: Package, roles: ["admin_tic", "director"] },
    ],
  },
  {
    titulo: "Convivencia", icono: Shield,
    items: [
      { to: "/convivencia", label: "Casos SíseVe", icon: Shield, roles: ["director", "subdirector", "psicologa", "auxiliar", "docente"] },
    ],
  },
  {
    titulo: "Personal", icono: User,
    items: [
      { to: "/asistencia-personal", label: "Mi asistencia", icon: ClipboardCheck, roles: ["director", "subdirector", "docente", "admin_tic", "secretaria", "auxiliar", "psicologa", "conserje"] },
      { to: "/asistencia-staff", label: "Asistencia del personal", icon: Users, roles: ["director", "subdirector", "secretaria", "admin_tic"] },
      { to: "/mi-ia", label: "Mi API de IA", icon: Sparkles, roles: ["director", "subdirector", "docente", "admin_tic", "secretaria", "auxiliar", "psicologa"] },
    ],
  },
  {
    titulo: "Familia", icono: Users,
    items: [
      { to: "/familia", label: "Mis hijos", icon: User, roles: ["padre"] },
      { to: "/justificaciones", label: "Justificaciones", icon: FileSpreadsheet, roles: ["padre"] },
      { to: "/convivencia", label: "Casos SíseVe", icon: Shield, roles: ["padre"] },
      { to: "/aprender", label: "Aula Virtual", icon: BookOpen, roles: ["padre"] },
    ],
  },
  {
    titulo: "Sistema", icono: Package,
    items: [
      { to: "/versiones", label: "Versiones del sistema", icon: Package, roles: ["director", "subdirector", "admin_tic"] },
    ],
  },
  {
    titulo: "Administración", icono: Settings, soloAvanzado: true,
    items: [
      { to: "/configuracion", label: "Configuración institucional", icon: Settings, roles: ["director", "subdirector", "admin_tic"] },
      { to: "/usuarios", label: "Usuarios", icon: Users, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/secciones", label: "Secciones", icon: Grid3x3, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/asignaciones-docentes", label: "Asignaciones de docentes", icon: BookOpen, roles: ["director", "subdirector"] },
      { to: "/invitar-docente", label: "Invitar/integrar docentes", icon: UserPlus, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/editar-curriculo", label: "Editar currículo (CNEB)", icon: BookOpen, roles: ["director", "subdirector", "admin_tic"] },
      { to: "/calendario", label: "Calendario escolar (RM 501)", icon: BookOpen, roles: ["director", "subdirector", "admin_tic"] },
      { to: "/importar", label: "Importar Excel", icon: FileSpreadsheet, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/ambientes", label: "Ambientes / QR", icon: DoorOpen, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/config-ia", label: "Configurar IA", icon: Sparkles, roles: ["director"] },
      { to: "/costos-ia", label: "Consumo de IA", icon: Wallet, roles: ["director", "admin_tic"] },
      { to: "/auditoria", label: "Auditoría", icon: FileSpreadsheet, roles: ["director", "subdirector", "admin_tic"] },
    ],
  },
];

const KEY_ABIERTOS = "sidebar.grupos.abiertos";

const navItemCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition-all select-none",
    "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/60",
    isActive
      ? "bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-500 shadow-xs"
      : "border-l-2 border-transparent"
  );

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const { modo, setModo } = useModoUI();
  const { abierta } = useSidebar();
  const institucion = useInstitucion();
  const { rolEfectivo, modoRol, setModoRol, esDualRol } = useModoRol();
  const [logoError, setLogoError] = useState(false);

  const [stats, setStats] = useState<{ estudiantes: number; docentes: number } | null>(null);

  useEffect(() => {
    if (!usuario || !["director", "subdirector", "admin_tic", "secretaria"].includes(usuario.rol)) return;
    import("../../services/api").then(({ default: api }) => {
      Promise.all([
        api.get<{ count?: number } | unknown[]>("/usuarios/estudiantes/lista/").catch(() => null),
      ]).then(([estRes]) => {
        if (!estRes) return;
        const est = Array.isArray(estRes.data) ? estRes.data.length : (estRes.data as { count?: number }).count ?? 0;
        setStats({ estudiantes: est, docentes: 0 });
      });
    });
  }, [usuario?.rol]);

  const modulosActivos = institucion.modulos_activos ?? [];
  const esEdicionDocente = institucion.edicion === "solo_docente";
  const esDocenteAdmin = esEdicionDocente && rolEfectivo === "docente" && !!usuario?.es_administrador;

  // Grupos que no aplican en Edición Docente (no hay padres/estudiantes ni admin TIC separado)
  const GRUPOS_OCULTOS_EDICION_DOCENTE = new Set(["Familia"]);

  const grupos = GRUPOS
    .filter((g) => modo === "completo" || !g.soloAvanzado)
    .filter((g) => !esEdicionDocente || !GRUPOS_OCULTOS_EDICION_DOCENTE.has(g.titulo))
    // En Edición Docente, el grupo Administración solo se muestra a docentes admin
    .filter((g) => !esEdicionDocente || !g.soloAvanzado || esDocenteAdmin)
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) =>
          i.roles.includes(rolEfectivo) ||
          // Docente admin en Edición Docente ve también los items de director
          (esDocenteAdmin && i.roles.includes("director"))
        )
        .filter((i) => rutaVisible(modulosActivos, i.to)),
    }))
    .filter((g) => g.items.length > 0);

  const [abiertos, setAbiertos] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(KEY_ABIERTOS);
      if (raw) return JSON.parse(raw);
    } catch { /* empty */ }
    return Object.fromEntries(GRUPOS.map((g) => [g.titulo, true]));
  });

  useEffect(() => {
    try { localStorage.setItem(KEY_ABIERTOS, JSON.stringify(abiertos)); } catch { /* empty */ }
  }, [abiertos]);

  const initials = ((usuario?.first_name?.[0] ?? "") + (usuario?.last_name?.[0] ?? "")).toUpperCase() || "U";

  return (
    <aside
      className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col",
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        "transform transition-transform lg:translate-x-0",
        abierta ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border bg-sidebar/50">
        <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-xs">
          {institucion.logo_url && !logoError ? (
            <img
              src={institucion.logo_url}
              alt="Logo"
              onError={() => setLogoError(true)}
              className="w-full h-full object-contain p-0.5"
            />
          ) : (
            institucion.sigla || <School size={18} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate text-foreground">
            {institucion.nombre || "Institución Educativa"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {institucion.sigla ? `${institucion.sigla} · Año Lectivo 2026` : "Año Lectivo 2026"}
          </div>
          {stats && stats.estudiantes > 0 && (
            <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
              {stats.estudiantes} estudiantes
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        <NavLink to="/" end className={navItemCls}>
          <Home size={16} /> Inicio
        </NavLink>

        {grupos.map((g) => {
          const abiertoGrupo = abiertos[g.titulo] ?? true;
          const Icono = g.icono;
          return (
            <div key={g.titulo} className="mt-3">
              <button
                type="button"
                onClick={() => setAbiertos((p) => ({ ...p, [g.titulo]: !abiertoGrupo }))}
                className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icono size={13} className="text-muted-foreground" />
                  {g.titulo}
                </span>
                <ChevronRight
                  size={12}
                  className={cn("transition-transform text-muted-foreground", abiertoGrupo && "rotate-90")}
                />
              </button>
              {abiertoGrupo && (
                <div className="mt-1 space-y-0.5">
                  {g.items.map((it) => (
                    <NavLink key={it.to + it.label} to={it.to} className={navItemCls}>
                      <it.icon size={16} className="shrink-0" />
                      <span className="truncate">{it.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div className="mt-3">
          <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Cuenta
          </div>
          <NavLink to="/mi-perfil" className={navItemCls}>
            <User size={16} /> Mi perfil
          </NavLink>
        </div>
      </nav>

      {/* Footer: user + modo + logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2.5 bg-sidebar/50">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate text-foreground">{usuario?.first_name} {usuario?.last_name}</div>
            <div className="text-[10px] text-muted-foreground truncate">@{usuario?.username}</div>
          </div>
        </div>

        {esDualRol && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-200/50 dark:bg-slate-800/60">
            <button
              type="button"
              onClick={() => setModoRol("director")}
              className={cn(
                "text-[11px] py-1 rounded transition-colors",
                modoRol === "director"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Director
            </button>
            <button
              type="button"
              onClick={() => setModoRol("docente")}
              className={cn(
                "text-[11px] py-1 rounded transition-colors",
                modoRol === "docente"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Docente
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-200/50 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={() => setModo("simple")}
            className={cn(
              "text-[11px] py-1 rounded transition-colors",
              modo === "simple"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setModo("completo")}
            className={cn(
              "text-[11px] py-1 rounded transition-colors",
              modo === "completo"
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Completo
          </button>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
