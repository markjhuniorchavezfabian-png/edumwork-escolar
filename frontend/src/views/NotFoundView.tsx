import { Link } from "react-router-dom";
import { useInstitucion } from "../context/InstitucionContext";

export default function NotFoundView() {
  const institucion = useInstitucion();
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: 24,
      background: "var(--fondo, #f8fafc)",
    }}>
      <div style={{
        fontSize: 96, fontWeight: 700, color: "var(--azul-600)",
        lineHeight: 1, marginBottom: 8,
      }}>404</div>
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Página no encontrada</h1>
      <p style={{ fontSize: 14, color: "var(--texto-mute)", maxWidth: 420, marginBottom: 24 }}>
        La ruta que intentas visitar no existe o fue movida. Revisa el enlace o vuelve al inicio.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Link to="/" className="btn btn-primario" style={{ width: "auto", padding: "10px 18px" }}>
          Ir al inicio
        </Link>
        <button
          className="btn btn-secundario"
          style={{ width: "auto", padding: "10px 18px" }}
          onClick={() => window.history.back()}
        >
          Volver atrás
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--texto-mute)", marginTop: 32 }}>
        Sistema TIC · {institucion.nombre}
        {institucion.email_institucional && (
          <span style={{ display: "block", marginTop: 4 }}>{institucion.email_institucional}</span>
        )}
      </p>
    </div>
  );
}
