import { Navigate } from "react-router-dom";
import type { Rol } from "../../types";
import { useAuth } from "../../hooks/useAuth";

interface Props {
  roles: Rol[];
  children: React.ReactNode;
}

export default function RoleRoute({ roles, children }: Props) {
  const { tienePermiso, cargando } = useAuth();

  if (cargando) return <div className="loading">Cargando...</div>;
  if (!tienePermiso(roles)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
