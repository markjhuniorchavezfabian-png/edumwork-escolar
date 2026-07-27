import { useState } from "react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import { useToast } from "../../components/ui/Toast";
import { useInstitucion } from "../../context/InstitucionContext";

interface Credencial { nombre: string; usuario: string; password: string; dni: string; rol: string; }

interface ResultadoImport {
  creados: number;
  actualizados: number;
  hijos_vinculados?: number;
  errores: Array<{ fila: number; error: string; datos?: string[] }>;
  credenciales: Credencial[];
}

export default function ImportMasivoView() {
  const toast = useToast();
  const institucion = useInstitucion();
  const [tipo, setTipo] = useState<"estudiantes" | "padres" | "docentes">("estudiantes");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);

  async function descargarTemplate(t: "estudiantes" | "padres" | "docentes") {
    const url = t === "estudiantes"
      ? "/usuarios/importar/template-estudiantes/"
      : t === "padres"
      ? "/usuarios/importar/template-padres/"
      : "/usuarios/importar/template-docentes/";
    const { data } = await api.get(url, { responseType: "blob" });
    const blob = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = blob;
    a.download = `template_${t}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blob), 1000);
  }

  async function importar() {
    if (!archivo) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const url = tipo === "estudiantes"
        ? "/usuarios/importar/estudiantes/"
        : tipo === "padres"
        ? "/usuarios/importar/padres/"
        : "/usuarios/importar/docentes/";
      const { data } = await api.post<ResultadoImport>(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResultado(data);
      toast.ok(`${data.creados} creados, ${data.actualizados} actualizados${data.errores.length ? `, ${data.errores.length} errores` : ""}.`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? "Error al importar.");
    } finally { setEnviando(false); }
  }

  async function descargarCredenciales() {
    if (!resultado?.credenciales.length) return;
    const { data } = await api.post("/usuarios/importar/credenciales/", { credenciales: resultado.credenciales }, { responseType: "blob" });
    const blob = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = blob;
    a.download = `credenciales_${tipo}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blob), 1000);
  }

  return (
    <div>
      <h2 className="page-title">Importación masiva</h2>

      <Card titulo="Paso 1 — Descargar template">
        <p style={{ fontSize: 13, color: "var(--texto-mute)", marginBottom: 12 }}>
          Descarga el Excel modelo, complétalo con los datos de SIAGIE o del cuaderno de matrícula, y súbelo en el paso 2.
          <br />
          <strong>Contraseña inicial:</strong> los primeros 6 dígitos del DNI + "2026". Ejemplo: DNI <code>12345678</code> → contraseña <code>1234562026</code>.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secundario btn-icono" onClick={() => descargarTemplate("docentes")} style={{ padding: "8px 14px" }}>
            <Icon name="excel" /> Template Docentes
          </button>
          <button className="btn btn-secundario btn-icono" onClick={() => descargarTemplate("estudiantes")} style={{ padding: "8px 14px" }}>
            <Icon name="excel" /> Template Estudiantes
          </button>
          <button className="btn btn-secundario btn-icono" onClick={() => descargarTemplate("padres")} style={{ padding: "8px 14px" }}>
            <Icon name="excel" /> Template Padres
          </button>
        </div>
      </Card>

      <Card titulo="Paso 2 — Subir archivo lleno">
        <div className="form-field">
          <label className="form-label">Tipo</label>
          <select className="form-input" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="docentes">Docentes</option>
            <option value="estudiantes">Estudiantes</option>
            <option value="padres">Padres / Apoderados</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Archivo Excel</label>
          <input type="file" accept=".xlsx" className="form-input" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </div>
        <button className="btn btn-primario" onClick={importar} disabled={!archivo || enviando} style={{ width: "auto" }}>
          {enviando ? "Procesando..." : "Importar"}
        </button>
      </Card>

      {resultado && (
        <>
          <Card titulo="Resultado">
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-label">Creados</span>
                <span className="kpi-valor" style={{ color: "var(--verde-600)" }}>{resultado.creados}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Actualizados</span>
                <span className="kpi-valor" style={{ color: "var(--azul-600)" }}>{resultado.actualizados}</span>
              </div>
              {resultado.hijos_vinculados !== undefined && (
                <div className="kpi-card">
                  <span className="kpi-label">Hijos vinculados</span>
                  <span className="kpi-valor" style={{ color: "var(--violeta-600)" }}>{resultado.hijos_vinculados}</span>
                </div>
              )}
              <div className="kpi-card">
                <span className="kpi-label">Errores</span>
                <span className="kpi-valor" style={{ color: resultado.errores.length > 0 ? "var(--rojo-600)" : "var(--slate-500)" }}>
                  {resultado.errores.length}
                </span>
              </div>
            </div>

            {resultado.credenciales.length > 0 && (
              <button className="btn btn-primario btn-icono" onClick={descargarCredenciales} style={{ marginTop: 12, width: "auto" }}>
                <Icon name="descargar" /> Descargar credenciales generadas (Excel)
              </button>
            )}
          </Card>

          {resultado.errores.length > 0 && (
            <Card titulo={`Errores (${resultado.errores.length})`}>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {resultado.errores.map((err, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--borde)", fontSize: 13 }}>
                    <strong>Fila {err.fila}:</strong> {err.error}
                    {err.datos && <div style={{ fontSize: 11, color: "var(--texto-mute)" }}>{err.datos.join(" · ")}</div>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Importar notas históricas ─────────────────────────────────── */}
      <ImportarNotasHistoricas anioActivo={institucion.anio_lectivo_activo || new Date().getFullYear()} />
    </div>
  );
}

function ImportarNotasHistoricas({ anioActivo }: { anioActivo: number }) {
  const toast = useToast();
  const [anio, setAnio] = useState(anioActivo - 1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ creadas: number; actualizadas: number; errores: string[]; mensaje: string } | null>(null);

  async function importar() {
    if (!archivo) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      fd.append("anio", String(anio));
      const { data } = await api.post<typeof resultado>("/notas/importar-historico/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResultado(data);
      toast.ok(data!.mensaje);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? "Error al importar.");
    } finally { setEnviando(false); }
  }

  return (
    <Card titulo="Importar notas históricas (desde SIAGIE)">
      <p style={{ fontSize: 13, color: "var(--texto-mute)", marginBottom: 12 }}>
        Cargá un Excel exportado de SIAGIE (o del módulo de notas de este sistema) para un año anterior.
        El sistema crea los registros de Bimestre 4 (nota final del año) por estudiante y área.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div className="form-field">
          <label className="form-label">Año lectivo del archivo</label>
          <input type="number" className="form-input" value={anio}
            min={2010} max={anioActivo - 1}
            onChange={(e) => setAnio(Number(e.target.value))}
            style={{ width: 100 }} />
        </div>
        <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label">Archivo Excel (.xlsx — formato SIAGIE, una hoja por área)</label>
          <input type="file" accept=".xlsx" className="form-input" style={{ fontSize: 12 }}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </div>
        <button className="btn btn-primario btn-icono" onClick={importar}
          disabled={!archivo || enviando} style={{ width: "auto" }}>
          <Icon name="excel" /> {enviando ? "Importando..." : `Importar año ${anio}`}
        </button>
      </div>
      {resultado && (
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "var(--verde-600)", fontWeight: 600 }}>{resultado.mensaje}</div>
          {resultado.errores.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>No encontrados ({resultado.errores.length}):</strong>
              <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 12, color: "var(--muted-foreground)" }}>
                {resultado.errores.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
