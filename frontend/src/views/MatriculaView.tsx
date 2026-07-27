import { useEffect, useState, useCallback } from "react";
import { UserPlus, Upload, Search, RefreshCw, FileDown, X } from "lucide-react";
import api from "../services/api";
import { useToast } from "../components/ui/Toast";
import { Cargando } from "../components/ui/Spinner";

interface Seccion { id: number; nombre: string; grado: string; letra: string; nivel: string; }

interface Matriculado {
  id: number;
  nombre_completo: string;
  dni: string;
  codigo_matricula: string;
  seccion_id: number | null;
  seccion: string;
  grado: string;
  sexo: string;
  fecha_nacimiento: string;
  situacion_matricula: string;
  fecha_ingreso: string;
  colegio_procedencia: string;
  apoderado_nombre: string;
  apoderado_telefono: string;
  apoderado_dni: string;
}

const SITUACIONES: Record<string, { label: string; color: string; bg: string }> = {
  matriculado:  { label: "Matriculado",  color: "#166534", bg: "#dcfce7" },
  retirado:     { label: "Retirado",     color: "#991b1b", bg: "#fee2e2" },
  trasladado:   { label: "Trasladado",   color: "#92400e", bg: "#fef3c7" },
  promovido:    { label: "Promovido",    color: "#1e40af", bg: "#dbeafe" },
  no_promovido: { label: "No promovido", color: "#6b21a8", bg: "#f3e8ff" },
};

const PARENTESCOS = ["Padre", "Madre", "Abuelo/a", "Tío/a", "Hermano/a mayor", "Tutor legal", "Otro"];

const EMPTY_FORM = {
  // Estudiante
  nombres: "", apellidos: "", dni: "", fecha_nacimiento: "", sexo: "",
  seccion_id: "", fecha_ingreso: "", colegio_procedencia: "",
  // Apoderado
  apoderado_nombres: "", apoderado_apellidos: "", apoderado_dni: "",
  apoderado_telefono: "", apoderado_parentesco: "Madre",
};

