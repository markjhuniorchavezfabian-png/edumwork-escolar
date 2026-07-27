import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginView from "./views/LoginView";
import DashboardView from "./views/DashboardView";
import IncidenciasView from "./views/IncidenciasView";
import AsistenciaView from "./views/AsistenciaView";
import ImprimirQRsView from "./views/asistencia/ImprimirQRsView";
import InventarioView from "./views/InventarioView";
import VisitasView from "./views/VisitasView";
import AuditoriaView from "./views/AuditoriaView";
import UsuariosView from "./views/gestion/UsuariosView";
import SeccionesView from "./views/gestion/SeccionesView";
import MiPerfilView from "./views/gestion/MiPerfilView";
import ImportMasivoView from "./views/gestion/ImportMasivoView";
import PanelFamiliarView from "./views/PanelFamiliarView";
import JustificacionesView from "./views/JustificacionesView";
import CargarNotasView from "./views/CargarNotasView";
import GestionNotasView from "./views/GestionNotasView";
import SesionesClaseView from "./views/SesionesClaseView";
import ComunicadosView from "./views/ComunicadosView";
import ConvivenciaView from "./views/ConvivenciaView";
import RegistroVisitaPublicoView from "./views/RegistroVisitaPublicoView";
import ResetPasswordView from "./views/ResetPasswordView";
import ReservasView from "./views/ReservasView";
import AsistenciaPersonalView from "./views/AsistenciaPersonalView";
import ConfigIAView from "./views/ia/ConfigIAView";
import CostosIAView from "./views/ia/CostosIAView";
import MiConfigIAView from "./views/ia/MiConfigIAView";
import NotFoundView from "./views/NotFoundView";
import OnboardingView from "./views/OnboardingView";
import ConfiguracionView from "./views/gestion/ConfiguracionView";
import VersionesView from "./views/VersionesView";
import RecuperarConCodigoView from "./views/RecuperarConCodigoView";
import AceptarInvitacionView from "./views/AceptarInvitacionView";
import InvitarDocenteView from "./views/InvitarDocenteView";
import AulaVirtualView from "./views/aula/AulaVirtualView";
import CursoDetalleView from "./views/aula/CursoDetalleView";
import AmbientePublicoView from "./views/ambientes/AmbientePublicoView";
import AmbientesGestionView from "./views/ambientes/AmbientesGestionView";
import FichaEstudianteView from "./views/gestion/FichaEstudianteView";
import ListaFichasView from "./views/gestion/ListaFichasView";
import AsignacionesDocenteView from "./views/gestion/AsignacionesDocenteView";
import EditarCurriculoView from "./views/EditarCurriculoView";
import CalendarioView from "./views/CalendarioView";
import MatriculaView from "./views/MatriculaView";
import AlertasView from "./views/AlertasView";
import HorarioView from "./views/HorarioView";
import InformesView from "./views/InformesView";
import { ModoUIProvider } from "./hooks/useModoUI";
import { SidebarProvider } from "./hooks/useSidebar";
import { InstitucionProvider } from "./context/InstitucionContext";
import UnauthorizedView from "./views/UnauthorizedView";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <InstitucionProvider>
      <ModoUIProvider>
      <SidebarProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/unauthorized" element={<UnauthorizedView />} />
          <Route path="/registro-visita/:token" element={<RegistroVisitaPublicoView />} />
          <Route path="/reset-password" element={<ResetPasswordView />} />
          <Route path="/recuperar-con-codigo" element={<RecuperarConCodigoView />} />
          <Route path="/aceptar-invitacion/:token" element={<AceptarInvitacionView />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingView />
              </ProtectedRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardView />} />
            <Route path="/incidencias" element={<IncidenciasView />} />
            <Route path="/asistencia" element={<AsistenciaView />} />
            <Route path="/asistencia/qrs" element={<ImprimirQRsView />} />
            <Route path="/inventario" element={<InventarioView />} />
            <Route path="/visitas" element={<VisitasView />} />
            <Route path="/auditoria" element={<AuditoriaView />} />
            <Route path="/usuarios" element={<UsuariosView />} />
            <Route path="/secciones" element={<SeccionesView />} />
            <Route path="/configuracion" element={<ConfiguracionView />} />
            <Route path="/invitar-docente" element={<InvitarDocenteView />} />
            <Route path="/versiones" element={<VersionesView />} />
            <Route path="/mi-perfil" element={<MiPerfilView />} />
            <Route path="/importar" element={<ImportMasivoView />} />
            <Route path="/familia" element={<PanelFamiliarView />} />
            <Route path="/justificaciones" element={<JustificacionesView />} />
            <Route path="/cargar-notas" element={<CargarNotasView />} />
            <Route path="/notas" element={<GestionNotasView />} />
            <Route path="/asignaciones-docentes" element={<AsignacionesDocenteView />} />
            <Route path="/editar-curriculo" element={<EditarCurriculoView />} />
            <Route path="/calendario" element={<CalendarioView />} />
            <Route path="/informes" element={<InformesView />} />
            <Route path="/alertas" element={<AlertasView />} />
            <Route path="/horario" element={<HorarioView />} />
            <Route path="/sesiones-clase" element={<SesionesClaseView />} />
            <Route path="/comunicados" element={<ComunicadosView />} />
            <Route path="/convivencia" element={<ConvivenciaView />} />
            <Route path="/reservas" element={<ReservasView />} />
            <Route path="/asistencia-personal" element={<AsistenciaPersonalView />} />
            <Route path="/asistencia-staff" element={<AsistenciaPersonalView modoGestion />} />
            <Route path="/config-ia" element={<ConfigIAView />} />
            <Route path="/costos-ia" element={<CostosIAView />} />
            <Route path="/mi-ia" element={<MiConfigIAView />} />
            <Route path="/aprender" element={<AulaVirtualView />} />
            <Route path="/aprender/:id" element={<CursoDetalleView />} />
            <Route path="/ambiente/:codigo" element={<AmbientePublicoView />} />
            <Route path="/ambientes" element={<AmbientesGestionView />} />
            <Route path="/matricula" element={<MatriculaView />} />
            <Route path="/estudiantes" element={<ListaFichasView />} />
            <Route path="/estudiantes/:id" element={<FichaEstudianteView />} />
          </Route>
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </BrowserRouter>
      </SidebarProvider>
      </ModoUIProvider>
      </InstitucionProvider>
    </AuthProvider>
  );
}
