import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import DocenteView from "./incidencias/DocenteView";
import AdminView from "./incidencias/AdminView";
import DirectorView from "./incidencias/DirectorView";

export default function IncidenciasView() {
  const { usuario } = useAuth();

  if (!usuario) return <Navigate to="/login" replace />;

  switch (usuario.rol) {
    case "docente":
      return <DocenteView />;
    case "admin_tic":
      return <AdminView />;
    case "director":
      return <DirectorView />;
    default:
      return <Navigate to="/unauthorized" replace />;
  }
}
