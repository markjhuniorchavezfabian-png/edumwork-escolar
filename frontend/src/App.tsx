import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./context/AuthContext";
import { HijoProvider } from "./context/HijoContext";
import { ModoUIProvider } from "./hooks/useModoUI";
import { SidebarProvider } from "./hooks/useSidebar";
import { InstitucionProvider } from "./context/InstitucionContext";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import LoginView from "./views/LoginView";

// Todo lo que no sea el login se carga bajo demanda.
//
// Antes las 47 vistas se importaban de forma estática: el primer ingreso bajaba
// ~1,7 MB de JavaScript —incluidos el escáner QR y las librerías de gráficos—
// aunque el usuario fuera un padre entrando desde el celular a ver una nota.
// Con `lazy` cada vista viaja en su propio chunk y solo se descarga al abrirla.
//
// Al agregar una vista nueva: sumala acá como `lazy(...)`, no con `import`.
const DashboardView = lazy(() => import("./views/DashboardView"));
const FinanzasView = lazy(() => import("./views/finanzas/FinanzasView"));
const CajaChicaView = lazy(() => import("./views/finanzas/CajaChicaView"));
const IncidenciasView = lazy(() => import("./views/IncidenciasView"));
const AsistenciaView = lazy(() => import("./views/AsistenciaView"));
const ImprimirQRsView = lazy(() => import("./views/asistencia/ImprimirQRsView"));
const InventarioView = lazy(() => import("./views/InventarioView"));
const VisitasView = lazy(() => import("./views/VisitasView"));
const AuditoriaView = lazy(() => import("./views/AuditoriaView"));
const UsuariosView = lazy(() => import("./views/gestion/UsuariosView"));
const SeccionesView = lazy(() => import("./views/gestion/SeccionesView"));
const MiPerfilView = lazy(() => import("./views/gestion/MiPerfilView"));
const ImportMasivoView = lazy(() => import("./views/gestion/ImportMasivoView"));
const PanelFamiliarView = lazy(() => import("./views/PanelFamiliarView"));
const JustificacionesView = lazy(() => import("./views/JustificacionesView"));
const CargarNotasView = lazy(() => import("./views/CargarNotasView"));
const GestionNotasView = lazy(() => import("./views/GestionNotasView"));
const SesionesClaseView = lazy(() => import("./views/SesionesClaseView"));
const ComunicadosView = lazy(() => import("./views/ComunicadosView"));
const ConvivenciaView = lazy(() => import("./views/ConvivenciaView"));
const RegistroVisitaPublicoView = lazy(() => import("./views/RegistroVisitaPublicoView"));
const ResetPasswordView = lazy(() => import("./views/ResetPasswordView"));
const ReservasView = lazy(() => import("./views/ReservasView"));
const AsistenciaPersonalView = lazy(() => import("./views/AsistenciaPersonalView"));
const ConfigIAView = lazy(() => import("./views/ia/ConfigIAView"));
const CostosIAView = lazy(() => import("./views/ia/CostosIAView"));
const MiConfigIAView = lazy(() => import("./views/ia/MiConfigIAView"));
const NotFoundView = lazy(() => import("./views/NotFoundView"));
const OnboardingView = lazy(() => import("./views/OnboardingView"));
const ConfiguracionView = lazy(() => import("./views/gestion/ConfiguracionView"));
const VersionesView = lazy(() => import("./views/VersionesView"));
const RecuperarConCodigoView = lazy(() => import("./views/RecuperarConCodigoView"));
const AceptarInvitacionView = lazy(() => import("./views/AceptarInvitacionView"));
const InvitarDocenteView = lazy(() => import("./views/InvitarDocenteView"));
const AulaVirtualView = lazy(() => import("./views/aula/AulaVirtualView"));
const CursoDetalleView = lazy(() => import("./views/aula/CursoDetalleView"));
const AmbientePublicoView = lazy(() => import("./views/ambientes/AmbientePublicoView"));
const AmbientesGestionView = lazy(() => import("./views/ambientes/AmbientesGestionView"));
const FichaEstudianteView = lazy(() => import("./views/gestion/FichaEstudianteView"));
const ListaFichasView = lazy(() => import("./views/gestion/ListaFichasView"));
const AsignacionesDocenteView = lazy(() => import("./views/gestion/AsignacionesDocenteView"));
const EditarCurriculoView = lazy(() => import("./views/EditarCurriculoView"));
const CalendarioView = lazy(() => import("./views/CalendarioView"));
const MatriculaView = lazy(() => import("./views/MatriculaView"));
const AlertasView = lazy(() => import("./views/AlertasView"));
const HorarioView = lazy(() => import("./views/HorarioView"));
const InformesView = lazy(() => import("./views/InformesView"));
const UnauthorizedView = lazy(() => import("./views/UnauthorizedView"));

function Cargando() {
  return (
    <div className="cargando-vista" role="status" aria-live="polite">
      Cargando…
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <InstitucionProvider>
      <HijoProvider>
      <ModoUIProvider>
      <SidebarProvider>
      <BrowserRouter>
        <Suspense fallback={<Cargando />}>
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
            <Route path="/finanzas" element={<FinanzasView />} />
            <Route path="/caja" element={<CajaChicaView />} />
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
        </Suspense>
      </BrowserRouter>
      </SidebarProvider>
      </ModoUIProvider>
      </HijoProvider>
      </InstitucionProvider>
    </AuthProvider>
  );
}
