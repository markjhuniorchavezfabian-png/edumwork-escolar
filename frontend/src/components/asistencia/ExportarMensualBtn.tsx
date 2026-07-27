import { useEffect, useState } from "react";
import { Download, X, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import api from "../../services/api";
import { cn } from "../../lib/utils";

interface Seccion { id: number; nombre: string }

export default function ExportarMensualBtn() {
  const [abierto, setAbierto] = useState(false);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [seccion, setSeccion] = useState<number | "">("");
  const [mes, setMes] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [descargando, setDescargando] = useState<"xlsx" | "pdf" | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!abierto) return;
    api.get<Seccion[]>("/asistencia/mis-secciones/")
      .then((r) => {
        const list = r.data;
        setSecciones(list);
        if (list.length && !seccion) setSeccion(list[0].id);
      })
      .catch(() => setErr("No se pudieron cargar las secciones."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  async function descargar(formato: "xlsx" | "pdf") {
    if (!seccion || !mes) return;
    setErr(""); setDescargando(formato);
    try {
      const { data } = await api.get(
        `/asistencia/exportar-mensual/?mes=${mes}&seccion=${seccion}&formato=${formato}`,
        { responseType: "blob" }
      );
      const secNombre = secciones.find(s => s.id === seccion)?.nombre?.replace(/\s/g, "_") ?? seccion;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asistencia_${secNombre}_${mes}.${formato}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: unknown) {
      const ee = e as { response?: { data?: { error?: string } } };
      setErr(ee.response?.data?.error ?? "Error al generar el reporte.");
    } finally { setDescargando(null); }
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center gap-2"
      >
        <Download size={16} /> Exportar reporte mensual
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !descargando && setAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold">Exportar asistencia mensual</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reporte por sección con leyenda y firmas
                </p>
              </div>
              <button
                onClick={() => setAbierto(false)}
                disabled={!!descargando}
                className="p-1 rounded-md hover:bg-muted disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Sección</label>
                <select
                  value={seccion}
                  onChange={(e) => setSeccion(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— Selecciona una sección —</option>
                  {secciones.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Mes</label>
                <input
                  type="month"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {err && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {err}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => descargar("xlsx")}
                  disabled={!seccion || !!descargando}
                  className={cn(
                    "h-11 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                    "text-sm font-semibold hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {descargando === "xlsx"
                    ? <Loader2 size={14} className="animate-spin" />
                    : <FileSpreadsheet size={16} />}
                  Excel
                </button>
                <button
                  onClick={() => descargar("pdf")}
                  disabled={!seccion || !!descargando}
                  className={cn(
                    "h-11 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
                    "text-sm font-semibold hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {descargando === "pdf"
                    ? <Loader2 size={14} className="animate-spin" />
                    : <FileText size={16} />}
                  PDF
                </button>
              </div>

              <div className="text-[11px] text-muted-foreground text-center">
                Excel: editable con totales · PDF: con membrete y firmas oficiales
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
