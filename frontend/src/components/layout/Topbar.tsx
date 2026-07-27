import { useLocation } from "react-router-dom";
import { Menu, Sun, Moon, Search, Clock } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useSidebar } from "../../hooks/useSidebar";
import { useTheme } from "../../hooks/useTheme";
import CampanaNotificaciones from "./CampanaNotificaciones";

const ROL_LABELS: Record<string, string> = {
  director: "Director",
  subdirector: "Subdirector",
  docente: "Docente",
  admin_tic: "Administrador TIC",
  secretaria: "Secretaría",
  auxiliar: "Auxiliar de educación",
  psicologa: "Psicólogo/a",
  conserje: "Portería",
  padre: "Padre de Familia",
  estudiante: "Estudiante",
};

const TITLES_BY_PATH: Record<string, string> = {
  "/": "Inicio",
  "/asistencia": "Asistencia",
  "/justificaciones": "Justificaciones",
  "/notas": "Notas",
  "/aprender": "Aula Virtual",
  "/estudiantes": "Fichas de estudiantes",
  "/comunicados": "Comunicados",
  "/reservas": "Reservas",
  "/visitas": "Visitas",
  "/incidencias": "Incidencias TI",
  "/inventario": "Inventario TI",
  "/convivencia": "Casos SíseVe",
  "/asistencia-personal": "Mi asistencia",
  "/mi-ia": "Mi API de IA",
  "/familia": "Mis hijos",
  "/usuarios": "Usuarios",
  "/secciones": "Secciones",
  "/importar": "Importar Excel",
  "/ambientes": "Ambientes / QR",
  "/config-ia": "Configurar IA",
  "/costos-ia": "Consumo de IA",
  "/auditoria": "Auditoría",
  "/mi-perfil": "Mi perfil",
  "/sesiones-clase": "Sesiones de clase",
  "/configuracion": "Configuración institucional",
};

export default function Topbar() {
  const { usuario } = useAuth();
  const { alternar } = useSidebar();
  const { theme, toggle, auto, setAuto } = useTheme();
  const location = useLocation();
  const title = TITLES_BY_PATH[location.pathname] || "";
  const initials = ((usuario?.first_name?.[0] ?? "") + (usuario?.last_name?.[0] ?? "")).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur border-b border-border flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={alternar}
          className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground w-64">
          <Search size={14} />
          <span className="truncate">Buscar...</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            title={auto ? "Auto-tema activado — clic para desactivar" : theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            aria-label="Alternar tema"
          >
            {auto ? <Clock size={18} className="text-primary" /> : theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setAuto(!auto)}
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${auto ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title={auto ? "Desactivar modo automático día/noche" : "Activar modo automático (6am-6pm claro, 6pm-6am oscuro)"}
          >
            Auto
          </button>
        </div>

        <div className="p-2 rounded-md hover:bg-muted transition-colors">
          <CampanaNotificaciones />
        </div>

        <div className="flex items-center gap-2.5 pl-2 border-l border-border ml-1">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            {initials}
          </div>
          <div className="hidden sm:block text-right leading-tight">
            <div className="text-xs font-medium">{usuario?.first_name} {usuario?.last_name}</div>
            <div className="text-[10px] text-muted-foreground">
              {usuario?.rol ? ROL_LABELS[usuario.rol] : ""}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
