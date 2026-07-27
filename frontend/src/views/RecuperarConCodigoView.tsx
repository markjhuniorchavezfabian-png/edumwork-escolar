import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  KeyRound, User, Lock, ArrowLeft, Loader2, CheckCircle2, School,
} from "lucide-react";
import { useInstitucion } from "../context/InstitucionContext";
import { API_BASE_URL as BASE } from "../constants/env";

export default function RecuperarConCodigoView() {
  const institucion = useInstitucion();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (nueva.length < 8) { setErr("La contraseña debe tener al menos 8 caracteres."); return; }
    if (nueva !== confirmar) { setErr("Las contraseñas no coinciden."); return; }
    if (codigo.length !== 6) { setErr("El código debe tener 6 dígitos."); return; }

    setEnviando(true);
    try {
      await axios.post(`${BASE}/usuarios/reset-password/con-codigo/`, {
        username, codigo, nueva_password: nueva,
      });
      setOk(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e: unknown) {
      const ee = e as { response?: { data?: { error?: string } } };
      setErr(ee.response?.data?.error ?? "No se pudo actualizar. Verificá los datos.");
    } finally { setEnviando(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Panel izquierdo — branding */}
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
            <div className="text-lg font-semibold">{institucion.nombre || "Sistema TIC"}</div>
            <div className="text-xs text-primary-foreground/70">Recuperar contraseña</div>
          </div>
        </div>

        <div className="relative space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <KeyRound size={28} />
          </div>
          <h2 className="text-3xl font-bold leading-tight">
            Recuperar con código de la I.E.
          </h2>
          <p className="text-primary-foreground/80 leading-relaxed">
            Solicita al Admin TIC, Secretaría o Dirección de tu colegio que te genere
            un <strong>código de 6 dígitos</strong>. Ellos te lo envían por
            WhatsApp o teléfono, y con eso eliges tu nueva contraseña.
          </p>
        </div>

        <div className="relative text-xs text-primary-foreground/60">
          Los códigos expiran a los 15 minutos.
        </div>
      </div>

      {/* Panel derecho — form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
              {institucion.sigla || <School size={18} />}
            </div>
            <div>
              <div className="text-sm font-semibold">{institucion.nombre || "Sistema TIC"}</div>
              <div className="text-xs text-muted-foreground">Recuperar contraseña</div>
            </div>
          </div>

          <Link to="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft size={12} /> Volver al login
          </Link>

          {ok ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100">Contraseña actualizada</h2>
                <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80 mt-1">
                  Ya puedes iniciar sesión con tu nueva contraseña. Redirigiendo...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">Recuperar con código</h1>
                <p className="text-sm text-muted-foreground">
                  Ingresa el código que te dio la I.E. y elige tu nueva contraseña.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Usuario</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="tu.usuario"
                      className="w-full h-11 pl-10 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Código de 6 dígitos</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                      required
                      placeholder="000000"
                      className="w-full h-11 pl-10 pr-3 rounded-md border border-input bg-background text-lg font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nueva contraseña</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={nueva}
                      onChange={(e) => setNueva(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full h-11 pl-10 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Repite la contraseña"
                      className="w-full h-11 pl-10 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {err && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  {enviando ? "Actualizando..." : "Guardar nueva contraseña"}
                </button>
              </form>

              <div className="pt-6 border-t border-border text-center text-[11px] text-muted-foreground">
                ¿No tenés código? Contacta al Admin TIC o Secretaría de tu colegio.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
