import { Link } from "react-router-dom";

export default function UnauthorizedView() {
  return (
    <div className="error-page">
      <h2>Acceso denegado</h2>
      <p>No tienes permiso para ver esta página.</p>
      <Link to="/">Volver al inicio</Link>
    </div>
  );
}
