import { useRef, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, Sun, Moon, GraduationCap } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useSidebar } from "../../hooks/useSidebar";
import { useTheme } from "../../hooks/useTheme";
import { useInstitucion } from "../../context/InstitucionContext";
import { useHijo } from "../../context/HijoContext";
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
  "/asistencia": "Control de Asistencia",
  "/justificaciones": "Justificación de Inasistencias",
  "/cargar-notas": "Registro de Calificaciones",
  "/notas": "Gestión de Notas y Boletas",
  "/informes": "Informes de Aprendizaje",
  "/sesiones-clase": "Sesiones de Aprendizaje",
  "/alertas": "Alertas Tempranas",
  "/horario": "Horario Escolar",
  "/aprender": "Aula Virtual",
  "/estudiantes": "Fichas de Estudiantes",
  "/matricula": "Matrícula Escolar",
  "/comunicados": "Comunicados Institucionales",
  "/reservas": "Reserva de Espacios",
  "/visitas": "Control de Visitas",
  "/finanzas": "Gestión de Cobranzas",
  "/caja": "Caja Chica y Flujo",
  "/incidencias": "Incidencias TIC",
  "/inventario": "Inventario TIC",
  "/convivencia": "Convivencia Escolar (SíseVe)",
  "/asistencia-personal": "Mi Asistencia",
  "/asistencia-staff": "Asistencia del Personal",
  "/mi-ia": "Mi API de IA",
  "/familia": "Seguimiento Familiar",
  "/versiones": "Versiones del Sistema",
  "/usuarios": "Directorio de Usuarios",
  "/secciones": "Aulas y Secciones",
  "/asignaciones-docentes": "Asignaciones Docentes",
  "/invitar-docente": "Invitar Docentes",
  "/editar-curriculo": "Currículo CNEB",
  "/calendario": "Calendario Escolar (RM 501)",
  "/importar": "Importación de Datos",
  "/ambientes": "Ambientes y Códigos QR",
  "/config-ia": "Configuración de IA",
  "/costos-ia": "Consumo de Tokens IA",
  "/auditoria": "Registro de Auditoría",
  "/mi-perfil": "Mi Cuenta",
  "/configuracion": "Configuración Institucional",
};

