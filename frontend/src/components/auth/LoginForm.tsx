import { useState, useEffect, type FormEvent } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  AlertCircle,
  GraduationCap,
  Users,
  Check,
} from "lucide-react";
import type { LoginCredentials } from "../../types";

interface Props {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  error?: string;
}

type RoleTab = "docente" | "estudiante";

const STORAGE_KEY_USER = "edumwork_saved_username";
const STORAGE_KEY_REMEMBER = "edumwork_remember_me";

export default function LoginForm({ onSubmit, error }: Props) {
  const [roleTab, setRoleTab] = useState<RoleTab>("docente");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      const savedRemember = localStorage.getItem(STORAGE_KEY_REMEMBER) === "true";
      if (savedUser && savedRemember) {
        setUsername(savedUser);
        setRememberMe(true);
      }
    } catch {
      // localStorage no disponible
    }
  }, []);

  // Limpiar error de validación local al cambiar de perfil o tipear
  function handleRoleChange(newRole: RoleTab) {
    setRoleTab(newRole);
    setValidationError(null);
  }

  function handleUsernameChange(val: string) {
    // Si son solo dígitos, limitar a 8 dígitos de DNI; si incluye letras permite alias
    if (roleTab === "estudiante" && /^\d+$/.test(val)) {
      setUsername(val.slice(0, 8));
    } else {
      setUsername(val);
    }
    if (validationError) setValidationError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) return;

    // Validación local del DNI sugerida por auditoría Manus
    if (roleTab === "estudiante" && /^\d+$/.test(cleanUser) && cleanUser.length !== 8) {
      setValidationError("El número de DNI debe contener exactamente 8 dígitos numéricos.");
      return;
    }

    try {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY_USER, cleanUser);
        localStorage.setItem(STORAGE_KEY_REMEMBER, "true");
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_REMEMBER);
      }
    } catch {
      // localStorage no disponible
    }

    setCargando(true);
    try {
      await onSubmit({ username: cleanUser, password });
    } finally {
      setCargando(false);
    }
  }

  const activeError = validationError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Selector de perfil con áreas táctiles cómodas (Sugerencia Manus/Mobbin) */}
      <div
        role="tablist"
        aria-label="Perfil de acceso"
        className="p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl grid grid-cols-2 gap-1 border border-slate-200/70 dark:border-slate-700/70"
      >
        <button
          type="button"
          role="tab"
          aria-selected={roleTab === "docente"}
          onClick={() => handleRoleChange("docente")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
            roleTab === "docente"
              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <Users size={15} />
          <span>Personal del Colegio</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={roleTab === "estudiante"}
          onClick={() => handleRoleChange("estudiante")}
          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
            roleTab === "estudiante"
              ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/60 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <GraduationCap size={15} />
          <span>Estudiante / Apoderado</span>
        </button>
      </div>

      {/* Campo Identificador: Usuario o DNI */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="username" className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {roleTab === "docente" ? "Usuario o Correo" : "Número de DNI o Usuario"}
          </label>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {roleTab === "docente" ? "ej. director o lperez" : "DNI 8 dígitos o usuario"}
          </span>
        </div>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
            {roleTab === "docente" ? <User size={16} /> : <GraduationCap size={16} />}
          </div>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            enterKeyHint="next"
            maxLength={60}
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            required
            placeholder={roleTab === "docente" ? "director" : "DNI (ej: 45678901) o usuario"}
            className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Campo Contraseña */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Contraseña
          </label>
        </div>
        <div className="relative group">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
            <Lock size={16} />
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            enterKeyHint="go"
            placeholder="••••••••••••"
            className="w-full h-11 pl-10 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-xs"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Recordar en este equipo */}
      <div className="flex items-center justify-between pt-0.5">
        <label
          htmlFor="remember-me"
          className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              rememberMe
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            }`}
          >
            {rememberMe && <Check size={12} strokeWidth={3} />}
          </div>
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="sr-only"
          />
          <span className="text-[11px] sm:text-xs">
            Recordar usuario en este equipo <span className="text-slate-400 dark:text-slate-500">(no guarda contraseña)</span>
          </span>
        </label>
      </div>

      {/* Banner de error accesible */}
      {activeError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3.5 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="leading-snug">{activeError}</div>
        </div>
      )}

      {/* Botón de envío */}
      <button
        type="submit"
        disabled={cargando}
        className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {cargando ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Ingresando...
          </>
        ) : (
          <>
            <LogIn size={16} /> Ingresar
          </>
        )}
      </button>
    </form>
  );
}