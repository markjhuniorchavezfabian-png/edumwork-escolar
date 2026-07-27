import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home, GraduationCap, ClipboardCheck, BookOpen, Users, User, UserPlus,
  Megaphone, CalendarDays, DoorOpen, Cpu, Package, AlertTriangle,
  Shield, FileSpreadsheet, Grid3x3, Settings, LogOut,
  ChevronRight, Sparkles, Wallet, Layers, School, Calendar, ShieldAlert,
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
      { to: "/sesiones-clase", label: "Sesiones (labs)", icon: Layers, roles: ["docente", "auxiliar", "psicologa"] },
      { to: "/alertas", label: "Alertas tempranas", icon: ShieldAlert, roles: ["director", "subdirector", "docente", "auxiliar", "psicologa"] },
      { to: "/horario", label: "Horario semanal", icon: Calendar, roles: ["docente"] },
      { to: "/aprender", label: "Aula Virtual", icon: BookOpen, roles: ["director", "subdirector", "docente", "admin_tic", "psicologa", "estudiante", "padre"] },
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
      { to: "/calendario", label: "Calendario escolar (RM 556)", icon: BookOpen, roles: ["director", "subdirector", "admin_tic"] },
      { to: "/importar", label: "Importar Excel", icon: FileSpreadsheet, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/ambientes", label: "Ambientes / QR", icon: DoorOpen, roles: ["director", "subdirector", "admin_tic", "secretaria"] },
      { to: "/config-ia", label: "Configurar IA", icon: Sparkles, roles: ["director"] },
      { to: "/costos-ia", label: "Consumo de IA", icon: Wallet, roles: ["director", "admin_tic"] },
      { to: "/auditoria", label: "Auditoría", icon: FileSpreadsheet, roles: ["director", "subdirector", "admin_tic", "docente"] },
    ],
  },
];

const KEY_ABIERTOS = "sidebar.grupos.abiertos";

const navItemCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 px-3 py-2 mx-2 rounded-md text-sm font-medium transition-colors",
    "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/20",
    isActive && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent"
  );

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const { modo, setModo } = useModoUI();
  const { abierta } = useSidebar();
  const institucion = useInstitucion();
  const { rolEfectivo, modoRol, setModoRol, esDualRol } = useModoRol();

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
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-md bg-sidebar-accent text-sidebar-accent-foreground flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
          {institucion.logo_url ? (
            <img src={institucion.logo_url} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            institucion.sigla || <School size={18} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">
            {institucion.nombre || "Sistema TIC"}
          </div>
          <div className="text-[11px] text-sidebar-foreground/60 truncate">
            EduMWork
          </div>
          {stats && stats.estudiantes > 0 && (
            <div className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5">
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
                className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Icono size={12} />
                  {g.titulo}
                </span>
                <ChevronRight
                  size={12}
                  className={cn("transition-transform", abiertoGrupo && "rotate-90")}
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
      <div className="border-t border-sidebar-border p-3 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent/20 text-sidebar-accent-foreground flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">{usuario?.first_name} {usuario?.last_name}</div>
            <div className="text-[10px] text-sidebar-foreground/60 truncate">@{usuario?.username}</div>
          </div>
        </div>

        {esDualRol && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-sidebar-border/40">
            <button
              type="button"
              onClick={() => setModoRol("director")}
              className={cn(
                "text-[11px] py-1 rounded transition-colors",
                modoRol === "director"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
              )}
            >
              Docente
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-sidebar-border/40">
          <button
            type="button"
            onClick={() => setModo("simple")}
            className={cn(
              "text-[11px] py-1 rounded transition-colors",
              modo === "simple"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
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
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
            )}
          >
            Completo
          </button>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-destructive/20 transition-colors"
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