export default function MatriculaView() {
  const { mostrar: toast } = useToast();
  const [lista, setLista] = useState<Matriculado[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroSeccion, setFiltroSeccion] = useState("");
  const [filtroSituacion, setFiltroSituacion] = useState("matriculado");
  const [busqueda, setBusqueda] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [modal, setModal] = useState(false);
  const [paso, setPaso] = useState(1); // 1=estudiante, 2=apoderado
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [guardando, setGuardando] = useState(false);
  const [credencial, setCredencial] = useState<{ username: string; password: string; codigo: string } | null>(null);
  const [modalSituacion, setModalSituacion] = useState<{ id: number; nombre: string; actual: string } | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  // RM 556-2024 · Instructivo Matrícula 2025
  const [cumplimiento, setCumplimiento] = useState<{
    total_estudiantes: number;
    matriculas_validas: number;
    matriculas_invalidas: number;
    pct_cumplimiento: number;
    invalidos: { nombre: string; seccion: string; completitud_pct: number; faltantes_labels: string[] }[];
  } | null>(null);
  const [verInvalidos, setVerInvalidos] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params: Record<string, string> = { anio };
      if (filtroSeccion) params.seccion_id = filtroSeccion;
      if (filtroSituacion) params.situacion = filtroSituacion;
      if (busqueda.trim()) params.q = busqueda.trim();
      const { data } = await api.get<Matriculado[]>("/usuarios/matricula/", { params });
      setLista(data);
    } catch { /* silencioso */ }
    finally { setCargando(false); }
  }, [anio, filtroSeccion, filtroSituacion, busqueda]);

  useEffect(() => {
    api.get<{ results?: Seccion[] } | Seccion[]>("/usuarios/secciones/?limit=200")
      .then(({ data }) => setSecciones(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {});
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // RM 556-2024: cargar reporte cumplimiento matrícula
  useEffect(() => {
    api.get<typeof cumplimiento>("/usuarios/matricula/reporte-cumplimiento/")
      .then(({ data }) => setCumplimiento(data))
      .catch(() => {});
  }, []);

  function setField(k: keyof typeof EMPTY_FORM, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function guardar() {
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      toast("Nombres y apellidos son obligatorios.", "error"); return;
    }
    setGuardando(true);
    try {
      const { data } = await api.post("/usuarios/matricula/nuevo/", {
        ...form,
        seccion_id: form.seccion_id ? Number(form.seccion_id) : null,
      });
      toast(`✓ ${form.nombres} ${form.apellidos} matriculado/a.`);
      setCredencial({ username: data.username, password: data.password_inicial, codigo: data.codigo_matricula });
      setModal(false);
      setForm({ ...EMPTY_FORM });
      setPaso(1);
      cargar();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || "Error al matricular.";
      toast(msg, "error");
    } finally { setGuardando(false); }
  }

  async function cambiarSituacion(id: number, nueva: string) {
    try {
      await api.patch(`/usuarios/matricula/${id}/situacion/`, { situacion_matricula: nueva });
      toast("Situación actualizada.");
      setModalSituacion(null);
      cargar();
    } catch { toast("Error al cambiar situación.", "error"); }
  }

  async function importarExcel() {
    if (!archivo) return;
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      const { data } = await api.post<{ creados: number; actualizados: number; errores: string[] }>(
        "/usuarios/importar/estudiantes/", fd, { headers: { "Content-Type": "multipart/form-data" } }
      );
      toast(`✓ ${data.creados} creados, ${data.actualizados} actualizados${data.errores.length ? `, ${data.errores.length} errores` : ""}.`);
      setArchivo(null);
      cargar();
    } catch { toast("Error al importar.", "error"); }
    finally { setImportando(false); }
  }

  const totalMatriculados = lista.filter(e => e.situacion_matricula === "matriculado").length;

  return (
    <div>
      <h2 className="page-title">Matrícula</h2>
      <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 12 }}>
        Registro de matrícula {anio}. Total matriculados: <strong>{totalMatriculados}</strong>
      </p>

      {/* RM 556-2024 · Cumplimiento Instructivo Matrícula 2025 */}
      {cumplimiento && cumplimiento.total_estudiantes > 0 && (
        <div style={{
          background: cumplimiento.matriculas_invalidas === 0 ? "#F0FDF4" : "#FEF3C7",
          border: `1px solid ${cumplimiento.matriculas_invalidas === 0 ? "#22C55E" : "#F59E0B"}`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <strong style={{ color: cumplimiento.matriculas_invalidas === 0 ? "#166534" : "#92400E" }}>
                Instructivo Matrícula EBR 2025:
              </strong>{" "}
              <span>
                {cumplimiento.matriculas_validas}/{cumplimiento.total_estudiantes} matrículas válidas
                {" "}({cumplimiento.pct_cumplimiento}%)
              </span>
              {cumplimiento.matriculas_invalidas > 0 && (
                <span style={{ color: "#92400E", marginLeft: 8 }}>
                  · {cumplimiento.matriculas_invalidas} con datos críticos faltantes
                </span>
              )}
            </div>
            {cumplimiento.matriculas_invalidas > 0 && (
              <button onClick={() => setVerInvalidos(v => !v)}
                style={{ padding: "4px 12px", border: "1px solid #F59E0B", background: verInvalidos ? "#FDE68A" : "white", color: "#92400E", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                {verInvalidos ? "Ocultar" : "Ver detalle"}
              </button>
            )}
          </div>
          {verInvalidos && cumplimiento.invalidos.length > 0 && (
            <div style={{ marginTop: 10, maxHeight: 240, overflowY: "auto", background: "white", borderRadius: 6, padding: 8 }}>
              {cumplimiento.invalidos.map((inv, i) => (
                <div key={i} style={{ padding: "6px 8px", borderBottom: "1px solid var(--borde)", fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{inv.nombre} <span style={{ color: "var(--muted-foreground)" }}>· {inv.seccion} · {inv.completitud_pct}%</span></div>
                  <div style={{ color: "#991B1B", fontSize: 11, marginTop: 2 }}>
                    Falta: {inv.faltantes_labels.join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra de herramientas */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
        {/* Búsqueda */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32 }}
            placeholder="Buscar por nombre, DNI o código..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === "Enter" && cargar()}
          />
        </div>

        {/* Filtro sección */}
        <select className="form-input" style={{ maxWidth: 180 }} value={filtroSeccion} onChange={e => setFiltroSeccion(e.target.value)}>
          <option value="">Todas las secciones</option>
          {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.nivel})</option>)}
        </select>

        {/* Filtro situación */}
        <select className="form-input" style={{ maxWidth: 160 }} value={filtroSituacion} onChange={e => setFiltroSituacion(e.target.value)}>
          <option value="">Todas las situaciones</option>
          {Object.entries(SITUACIONES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Año */}
        <select className="form-input" style={{ width: 90 }} value={anio} onChange={e => setAnio(e.target.value)}>
          {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <button className="btn btn-secundario" onClick={cargar} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} /> Actualizar
        </button>

        {/* Importar Excel */}
        <label className="btn btn-secundario" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <Upload size={14} />
          {importando ? "Importando..." : "Importar Excel"}
          <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
            onChange={e => { setArchivo(e.target.files?.[0] ?? null); }} />
        </label>
        {archivo && (
          <button className="btn btn-primario" style={{ fontSize: 13 }} onClick={importarExcel} disabled={importando}>
            {importando ? "..." : `Subir "${archivo.name}"`}
          </button>
        )}

        <a href="/api/usuarios/importar/template-estudiantes/" download>
          <button className="btn btn-secundario" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <FileDown size={14} /> Plantilla
          </button>
        </a>

        <button
          className="btn btn-primario"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          onClick={() => { setModal(true); setPaso(1); setForm({ ...EMPTY_FORM }); }}
        >
          <UserPlus size={14} /> Nuevo estudiante
        </button>
      </div>

      {/* Credencial recién creada */}
      {credencial && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <strong style={{ color: "#166534" }}>✓ Matrícula registrada</strong>
            <div style={{ fontSize: 13, marginTop: 6, color: "#166534" }}>
              Código: <code style={{ background: "#dcfce7", padding: "2px 6px", borderRadius: 4 }}>{credencial.codigo}</code>
              {" "} · Usuario: <code style={{ background: "#dcfce7", padding: "2px 6px", borderRadius: 4 }}>{credencial.username}</code>
              {" "} · Contraseña inicial: <code style={{ background: "#dcfce7", padding: "2px 6px", borderRadius: 4 }}>{credencial.password}</code>
            </div>
            <div style={{ fontSize: 11, color: "#15803d", marginTop: 4 }}>Guarda estas credenciales antes de cerrar.</div>
          </div>
          <button onClick={() => setCredencial(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534" }}><X size={16} /></button>
        </div>
      )}

      {/* Tabla */}
      {cargando ? <Cargando /> : lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted-foreground)", fontSize: 14 }}>
          No hay estudiantes con los filtros seleccionados.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Código", "Estudiante", "DNI", "Sección", "Apoderado", "Teléfono", "Situación", ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(e => {
                const sit = SITUACIONES[e.situacion_matricula] ?? { label: e.situacion_matricula, color: "#333", bg: "#f5f5f5" };
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--borde)" }}>
                    <td style={tdStyle}><code style={{ fontSize: 11, background: "var(--muted)", padding: "1px 5px", borderRadius: 4 }}>{e.codigo_matricula}</code></td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{e.nombre_completo}</div>
                      {e.fecha_nacimiento && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{e.fecha_nacimiento} · {e.sexo === "M" ? "Varón" : e.sexo === "F" ? "Mujer" : ""}</div>}
                    </td>
                    <td style={tdStyle}>{e.dni || "—"}</td>
                    <td style={tdStyle}>{e.seccion || <span style={{ color: "var(--muted-foreground)" }}>Sin asignar</span>}</td>
                    <td style={tdStyle}>
                      {e.apoderado_nombre || <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                      {e.apoderado_dni && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>DNI: {e.apoderado_dni}</div>}
                    </td>
                    <td style={tdStyle}>{e.apoderado_telefono || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{ background: sit.bg, color: sit.color, border: `1px solid ${sit.color}40`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {sit.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        className="btn btn-secundario"
                        style={{ fontSize: 11, padding: "3px 10px" }}
                        onClick={() => setModalSituacion({ id: e.id, nombre: e.nombre_completo, actual: e.situacion_matricula })}
                      >
                        Cambiar estado
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo estudiante */}
      {modal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) { setModal(false); setPaso(1); } }}>
          <div style={modalStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                Nuevo estudiante — {paso === 1 ? "Datos del estudiante" : "Datos del apoderado"}
              </h3>
              <button onClick={() => { setModal(false); setPaso(1); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted-foreground)" }}>×</button>
            </div>

            {/* Indicador de pasos */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
              {[1, 2].map(p => (
                <div key={p} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: p <= paso ? "var(--primario)" : "var(--borde)",
                  cursor: p < paso ? "pointer" : "default",
                }} onClick={() => p < paso && setPaso(p)} />
              ))}
            </div>

            {paso === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-field">
                    <label className="form-label">Nombres *</label>
                    <input className="form-input" value={form.nombres} onChange={e => setField("nombres", e.target.value)} placeholder="Ej: Juan Carlos" autoFocus />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Apellidos *</label>
                    <input className="form-input" value={form.apellidos} onChange={e => setField("apellidos", e.target.value)} placeholder="Ej: Pérez Flores" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div className="form-field">
                    <label className="form-label">DNI</label>
                    <input className="form-input" value={form.dni} onChange={e => setField("dni", e.target.value)} placeholder="8 dígitos" maxLength={8} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Sexo</label>
                    <select className="form-input" value={form.sexo} onChange={e => setField("sexo", e.target.value)}>
                      <option value="">—</option>
                      <option value="M">Varón</option>
                      <option value="F">Mujer</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Fecha de nacimiento</label>
                    <input className="form-input" type="date" value={form.fecha_nacimiento} onChange={e => setField("fecha_nacimiento", e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-field">
                    <label className="form-label">Sección</label>
                    <select className="form-input" value={form.seccion_id} onChange={e => setField("seccion_id", e.target.value)}>
                      <option value="">Sin asignar</option>
                      {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.nivel})</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Fecha de ingreso</label>
                    <input className="form-input" type="date" value={form.fecha_ingreso} onChange={e => setField("fecha_ingreso", e.target.value)} />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Colegio de procedencia</label>
                  <input className="form-input" value={form.colegio_procedencia} onChange={e => setField("colegio_procedencia", e.target.value)} placeholder="I.E. anterior (opcional)" />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <button className="btn btn-secundario" onClick={() => { setModal(false); setPaso(1); }}>Cancelar</button>
                  <button className="btn btn-primario" onClick={() => {
                    if (!form.nombres.trim() || !form.apellidos.trim()) { toast("Nombres y apellidos son obligatorios.", "error"); return; }
                    setPaso(2);
                  }}>
                    Siguiente → Apoderado
                  </button>
                </div>
              </div>
            )}

            {paso === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
                  Datos del apoderado (madre, padre, tutor legal). Opcional — puedes completarlo después.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-field">
                    <label className="form-label">Nombres del apoderado</label>
                    <input className="form-input" value={form.apoderado_nombres} onChange={e => setField("apoderado_nombres", e.target.value)} placeholder="Ej: María" />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Apellidos del apoderado</label>
                    <input className="form-input" value={form.apoderado_apellidos} onChange={e => setField("apoderado_apellidos", e.target.value)} placeholder="Ej: Flores Quispe" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div className="form-field">
                    <label className="form-label">DNI apoderado</label>
                    <input className="form-input" value={form.apoderado_dni} onChange={e => setField("apoderado_dni", e.target.value)} placeholder="8 dígitos" maxLength={8} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Teléfono</label>
                    <input className="form-input" value={form.apoderado_telefono} onChange={e => setField("apoderado_telefono", e.target.value)} placeholder="9XXXXXXXX" />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Parentesco</label>
                    <select className="form-input" value={form.apoderado_parentesco} onChange={e => setField("apoderado_parentesco", e.target.value)}>
                      {PARENTESCOS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <button className="btn btn-secundario" onClick={() => setPaso(1)}>← Atrás</button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-secundario" onClick={guardar} disabled={guardando}>
                      {guardando ? "Guardando..." : "Guardar sin apoderado"}
                    </button>
                    <button className="btn btn-primario" onClick={guardar} disabled={guardando}>
                      {guardando ? "Guardando..." : "✓ Confirmar matrícula"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal cambiar situación */}
      {modalSituacion && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setModalSituacion(null); }}>
          <div style={{ ...modalStyle, maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Cambiar situación de matrícula</h3>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px" }}>{modalSituacion.nombre}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(SITUACIONES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => cambiarSituacion(modalSituacion.id, k)}
                  disabled={k === modalSituacion.actual}
                  style={{
                    padding: "10px 14px", borderRadius: 8, border: "1px solid var(--borde)",
                    background: k === modalSituacion.actual ? "var(--muted)" : "var(--fondo)",
                    color: v.color, fontWeight: 600, fontSize: 13, cursor: k === modalSituacion.actual ? "default" : "pointer",
                    textAlign: "left", opacity: k === modalSituacion.actual ? 0.6 : 1,
                  }}
                >
                  {v.label} {k === modalSituacion.actual && "(actual)"}
                </button>
              ))}
            </div>
            <button className="btn btn-secundario" style={{ marginTop: 16, width: "100%" }} onClick={() => setModalSituacion(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  background: "var(--muted)", padding: "8px 12px", textAlign: "left",
  fontWeight: 600, fontSize: 12, borderBottom: "2px solid var(--borde)", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = { padding: "8px 12px", verticalAlign: "middle" };
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const modalStyle: React.CSSProperties = {
  background: "var(--fondo)", borderRadius: 14, padding: 28,
  width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
};
