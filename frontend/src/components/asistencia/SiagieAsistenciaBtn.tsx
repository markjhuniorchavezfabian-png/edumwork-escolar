import { useEffect, useState } from "react";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import api from "../../services/api";
import { cn } from "../../lib/utils";

interface Seccion { id: number; nombre: string }

interface PreviewSiagie {
  total_filas: number;
  se_rellenaran: number;
  sin_datos: number;
  asistencias_disponibles: number;
  n_hojas: number;
  confianza: "alta" | "media" | "baja";
  errores?: string[];
  hojas?: Array<{
    hash: string;
    hoja: string;
    fila_datos: number;
    metodo: string;
    confianza: string;
    dias: number[];
    columnas_detectadas: Record<string, string>;
  }>;
}

export default function SiagieAsistenciaBtn() {
  const [abierto, setAbierto] = useState(false);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [seccion, setSeccion] = useState<number | "">("");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewSiagie | null>(null);
  const [mapeoManual, setMapeoManual] = useState("");
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);
  const [cargando, setCargando] = useState<"preview" | "rellenar" | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!abierto) return;
    api.get<Seccion[]>("/asistencia/secciones/mis/")
      .then((r) => {
        setSecciones(r.data);
        if (r.data.length && !seccion) setSeccion(r.data[0].id);
      })
      .catch(() => setErr("No se pudieron cargar las secciones."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  function formData() {
    if (!archivo || !seccion || !mes) return null;
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("seccion_id", String(seccion));
    fd.append("mes", mes);
    if (mapeoManual.trim()) fd.append("mapeo_json", mapeoManual.trim());
    return fd;
  }

  async function generarPreview() {
    const fd = formData();
    if (!fd) return;
    setErr("");
    setPreview(null);
    setCargando("preview");
    try {
      const { data } = await api.post<PreviewSiagie>("/asistencia/siagie/preview/", fd);
      setPreview(data);
      if (data.hojas?.length) setMapeoManual(JSON.stringify(data.hojas, null, 2));
    } catch (e: unknown) {
      const ee = e as { response?: { data?: { error?: string } } };
      setErr(ee.response?.data?.error ?? "No se pudo leer el Excel SIAGIE.");
    } finally {
      setCargando(null);
    }
  }

  async function descargarRelleno() {
    const fd = formData();
    if (!fd || !archivo) return;
    setErr("");
    setCargando("rellenar");
    try {
      const { data } = await api.post("/asistencia/siagie/rellenar/", fd, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: unknown) {
      const ee = e as { response?: { data?: { error?: string } } };
      setErr(ee.response?.data?.error ?? "Error al rellenar el Excel SIAGIE.");
    } finally {
      setCargando(null);
    }
  }

  const listo = !!archivo && !!seccion && !!mes && !cargando;
  const puedeDescargar = listo && !!preview && preview.confianza !== "baja";
  const confianzaClass = preview?.confianza === "alta"
    ? "text-emerald-700 dark:text-emerald-400"
    : preview?.confianza === "media"
      ? "text-amber-700 dark:text-amber-400"
      : "text-destructive";

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="h-10 px-4 rounded-md border border-primary/40 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 flex items-center gap-2"
      >
        <Upload size={16} /> Preparar Excel SIAGIE
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !cargando && setAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold">Preparar asistencia SIAGIE</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Usa el Excel oficial descargado desde SIAGIE y vuelve a subirlo allá.</p>
              </div>
              <button onClick={() => setAbierto(false)} disabled={!!cargando} className="p-1 rounded-md hover:bg-muted disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Sección</label>
                  <select value={seccion} onChange={(e) => setSeccion(Number(e.target.value))} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    <option value="">Selecciona</option>
                    {secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Mes SIAGIE</label>
                  <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Excel oficial SIAGIE</label>
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setPreview(null); setMapeoManual(""); }}
                  className="w-full text-sm file:mr-3 file:h-10 file:px-3 file:rounded-md file:border-0 file:bg-muted file:text-foreground"
                />
                <p className="text-[11px] text-muted-foreground">No cambies el nombre del archivo descargado desde SIAGIE.</p>
              </div>

              {err && <div className="ui-alert ui-alert-danger text-xs">{err}</div>}

              {preview && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
                  <p><strong>{preview.se_rellenaran}</strong> de {preview.total_filas} estudiantes se rellenarán.</p>
                  <p className="text-xs text-muted-foreground">Datos EduMWork disponibles: {preview.asistencias_disponibles}. Hojas detectadas: {preview.n_hojas}. Sin datos: {preview.sin_datos}.</p>
                  <p className={cn("text-xs font-semibold", confianzaClass)}>Confianza: {preview.confianza.toUpperCase()}</p>
                  {preview.errores?.length ? (
                    <ul className="text-xs text-destructive list-disc pl-4">
                      {preview.errores.map((e) => <li key={e}>{e}</li>)}
                    </ul>
                  ) : null}
                  {preview.hojas?.length ? (
                    <div className="text-[11px] text-muted-foreground">
                      {preview.hojas.map((h) => (
                        <div key={`${h.hoja}-${h.hash}`}>{h.hoja}: {h.metodo} · {h.dias.length} días · fila {h.fila_datos}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {preview?.hojas?.length ? (
                <div className="rounded-xl border border-border p-3 space-y-2">
                  <button type="button" onClick={() => setMostrarAvanzado(v => !v)} className="text-xs font-semibold text-primary hover:underline">
                    {mostrarAvanzado ? "Ocultar" : "Corregir mapeo avanzado"}
                  </button>
                  {mostrarAvanzado && (
                    <>
                      <p className="text-[11px] text-muted-foreground">Edita solo si SIAGIE cambió columnas. Mantén campos como dni, dia_1, dia_2...</p>
                      <textarea
                        value={mapeoManual}
                        onChange={(e) => setMapeoManual(e.target.value)}
                        rows={8}
                        className="w-full rounded-md border border-input bg-background p-2 font-mono text-[11px]"
                      />
                    </>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={generarPreview} disabled={!listo} className={cn("h-11 rounded-md border border-border text-sm font-semibold hover:bg-muted disabled:opacity-50", "flex items-center justify-center gap-2")}>
                  {cargando === "preview" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                  Preview
                </button>
                <button onClick={descargarRelleno} disabled={!puedeDescargar} className="h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {cargando === "rellenar" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={16} />}
                  Descargar relleno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
