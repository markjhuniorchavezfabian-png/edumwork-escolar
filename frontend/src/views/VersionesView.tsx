import { useEffect, useState } from "react";
import { CheckCircle2, Star, Package, MessageCircle, ChevronRight, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import api from "../services/api";

import { WHATSAPP_SOPORTE as WHATSAPP } from "../constants/env";

interface Version {
  version: string;
  titulo: string;
  fecha: string;
  precio_actualizacion: number | null;
  es_gratis: boolean;
  is_latest: boolean;
  novedades: string[];
  es_instalada: boolean;
  es_nueva: boolean;
}

interface VersionesData {
  version_instalada: string;
  hay_actualizacion: boolean;
  versiones: Version[];
}

export default function VersionesView() {
  const [data, setData] = useState<VersionesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/core/versiones/")
      .then((r: { data: VersionesData }) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function solicitarActualizacion(v: Version) {
    const texto = encodeURIComponent(
      `🔄 Solicitud de actualización EduMWork\n\nVersión actual: ${data?.version_instalada}\nVersión solicitada: ${v.version} — ${v.titulo}\n\nPor favor, coordinar la actualización.`
    );
    window.open(`https://wa.me/${WHATSAPP}?text=${texto}`, "_blank");
  }

  if (loading) return <div className="text-sm text-muted-foreground p-4">Cargando versiones...</div>;

  if (!data) return (
    <div className="text-sm text-muted-foreground p-4">
      No se pudo cargar la información de versiones.
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Versiones del sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Versión instalada actualmente: <span className="font-semibold text-foreground">v{data.version_instalada}</span>
        </p>
      </div>

      {data.hay_actualizacion && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <Star size={16} className="text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Hay una nueva versión disponible.</span>{" "}
            Revisa los detalles abajo y coordina la actualización cuando sea conveniente.
            Las actualizaciones no son obligatorias.
          </div>
        </div>
      )}

      <div className="space-y-4">
        {data.versiones.map((v) => (
          <div
            key={v.version}
            className={cn(
              "rounded-2xl border p-5 space-y-3",
              v.es_instalada ? "border-emerald-500/30 bg-emerald-500/5" :
              v.es_nueva ? "border-primary/30 bg-primary/5" :
              "border-border/60 bg-card opacity-75"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold">v{v.version}</span>
                  <span className="text-sm font-medium text-muted-foreground">{v.titulo}</span>
                  {v.es_instalada && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                      Instalada
                    </span>
                  )}
                  {v.es_nueva && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                      Nueva
                    </span>
                  )}
                  {v.is_latest && !v.es_instalada && !v.es_nueva && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      Última
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                  <Clock size={11} />
                  {v.fecha}
                </div>
              </div>

              {/* Precio */}
              <div className="text-right shrink-0">
                {v.es_gratis ? (
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Gratis</span>
                ) : v.precio_actualizacion ? (
                  <div>
                    <div className="text-base font-bold text-primary">S/ {v.precio_actualizacion}</div>
                    <div className="text-[10px] text-muted-foreground">pago único</div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">A consultar</span>
                )}
              </div>
            </div>

            {/* Novedades */}
            <ul className="space-y-1">
              {v.novedades.map((n) => (
                <li key={n} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                  <ChevronRight size={12} className="text-primary mt-0.5 shrink-0" />
                  {n}
                </li>
              ))}
            </ul>

            {/* Acción */}
            {v.es_nueva && (
              <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Package size={13} className="text-primary" />
                  La actualización se instala en tu servidor sin perder datos.
                </div>
                <button
                  onClick={() => solicitarActualizacion(v)}
                  className="flex items-center gap-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold px-3 py-1.5 transition-colors shrink-0"
                >
                  <MessageCircle size={13} />
                  Solicitar por WhatsApp
                </button>
              </div>
            )}

            {v.es_instalada && (
              <div className="pt-2 border-t border-border/60 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} />
                Esta es la versión que tienes instalada actualmente.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[11px] text-muted-foreground">
        ¿Tienes dudas sobre una actualización? Escríbenos por{" "}
        <a
          href={`https://wa.me/${WHATSAPP}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          WhatsApp
        </a>{" "}
        antes de solicitarla.
      </div>
    </div>
  );
}
