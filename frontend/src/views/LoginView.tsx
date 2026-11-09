import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  School,
  KeyRound,
  HelpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useInstitucion } from "../context/InstitucionContext";
import LoginForm from "../components/auth/LoginForm";
import type { LoginCredentials } from "../types";

export default function LoginView() {
  const { login, isAuthenticated } = useAuth();
  const { theme, toggle } = useTheme();
  const institucion = useInstitucion();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [logoError, setLogoError] = useState(false);

  const nombreColegio = institucion.nombre?.trim() || "Institución Educativa";
  const siglaColegio = institucion.sigla?.trim() || "I.E.";
  const anioLectivo = institucion.anio_lectivo_activo || new Date().getFullYear();

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  async function handleLogin(credentials: LoginCredentials) {
    setError("");
    try {
      await login(credentials);
      navigate("/", { replace: true });
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError(
          "Por seguridad, el acceso está temporalmente bloqueado tras varios intentos fallidos. Espera 5 minutos o contacta a Secretaría si requieres apoyo."
        );
      } else {
        setError("Usuario o contraseña incorrectos. Revisa tus credenciales.");
      }
    }
  }

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* ─────────────────────────────────────────────────────────────
          Barra Superior: Identidad + Toggle de Tema de 40px (WCAG Touch Target)
          ───────────────────────────────────────────────────────────── */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 overflow-hidden">
            {institucion.logo_url && !logoError ? (
              <img
                src={institucion.logo_url}
                alt="Logo"
                onError={() => setLogoError(true)}
                className="w-full h-full object-contain p-0.5 bg-white"
              />
            ) : (
              siglaColegio || <School size={19} />
            )}
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white block sm:inline">
              {nombreColegio}
            </span>
            <span className="hidden sm:inline-block text-xs text-slate-500 dark:text-slate-400 ml-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              Intranet Académica
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge Año Escolar */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium">
            <span>Periodo {anioLectivo}</span>
          </div>

          {/* Botón Alternar Tema con área táctil cómoda de 40x40px */}
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shadow-xs"
          >
            {theme === "dark" ? (
              <Sun size={18} className="text-amber-400" />
            ) : (
              <Moon size={18} className="text-slate-600" />
            )}
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          Cuerpo Central: Tarjeta Centrada Antifatiga Visual
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-[460px] space-y-5">
          {/* Tarjeta de Formulario Principal */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-7 sm:p-9 shadow-md shadow-slate-200/50 dark:shadow-none space-y-6 transition-all">
            {/* Cabecera del Formulario */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-xs mb-3 overflow-hidden p-2">
                {institucion.logo_url && !logoError ? (
                  <img
                    src={institucion.logo_url}
                    alt={nombreColegio}
                    onError={() => setLogoError(true)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <School size={28} className="text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Iniciar Sesión
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-normal">
                Ingresa con las credenciales entregadas por el colegio.
              </p>
            </div>

            {/* Formulario */}
            <LoginForm onSubmit={handleLogin} error={error} />

            {/* Recuperación de Contraseña Unificada */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
              <Link
                to="/recuperar-con-codigo"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center justify-center gap-1.5 py-1"
              >
                <KeyRound size={13} />
                <span>¿Olvidaste tu contraseña?</span>
              </Link>
            </div>
          </div>

          {/* Reaseguro y Mesa de Ayuda Escolar */}
          <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800/70 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400 shadow-2xs">
            <HelpCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              ¿Problemas para acceder? Comunícate con la Secretaría del colegio o Coordinación Académica.
            </div>
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          Pie de Página Discreto
          ───────────────────────────────────────────────────────────── */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-500 gap-2">
        <div>© {anioLectivo} {nombreColegio} · Sistema de Gestión Escolar</div>
        <div>Uso exclusivo para la comunidad educativa autorizada</div>
      </footer>
    </div>
  );
}