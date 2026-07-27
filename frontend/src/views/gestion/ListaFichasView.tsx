import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import { Cargando, EmptyState } from "../../components/ui/Spinner";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";

interface EstOpt {
  id: number;
  nombre: string;
  seccion: string;
  codigo_matricula: string;
}

interface Seccion { id: number; nombre: string; grado: string; letra: string }

const ROLES_PUEDEN_MATRICULAR = ["director", "subdirector", "admin_tic", "secretaria"];

export default function ListaFichasView() {
  const { usuario } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<EstOpt[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);

  const puedeMatricular = usuario ? ROLES_PUEDEN_MATRICULAR.includes(usuario.rol) : false;

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get<EstOpt[]>(`/usuarios/estudiantes/lista/${q ? `?q=${q}` : ""}`);
      setItems(data);
    } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [q]);

  const porSeccion: Record<string, EstOpt[]> = {};
  items.forEach((e) => {
    const s = e.seccion || "Sin sección";
    (porSeccion[s] = porSeccion[s] || []).push(e);
  });

  return (
    <div>
      <div className="dashboard-hero">
        <h2>Fichas de estudiantes</h2>
        <p>Datos personales, médicos, familiares y académicos de cada estudiante.</p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input className="form-input" placeholder="Buscar por nombre o código de matrícula..."
          value={q} onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, padding: "10px 12px" }} />
        {puedeMatricular && (
          <button className="btn btn-primario btn-icono" onClick={() => setModalAbierto(true)}
            style={{ width: "auto", padding: "10px 16px", whiteSpace: "nowrap" }}>
            <Icon name="plus" /> Matricular estudiante
          </button>
        )}
      </div>

      {cargando ? <Cargando /> :
       items.length === 0 ? <EmptyState icono="usuarios" titulo="Sin estudiantes" /> :
       Object.entries(porSeccion).sort(([a], [b]) => a.localeCompare(b)).map(([sec, ests]) => (
        <Card key={sec} titulo={<><Icon name="libro" size={14} /> {sec} <span style={{ fontSize: 12, color: "var(--texto-mute)", fontWeight: 400 }}>({ests.length})</span></>}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {ests.map((e) => (
              <Link key={e.id} to={`/estudiantes/${e.id}`} style={{
                padding: 12, borderRadius: 8, border: "1px solid var(--borde)",
                background: "var(--bg-panel)", textDecoration: "none", color: "inherit",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "var(--azul-50)", color: "var(--azul-600)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}>
                  {e.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{e.nombre}</div>
                  {e.codigo_matricula && (
                    <div style={{ fontSize: 11, color: "var(--texto-mute)" }}>
                      <code>{e.codigo_matricula}</code>
                    </div>
                  )}
                </div>
                <Icon name="chevron-derecha" size={16} />
              </Link>
            ))}
          </div>
        </Card>
      ))}

      {modalAbierto && (
        <MatricularModal
          onCerrar={() => setModalAbierto(false)}
          onMatriculado={(id) => { setModalAbierto(false); toast.ok("Estudiante matriculado."); cargar(); navigate(`/estudiantes/${id}`); }}
        />
      )}
    </div>
  );
}

function MatricularModal({ onCerrar, onMatriculado }: { onCerrar: () => void; onMatriculado: (id: number) => void }) {
  const toast = useToast();
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ username: string; password_inicial: string; codigo_matricula: string } | null>(null);
  const [form, setForm] = useState({
    nombres: "", apellidos: "", dni: "", fecha_nacimiento: "", sexo: "", seccion_id: "",
  });

  useEffect(() => {
    api.get<{ results?: Seccion[] } | Seccion[]>("/usuarios/secciones/?limit=200")
      .then(({ data }) => setSecciones(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {});
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const { data } = await api.post<{ id: number; username: string; password_inicial: string; codigo_matricula: string }>(
        "/usuarios/estudiantes/matricular/",
        { ...form, seccion_id: form.seccion_id ? Number(form.seccion_id) : null }
      );
      setResultado({ username: data.username, password_inicial: data.password_inicial, codigo_matricula: data.codigo_matricula });
      setTimeout(() => onMatriculado(data.id), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error ?? "Error al matricular.");
    } finally { setGuardando(false); }
  }

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Matricular estudiante</h3>
          <button className="modal-cerrar" onClick={onCerrar}>×</button>
        </div>

        {resultado ? (
          <div className="modal-body">
            <div style={{ background: "var(--verde-50)", border: "1px solid var(--verde-300)", borderRadius: 10, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>¡Matriculado!</div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <strong>Código:</strong> <code>{resultado.codigo_matricula}</code>
              </div>
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <strong>Usuario:</strong> <code>{resultado.username}</code>
              </div>
              <div style={{ fontSize: 13 }}>
                <strong>Contraseña inicial:</strong> <code>{resultado.password_inicial}</code>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 10 }}>
                Redirigiendo a la ficha...
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={guardar}>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Nombres *</label>
                  <input className="form-input" required value={form.nombres} onChange={e => set("nombres", e.target.value)} placeholder="Juan Carlos" />
                </div>
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Apellidos *</label>
                  <input className="form-input" required value={form.apellidos} onChange={e => set("apellidos", e.target.value)} placeholder="Pérez González" />
                </div>
                <div className="form-group">
                  <label className="form-label">DNI</label>
                  <input className="form-input" value={form.dni} onChange={e => set("dni", e.target.value)} placeholder="12345678" maxLength={8} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sexo</label>
                  <select className="form-input" value={form.sexo} onChange={e => set("sexo", e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de nacimiento</label>
                  <input className="form-input" type="date" value={form.fecha_nacimiento} onChange={e => set("fecha_nacimiento", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sección</label>
                  <select className="form-input" value={form.seccion_id} onChange={e => set("seccion_id", e.target.value)}>
                    <option value="">— Sin sección —</option>
                    {secciones.map(s => <option key={s.id} value={s.id}>{s.nombre || `${s.grado} ${s.letra}`}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 8 }}>
                Contraseña inicial: primeros 6 dígitos del DNI + año (ej: <code>123456{new Date().getFullYear()}</code>)
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
              <button type="submit" className="btn btn-primario" disabled={guardando || !form.nombres || !form.apellidos}>
                {guardando ? "Matriculando..." : "Matricular"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
