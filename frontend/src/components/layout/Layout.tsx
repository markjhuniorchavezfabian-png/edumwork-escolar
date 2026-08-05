import { Outlet, useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Icon from "../ui/Icon";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import OnboardingModoUI from "./OnboardingModoUI";
import ErrorBoundary from "../ui/ErrorBoundary";
import AsistenteIA from "../ia/AsistenteIA";
import { useSidebar } from "../../hooks/useSidebar";
import { useAuth } from "../../hooks/useAuth";

export default function Layout() {
  const { abierta, cerrar } = useSidebar();
  const { usuario } = useAuth();
  const location = useLocation();

  useEffect(() => { cerrar(); }, [location.pathname, cerrar]);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />

      {abierta && (
        <div
          onClick={cerrar}
          className="lg:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        {usuario?.debe_cambiar_password && location.pathname !== "/mi-perfil" && (
          <div style={{
            background: "#FEF3C7", borderBottom: "1px solid #F59E0B",
            padding: "10px 20px", display: "flex", alignItems: "center",
            gap: 10, fontSize: 13,
          }}>
            <Icon name="candado" size={16} />
            <span style={{ flex: 1 }}>
              <strong>Estás usando la contraseña predeterminada.</strong>{" "}
              Por seguridad, cambiala antes de continuar.
            </span>
            <Link to="/mi-perfil" style={{
              background: "#F59E0B", color: "white", fontWeight: 700,
              padding: "5px 14px", borderRadius: 6, textDecoration: "none", fontSize: 12,
            }}>
              Cambiar ahora
            </Link>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
          {/* Contiene el fallo dentro del área de contenido: el menú sigue
              usable y la persona puede irse a otra pantalla sin recargar. */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <OnboardingModoUI />
      <AsistenteIA />
    </div>
  );
}
