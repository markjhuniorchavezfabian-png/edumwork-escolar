import { NavLink } from "react-router-dom";
import {
  Home, ClipboardCheck, BookOpen, Megaphone, Users,
  Menu, Shield, GraduationCap, type LucideIcon
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useSidebar } from "../../hooks/useSidebar";
import { cn } from "../../lib/utils";

interface NavAction {
  to?: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export default function MobileNav() {
  const { usuario } = useAuth();
  const { alternar } = useSidebar();
  const rol = usuario?.rol || "";

  // Definición de las 4 acciones prioritarias según el rol
  let acciones: NavAction[] = [];

  if (rol === "padre") {
    acciones = [
      { to: "/", label: "Inicio", icon: Home },
      { to: "/familia", label: "Mis hijos", icon: Users },
      { to: "/comunicados", label: "Avisos", icon: Megaphone },
      { to: "/justificaciones", label: "Faltas", icon: ClipboardCheck },
    ];
  } else if (rol === "docente") {
    acciones = [
      { to: "/", label: "Inicio", icon: Home },
      { to: "/asistencia", label: "Asistencia", icon: ClipboardCheck },
      { to: "/cargar-notas", label: "Notas", icon: BookOpen },
      { to: "/comunicados", label: "Avisos", icon: Megaphone },
    ];
  } else if (rol === "estudiante") {
    acciones = [
      { to: "/", label: "Inicio", icon: Home },
      { to: "/aprender", label: "Aula", icon: GraduationCap },
      { to: "/comunicados", label: "Avisos", icon: Megaphone },
      { to: "/justificaciones", label: "Faltas", icon: ClipboardCheck },
    ];
  } else {
    // Directivos, administrativos y staff
    acciones = [
      { to: "/", label: "Inicio", icon: Home },
      { to: "/asistencia", label: "Asistencia", icon: ClipboardCheck },
      { to: "/notas", label: "Notas", icon: BookOpen },
      { to: "/convivencia", label: "SíseVe", icon: Shield },
    ];
  }

  return (
    <nav
      aria-label="Navegación móvil"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around px-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)]"
    >
      {acciones.map((act) => {
        const Icono = act.icon;
        return (
          <NavLink
            key={act.label}
            to={act.to!}
            end={act.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-lg transition-colors text-center select-none",
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    "p-1 rounded-full transition-all",
                    isActive && "bg-blue-50 dark:bg-blue-950/60"
                  )}
                >
                  <Icono size={20} />
                </div>
                <span className="text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-[64px]">
                  {act.label}
                </span>
              </>
            )}
          </NavLink>
        );
      })}

      {/* Botón Más para abrir el menú lateral */}
      <button
        type="button"
        onClick={alternar}
        className="flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors select-none"
        aria-label="Abrir menú completo"
      >
        <div className="p-1 rounded-full">
          <Menu size={20} />
        </div>
        <span className="text-[10px] leading-tight tracking-tight mt-0.5">
          Más
        </span>
      </button>
    </nav>
  );
}