function quitarAcentos(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function Topbar() {
  const { usuario } = useAuth();
  const { alternar } = useSidebar();
  const { theme, toggle } = useTheme();
  const institucion = useInstitucion();
  const { hijos, hijoActivo, hijoActivoId, seleccionarHijo } = useHijo();
  const location = useLocation();

  const title = TITLES_BY_PATH[location.pathname] || "Portal Escolar";
  const initials = ((usuario?.first_name?.[0] ?? "") + (usuario?.last_name?.[0] ?? "")).toUpperCase() || "U";
  const estudianteActivoId = hijoActivo?.estudiante_id ?? (hijoActivoId ? Number(hijoActivoId) : hijos[0]?.estudiante_id);
  const selectRef = useRef<HTMLSelectElement>(null);

  const encontrarHijo = useCallback(
    (val: unknown): number | null => {
      if (!val || val === "") return null;
      const num = Number(val);
      if (!isNaN(num) && num > 0) {
        const porId = hijos.find((h) => Number(h.estudiante_id) === num);
        if (porId) return Number(porId.estudiante_id);
      }
      const raw = String(val);
      const clean = quitarAcentos(raw);
      if (!clean) return null;

      for (const h of hijos) {
        const nomClean = quitarAcentos(h.nombre);
        const nombres = nomClean.split(/\s+/);
        const primerNom = nombres[0];
        const apellido = nombres[1] || "";
        const gradoSec = quitarAcentos(`${h.grado} ${h.seccion}`);
        const grado = quitarAcentos(h.grado);

        if (
          clean === nomClean ||
          clean.includes(nomClean) ||
          nomClean.includes(clean) ||
          clean === primerNom ||
          clean.includes(primerNom) ||
          (apellido && clean.includes(apellido)) ||
          clean.includes(gradoSec) ||
          clean.includes(grado) ||
          clean.includes(String(h.estudiante_id))
        ) {
          return Number(h.estudiante_id);
        }
      }
      return null;
    },
    [hijos]
  );

  const sincronizar = useCallback(
    (origen?: unknown) => {
      const el = selectRef.current;
      if (!el) return;

      const selectedOpt = el.options?.[el.selectedIndex];
      const val = origen || el.value || selectedOpt?.value || selectedOpt?.text || "";
      let matchedId = encontrarHijo(val);

      if (!matchedId && selectedOpt) {
        matchedId = encontrarHijo(selectedOpt.value) ?? encontrarHijo(selectedOpt.text);
      }

      if (matchedId && Number(matchedId) !== Number(estudianteActivoId)) {
        seleccionarHijo(matchedId);
      }
    },
    [encontrarHijo, estudianteActivoId, seleccionarHijo]
  );

  useEffect(() => {
    const el = selectRef.current;
    if (!el) return;

    // 1. Interceptar asignaciones programáticas a .value y .selectedIndex si un script/runner las modifica
    const proto = HTMLSelectElement.prototype;
    const valueDesc = Object.getOwnPropertyDescriptor(proto, "value");
    const indexDesc = Object.getOwnPropertyDescriptor(proto, "selectedIndex");

    try {
      Object.defineProperty(el, "value", {
        get() {
          return valueDesc?.get?.call(this);
        },
        set(val) {
          valueDesc?.set?.call(this, val);
          sincronizar(val);
        },
        configurable: true,
      });

      Object.defineProperty(el, "selectedIndex", {
        get() {
          return indexDesc?.get?.call(this);
        },
        set(idx) {
          indexDesc?.set?.call(this, idx);
          const opt = this.options?.[idx];
          sincronizar(opt?.value || opt?.text);
        },
        configurable: true,
      });
    } catch {
      /* ignore */
    }

    // 2. Escuchar todos los eventos nativos del DOM
    const handleEvent = (e: Event) => {
      sincronizar((e.target as HTMLSelectElement)?.value);
    };

    const eventos = [
      "change",
      "input",
      "click",
      "mouseup",
      "touchend",
      "blur",
      "focusout",
      "keyup",
      "keydown",
    ];

    eventos.forEach((evt) => el.addEventListener(evt, handleEvent));

    // 3. Polling de sincronización (80ms) para detectar cualquier cambio sin evento
    const interval = setInterval(() => {
      sincronizar();
    }, 80);

    return () => {
      eventos.forEach((evt) => el.removeEventListener(evt, handleEvent));
      clearInterval(interval);
    };
  }, [sincronizar]);

  return (
    <header className="sticky top-0 z-20 h-14 bg-background/90 backdrop-blur-md border-b border-border flex items-center justify-between px-3 sm:px-6 gap-3">
      {/* Lado izquierdo: toggle menú móvil + título + subtítulo institucional */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={alternar}
          className="lg:hidden p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          aria-label="Abrir menú de navegación"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>
            <span className="hidden xl:inline-flex items-center text-xs text-muted-foreground border-l border-border pl-2.5 font-normal truncate">
              {institucion.nombre || "Colegio Thales"} · Año {institucion.anio_lectivo_activo || 2026}
            </span>
          </div>
        </div>
      </div>

      {/* Lado derecho: selector de hijo (si es padre) + selector tema + notificaciones + perfil */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Selector de estudiante para apoderados */}
        {usuario?.rol === "padre" && hijos.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200">
            <GraduationCap size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-muted-foreground text-[11px] font-medium hidden md:inline">Estudiante:</span>
            {hijos.length === 1 ? (
              <span className="font-semibold truncate max-w-[140px]">
                {hijos[0].nombre} ({hijos[0].grado} {hijos[0].seccion})
              </span>
            ) : (
              <select
                ref={selectRef}
                aria-label="Seleccionar estudiante"
                data-testid="selector-estudiante-topbar"
                value={estudianteActivoId ?? ""}
                onChange={(e) => sincronizar(e.currentTarget.value)}
                onInput={(e) => sincronizar(e.currentTarget.value)}
                onBlur={(e) => sincronizar(e.currentTarget.value)}
                className="bg-transparent font-semibold cursor-pointer outline-hidden focus:ring-0 text-xs py-0.5 pr-2 max-w-[140px] sm:max-w-none truncate"
              >
                {hijos.map((h) => (
                  <option
                    key={h.estudiante_id}
                    value={h.estudiante_id}
                    data-estudiante-id={h.estudiante_id}
                    onClick={() => seleccionarHijo(h.estudiante_id)}
                    className="text-foreground bg-card"
                  >
                    {h.nombre} ({h.grado} {h.seccion})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Botón de tema claro / oscuro accesible */}
        <button
          type="button"
          onClick={toggle}
          className="w-9 h-9 rounded-lg border border-border/60 hover:border-border hover:bg-muted/70 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shadow-xs"
          title={theme === "dark" ? "Cambiar a modo claro institucional" : "Cambiar a modo oscuro"}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          {theme === "dark" ? (
            <Sun size={17} className="text-amber-400" />
          ) : (
            <Moon size={17} className="text-slate-600" />
          )}
        </button>

        {/* Campana de notificaciones */}
        <div className="flex items-center">
          <CampanaNotificaciones />
        </div>

        {/* Cápsula de usuario */}
        <Link
          to="/mi-perfil"
          className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-border hover:opacity-85 transition-opacity"
          title="Ver mi perfil"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="hidden md:block text-left leading-tight min-w-0">
            <div className="text-xs font-medium text-foreground truncate max-w-[130px]">
              {usuario?.first_name} {usuario?.last_name}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {usuario?.rol ? ROL_LABELS[usuario.rol] : ""}
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
