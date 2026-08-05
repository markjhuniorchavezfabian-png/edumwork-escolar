import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useInstitucion } from "../../context/InstitucionContext";
import { cambiarPasswordPropio, consentirDatos } from "../../services/gestion";
import Card from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import Icon from "../../components/ui/Icon";
import api from "../../services/api";

export default function MiPerfilView() {
  const { usuario } = useAuth();
  const institucion = useInstitucion();
  const toast = useToast();

  const [modoCuenta, setModoCuenta] = useState<string>("");
  const [integradoEn, setIntegradoEn] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    api.get<{ modo_cuenta: string; integrado_a_ie_en: string | null }>("/auth/mi-cuenta/")
      .then(({ data }) => {
        setModoCuenta(data.modo_cuenta);
        setIntegradoEn(data.integrado_a_ie_en);
      })
      .catch(() => { /* silencioso */ });
  }, []);

  async function descargarBackup() {
    setDescargando(true);
    try {
      const resp = await api.get("/auth/mi-backup/", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `mi_backup_${usuario?.username}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.ok("Backup descargado.");
    } catch {
      toast.error("Error al descargar backup.");
    } finally {
      setDescargando(false);
    }
  }

  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [passConfirmar, setPassConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [consintiendo, setConsintiendo] = useState(false);

  async function cambiar() {
    if (passNueva !== passConfirmar) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (passNueva.length < 6) {
      toast.error("Mínimo 6 caracteres.");
      return;
    }
    setEnviando(true);
    try {
      await cambiarPasswordPropio(passActual, passNueva);
      toast.ok("Contraseña actualizada.");
      setPassActual(""); setPassNueva(""); setPassConfirmar("");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? "Error al cambiar contraseña.");
    } finally {
      setEnviando(false);
    }
  }

  async function consentir() {
    setConsintiendo(true);
    try {
      await consentirDatos();
      toast.ok("Consentimiento registrado.");
    } catch {
      toast.error("Error al registrar consentimiento.");
    } finally {
      setConsintiendo(false);
    }
  }

  return (
    <div className="dashboard">
      <h2 className="page-title">Mi perfil</h2>

      <Card titulo="Datos de mi cuenta">
        <p><strong>Nombre:</strong> {usuario?.first_name} {usuario?.last_name}</p>
        <p><strong>Usuario:</strong> <code>{usuario?.username}</code></p>
        <p><strong>Rol:</strong> {usuario?.rol}</p>
        {usuario?.dni && <p><strong>DNI:</strong> {usuario.dni}</p>}

        {/* Último acceso — para detectar si alguien más entró */}
        {(usuario as { ultimo_acceso_en?: string; ultimo_acceso_ip?: string })?.ultimo_acceso_en && (
          <div style={{
            marginTop: 14, padding: "10px 12px", background: "var(--fondo)",
            border: "1px solid var(--borde)", borderRadius: 8, fontSize: 12,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--muted-foreground)" }}>
              Último acceso registrado
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="calendario" size={13} />
              {new Date((usuario as { ultimo_acceso_en?: string }).ultimo_acceso_en!).toLocaleString("es-PE", {
                dateStyle: "full", timeStyle: "short"
              })}
            </div>
            {(usuario as { ultimo_acceso_ip?: string }).ultimo_acceso_ip && (
              <div style={{ color: "var(--muted-foreground)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="ubicacion" size={13} /> IP: {(usuario as { ultimo_acceso_ip?: string }).ultimo_acceso_ip}
              </div>
            )}
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
              Si no reconoces este acceso, cambia tu contraseña inmediatamente y avisa al director.
            </div>
          </div>
        )}
      </Card>

      <Card titulo="Cambiar mi contraseña">
        <div className="form-field">
          <label className="form-label">Contraseña actual</label>
          <input type="password" className="form-input" value={passActual} onChange={(e) => setPassActual(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">Nueva contraseña</label>
          <input type="password" className="form-input" value={passNueva} onChange={(e) => setPassNueva(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-label">Confirmar nueva contraseña</label>
          <input type="password" className="form-input" value={passConfirmar} onChange={(e) => setPassConfirmar(e.target.value)} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn btn-primario" onClick={cambiar} disabled={enviando || !passActual || !passNueva} style={{ width: "auto" }}>
            {enviando ? "Actualizando..." : "Cambiar contraseña"}
          </button>
        </div>
      </Card>

      {(modoCuenta === "personal" || integradoEn) && (
        <Card titulo="Mi cuenta y datos">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div>
              <strong>Modo:</strong>{" "}
              {modoCuenta === "personal"
                ? <span style={{ background: "#DBEAFE", color: "#1E40AF", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Personal (sub-app)</span>
                : <span style={{ background: "#D1FAE5", color: "#065F46", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Institucional</span>}
            </div>
            {integradoEn && (
              <div style={{ fontSize: 12, color: "var(--texto-mute)" }}>
                Integrado al colegio: {new Date(integradoEn).toLocaleDateString()}
              </div>
            )}
            {modoCuenta === "personal" && (
              <>
                <p style={{ fontSize: 12, color: "var(--texto-mute)", marginTop: 4 }}>
                  Tus datos son tuyos. Descárgalos en JSON para tener respaldo o para dárselos a tu colegio si te integra al sistema.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
                  <button className="btn btn-secundario" onClick={descargarBackup} disabled={descargando} style={{ width: "auto" }}>
                    <Icon name="descargar" size={14} /> {descargando ? "Preparando..." : "Descargar mi backup (.json)"}
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {usuario?.rol === "padre" && (
        <Card titulo="Consentimiento — Ley 29733">
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>
            Como padre/madre/tutor, autoriza usted el tratamiento de los datos personales de sus hijos
            para fines educativos exclusivos de {institucion.nombre}, conforme a la Ley N° 29733
            (Ley de Protección de Datos Personales) y su reglamento.
          </p>
          <p style={{ fontSize: 12, color: "var(--texto-mute)", marginTop: 8 }}>
            Los datos serán utilizados exclusivamente para: asistencia, calificaciones, comunicaciones
            institucionales, seguimiento pedagógico y reportes a UGEL.
            {institucion.email_institucional && (
              <span style={{ display: "block", marginTop: 6 }}>
                Consultas: <a href={`mailto:${institucion.email_institucional}`}>{institucion.email_institucional}</a>
              </span>
            )}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="btn btn-primario" onClick={consentir} disabled={consintiendo} style={{ width: "auto" }}>
              {consintiendo ? "Registrando..." : "Otorgar consentimiento"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
