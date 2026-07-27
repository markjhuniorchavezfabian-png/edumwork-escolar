/**
 * Pantalla pública para aceptar una invitación de integración a I.E.
 * Ruta: /aceptar-invitacion/:token
 *
 * 2 flujos:
 *  A. Ya tiene cuenta personal → solo confirmar (login automático post-aceptación)
 *  B. Cuenta nueva → pide username + password + nombre completo
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { School, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import axios from "axios";
import { API_BASE_URL } from "../constants/env";
import { useAuth } from "../hooks/useAuth";

interface InvitacionInfo {
  valida: boolean;
  estado?: string;
  email: string;
  invitado_por?: string;
  area_sugerida?: string;
  mensaje?: string;
  existe_cuenta_previa?: boolean;
  expira_en?: string;
}

export default function AceptarInvitacionView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { setSession } = useAuth() as { setSession?: (a: string, r: string) => void };
  const [info, setInfo] = useState<InvitacionInfo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    username: "", password: "", first_name: "", last_name: "",
  });

  useEffect(() => {
    if (!token) return;
    axios.get<InvitacionInfo>(`${API_BASE_URL}/auth/invitacion/${token}/`)
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo({ valida: false, email: "" }))
      .finally(() => setCargando(false));
  }, [token]);

  async function aceptar() {
    if (!token || !info) return;
    setEnviando(true); setError("");
    try {
      const body: Record<string, string> = { token };
      if (!info.existe_cuenta_previa) {
        Object.assign(body, form);
      }
      const { data } = await axios.post<{ access: string; refresh: string; mensaje: string }>(
        `${API_BASE_URL}/auth/aceptar-invitacion/`, body,
      );
      // Guardar sesión y redirigir
      if (setSession) {
        setSession(data.access, data.refresh);
      } else {
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
      }
      navigate("/");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
        ?? "No se pudo aceptar la invitación.";
      setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!info?.valida) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-destructive mb-4" />
          <h1 className="text-xl font-bold mb-2">Invitación no válida</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {info?.estado === "aceptada" && "Esta invitación ya fue aceptada."}
            {info?.estado === "expirada" && "Esta invitación expiró. Pide una nueva al director."}
            {info?.estado === "rechazada" && "Esta invitación fue rechazada."}
            {!info?.estado && "No encontramos esta invitación. Revisa el link."}
          </p>
          <button onClick={() => navigate("/login")}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">
            Ir a inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="max-w-md w-full bg-card rounded-xl border border-border overflow-hidden">
        <div className="bg-primary text-primary-foreground p-6 text-center">
          <School size={40} className="mx-auto mb-3" />
          <h1 className="text-xl font-bold">Invitación a integrarte</h1>
          <p className="text-sm opacity-90 mt-1">
            {info.invitado_por} te invita al colegio
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-muted rounded-lg p-3 text-sm">
            <div><strong>Email:</strong> {info.email}</div>
            {info.area_sugerida && <div><strong>Área:</strong> {info.area_sugerida}</div>}
          </div>

          {info.mensaje && (
            <div className="border-l-4 border-primary pl-3 py-1 text-sm italic text-muted-foreground">
              "{info.mensaje}"
            </div>
          )}

          {info.existe_cuenta_previa ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
              <CheckCircle2 size={16} className="inline mr-2" />
              Detectamos tu cuenta personal. Al aceptar, tus datos existentes (secciones, alumnos, notas) quedarán integrados al colegio sin migrar nada.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Crea tu cuenta para el sistema del colegio:
              </p>
              <input placeholder="Nombres" value={form.first_name}
                onChange={e => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm" />
              <input placeholder="Apellidos" value={form.last_name}
                onChange={e => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm" />
              <input placeholder="Usuario (ej: juan.perez)" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm" />
              <input placeholder="Contraseña" type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm" />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button onClick={aceptar} disabled={enviando}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {enviando ? "Procesando..." : "Aceptar e integrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
