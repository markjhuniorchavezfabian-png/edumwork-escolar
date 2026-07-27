import { useAuth } from "../hooks/useAuth";
import DocenteAsistenciaView from "./asistencia/DocenteAsistenciaView";
import PadreAsistenciaView from "./asistencia/PadreAsistenciaView";
import DirectorAsistenciaView from "./asistencia/DirectorAsistenciaView";

export default function AsistenciaView() {
  const { usuario } = useAuth();
  if (!usuario) return null;

  switch (usuario.rol) {
    case "docente":
    case "admin_tic":
      return <DocenteAsistenciaView />;
    case "padre":
      return <PadreAsistenciaView />;
    case "director":
      return <DirectorAsistenciaView />;
    default:
      return (
        <div className="card">
          <div className="card-body">
            <p>Este módulo no está habilitado para tu rol.</p>
          </div>
        </div>
      );
  }
}
