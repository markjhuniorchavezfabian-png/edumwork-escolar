import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { useInstitucion } from "../context/InstitucionContext";
import { API_BASE_URL as BASE } from "../constants/env";

export default function ResetPasswordView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const institucion = useInstitucion();

  const [identificador, setIdentificador] = useState("");
  const [passNuevo, setPassNuevo] = useState("");
  const [passConfirmar, setPassConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  async function solicitar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMensaje(null);
    try {
      await axios.post(`${BASE}/usuarios/reset-password/solicitar/`, { identificador });
      setMensaje({ tipo: "ok", texto: "Si tu cuenta tiene un correo registrado, te enviamos un enlace (revisa tu bandeja)." });
    } catch {
      setMensaje({ tipo: "error", texto: "Error al procesar. Intenta más tarde." });
    } finally { setEnviando(false); }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (passNuevo !== passConfirmar) { setMensaje({ tipo: "error", texto: "Las contraseñas no coinciden." }); return; }
    if (passNuevo.length < 6) { setMensaje({ tipo: "error", texto: "Mínimo 6 caracteres." }); return; }
    setEnviando(true);
    setMensaje(null);
    try {
      await axios.post(`${BASE}/usuarios/reset-password/confirmar/`, { token, password_nuevo: passNuevo });
      setMensaje({ tipo: "ok", texto: "Contraseña actualizada. Redirigiendo al login..." });
      setTimeout(() => navigate("/login"), 1500);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setMensaje({ tipo: "error", texto: err.response?.data?.error ?? "Error." });
    } finally { setEnviando(false); }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-titulo">{institucion.nombre}</h1>
        <p className="login-subtitulo">Recuperar contraseña</p>

        {!token ? (
          <form onSubmit={solicitar}>
            <p style={{ fontSize: 13, marginBottom: 12, color: "var(--texto-mute)" }}>
              Ingresa tu usuario o correo. Te enviaremos un enlace para restablecer tu contraseña.
            </p>
            <div className="form-field">
              <label className="form-label">Usuario o correo</label>
              <input className="form-input" value={identificador} onChange={(e) => setIdentificador(e.target.value)} required autoFocus />
            </div>
            <button className="btn btn-primario" type="submit" disabled={enviando} style={{ width: "100%" }}>
              {enviando ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        ) : (
          <form onSubmit={confirmar}>
            <p style={{ fontSize: 13, marginBottom: 12, color: "var(--texto-mute)" }}>Ingresa tu nueva contraseña.</p>
            <div className="form-field">
              <label className="form-label">Nueva contraseña</label>
              <input type="password" className="form-input" value={passNuevo} onChange={(e) => setPassNuevo(e.target.value)} required autoFocus />
            </div>
            <div className="form-field">
              <label className="form-label">Confirmar</label>
              <input type="password" className="form-input" value={passConfirmar} onChange={(e) => setPassConfirmar(e.target.value)} required />
            </div>
            <button className="btn btn-primario" type="submit" disabled={enviando} style={{ width: "100%" }}>
              {enviando ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        )}

        {mensaje && (
          <p className={mensaje.tipo === "ok" ? "form-ok" : "form-error"} style={{ marginTop: 12 }}>{mensaje.texto}</p>
        )}

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link to="/login" style={{ fontSize: 12, color: "var(--azul-600)" }}>← Volver a iniciar sesión</Link>
        </div>
      </div>
    </div>
  );
}
