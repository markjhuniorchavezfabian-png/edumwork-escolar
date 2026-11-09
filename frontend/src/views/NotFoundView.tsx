import { Link } from "react-router-dom";
import { School, Home, HelpCircle } from "lucide-react";
import { useInstitucion } from "../context/InstitucionContext";

export default function NotFoundView() {
  const institucion = useInstitucion();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 border border-blue-200/60 dark:border-blue-900/60 shadow-xs">
        <School size={30} />
      </div>

      <div className="text-7xl sm:text-8xl font-black text-blue-600/90 dark:text-blue-400/90 tracking-tight leading-none mb-3">
        404
      </div>

      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-2">
        Página no encontrada
      </h1>

      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        La ruta a la que intentas acceder no existe, ha sido reubicada o requiere permisos institucionales.
      </p>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Home size={15} />
          <span>Volver al inicio</span>
        </Link>
        <Link
          to="/comunicados"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-medium transition-colors"
        >
          <HelpCircle size={15} className="text-muted-foreground" />
          <span>Contactar a Secretaría</span>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        {institucion.nombre || "Institución Educativa"} · Sistema de Gestión Escolar
      </p>
    </div>
  );
}
