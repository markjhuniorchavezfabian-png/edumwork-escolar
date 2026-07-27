import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Cargando } from "../components/ui/Spinner";
import { API_BASE_URL } from "../constants/env";

interface InfoCampana {
  campana_id: number;
  nombre: string;
  requiere_confirmacion: boolean;
  motivo_forzado: string;
  a_quien_visita_forzado: string;
  mensaje_bienvenida: string;
  motivos_disponibles: Array<{ codigo: string; etiqueta: string }>;
  instituto: string;
}

interface Resultado {
  ok: boolean;
  requiere_confirmacion: boolean;
  visita_id: number;
  codigo_gafete: string;
  mensaje: string;
}

const BASE = API_BASE_URL;

export default function RegistroVisitaPublicoView() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<InfoCampana | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [datos, setDatos] = useState({
    dni: "", nombre_completo: "", telefono: "",
    motivo: "apoderado", a_quien_visita: "", observaciones: "",
  });

  useEffect(() => {
    axios.get<InfoCampana>(`${BASE}/visitas/publico/${token}/info/`)
      .then(({ data }) => {
        setInfo(data);
        if (data.motivo_forzado) setDatos((d) => ({ ...d, motivo: data.motivo_forzado }));
        if (data.a_quien_visita_forzado) setDatos((d) => ({ ...d, a_quien_visita: data.a_quien_visita_forzado }));
      })
      .catch(() => setError("Este QR no está activo o es inválido."))
      .finally(() => setCargando(false));
  }, [token]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const { data } = await axios.post<Resultado>(`${BASE}/visitas/publico/${token}/registrar/`, datos);
      setResultado(data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Error al registrar.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <div className="pub-page"><Cargando inline /></div>;
  if (error) return <div className="pub-page"><div className="pub-card"><p className="form-error">{error}</p></div></div>;

  return (
    <div className="pub-page">
      <div className="pub-card">
        <div className="pub-header">
          <div className="brand-logo" style={{ margin: "0 auto 12px" }}>IE</div>
          <h1>{info?.instituto ?? "Institución Educativa"}</h1>
          <p className="pub-sub">Registro de visitantes · {info?.nombre}</p>
        </div>

        {resultado ? (
          <div className="pub-exito">
            <div style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>
              {resultado.requiere_confirmacion ? "⏳" : "✅"}
            </div>
            <h2>{resultado.requiere_confirmacion ? "Registro recibido" : "Bienvenido/a"}</h2>
            <p>{resultado.mensaje}</p>
            <div style={{ marginTop: 16, padding: 14, background: "var(--slate-50)", borderRadius: 8, fontSize: 12, textAlign: "center" }}>
              <p>Código de gafete:</p>
              <code style={{ fontSize: 14, fontWeight: 700, color: "var(--azul-800)" }}>{resultado.codigo_gafete.slice(0, 8).toUpperCase()}</code>
              <p style={{ marginTop: 8, color: "var(--texto-mute)" }}>
                Presente esta pantalla al personal de portería.
              </p>
            </div>
          </div>
        ) : (
          <>
            {info?.mensaje_bienvenida && (
              <div className="form-aviso" style={{ marginBottom: 16 }}>{info.mensaje_bienvenida}</div>
            )}

            <form onSubmit={registrar}>
              <div className="form-field">
                <label className="form-label">DNI *</label>
                <input
                  className="form-input"
                  inputMode="numeric"
                  maxLength={8}
                  value={datos.dni}
                  onChange={(e) => setDatos({ ...datos, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label">Nombre completo *</label>
                <input
                  className="form-input"
                  value={datos.nombre_completo}
                  onChange={(e) => setDatos({ ...datos, nombre_completo: e.target.value })}
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label">Teléfono (opcional)</label>
                <input
                  className="form-input"
                  inputMode="tel"
                  value={datos.telefono}
                  onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                />
              </div>
              {!info?.motivo_forzado && (
                <div className="form-field">
                  <label className="form-label">Motivo *</label>
                  <select className="form-input" value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })}>
                    {info?.motivos_disponibles.map((m) => <option key={m.codigo} value={m.codigo}>{m.etiqueta}</option>)}
                  </select>
                </div>
              )}
              {!info?.a_quien_visita_forzado && (
                <div className="form-field">
                  <label className="form-label">¿A quién visita? *</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Director, Tutora 5to A, Secretaría"
                    value={datos.a_quien_visita}
                    onChange={(e) => setDatos({ ...datos, a_quien_visita: e.target.value })}
                    required
                  />
                </div>
              )}
              <button type="submit" className="btn btn-primario" style={{ width: "100%", marginTop: 12 }} disabled={enviando}>
                {enviando ? "Registrando..." : "✓ Registrar mi ingreso"}
              </button>
            </form>
          </>
        )}

        <p style={{ marginTop: 20, fontSize: 11, color: "var(--texto-suave)", textAlign: "center" }}>
          Ley 29733: sus datos se usan solo para el control de visitas de la I.E.
        </p>
      </div>
    </div>
  );
}
