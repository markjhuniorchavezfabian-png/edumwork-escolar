import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { School, Shield, Sparkles, GraduationCap, KeyRound, Mail } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useInstitucion } from "../context/InstitucionContext";
import LoginForm from "../components/auth/LoginForm";
import type { LoginCredentials } from "../types";

export default function LoginView() {
  const { login, isAuthenticated } = useAuth();
  const institucion = useInstitucion();
  const navigate = useNavigate();
  const [error, setError] = useState("");

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
        setError("Cuenta bloqueada por demasiados intentos fallidos. Espera 5 minutos e intenta de nuevo.");
      } else {
        setError("Credenciales inválidas. Verifica tu usuario y contraseña.");
      }
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Panel izquierdo — branding institucional */}
      <div className="hidden lg:flex relative flex-col justify-between p-10 bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)`,
            backgroundSize: "60px 60px, 90px 90px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center font-bold text-lg ring-1 ring-white/20">
            {institucion.sigla || <School size={22} />}
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold">
              {institucion.nombre || "Sistema TIC"}
            </div>
            <div className="text-xs text-primary-foreground/70">
              Plataforma escolar integrada
            </div>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Gestión escolar moderna, en un solo lugar.
          </h2>
          <p className="text-primary-foreground/80 leading-relaxed">
            Asistencia, notas, boletas, convivencia, aula virtual y comunicación con familias — alineado a normativa MINEDU 2026.
          </p>

          <div className="grid gap-3 pt-2">
            {[
              { icon: GraduationCap, label: "Boletas PDF oficiales", desc: "Con notas por bimestre y área curricular" },
              { icon: Shield, label: "Protocolos SíseVe", desc: "Convivencia con plazos legales automáticos" },
              { icon: Sparkles, label: "Asistente de IA opcional", desc: "Con tu propia clave (BYOK). Los datos no salen del colegio." },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-white/10 backdrop-blur flex items-center justify-center shrink-0 ring-1 ring-white/20">
                  <f.icon size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold">{f.label}</div>
                  <div className="text-xs text-primary-foreground/70">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-primary-foreground/60">
          <div>© {new Date().getFullYear()} EduMWork · Perú</div>
          {institucion.email_institucional && (
            <div className="mt-1 opacity-80">{institucion.email_institucional}</div>
          )}
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
              {institucion.sigla || <School size={18} />}
            </div>
            <div>
              <div className="text-sm font-semibold">{institucion.nombre || "Sistema TIC"}</div>
              <div className="text-xs text-muted-foreground">EduMWork</div>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Bienvenido/a</h1>
            <p className="text-sm text-muted-foreground">
              Ingresa con tu usuario institucional.
            </p>
          </div>

          <LoginForm onSubmit={handleLogin} error={error} />

          <div className="flex flex-col gap-2 text-center text-xs">
            <Link to="/recuperar-con-codigo" className="text-primary hover:underline inline-flex items-center justify-center gap-1.5">
              <KeyRound size={12} /> Recuperar con código de la I.E.
            </Link>
            <Link to="/reset-password" className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5">
              <Mail size={11} /> ¿Olvidaste tu contraseña? (por email)
            </Link>
          </div>

          <div className="pt-6 border-t border-border text-center text-[11px] text-muted-foreground">
            ¿Problemas para ingresar? Contacta al Admin TIC del colegio.
          </div>
        </div>
      </div>
    </div>
  );
}
