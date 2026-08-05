import { useEffect, useState } from "react";
import { AREAS_CNEB } from "../../constants/curriculo";
import { Link } from "react-router-dom";
import type { Curso } from "../../types/aula";
import { listarCursos, crearCurso, actualizarCurso, eliminarCurso } from "../../services/aula";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import Icon from "../../components/ui/Icon";
import { EmptyState, Cargando } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";

const ROLES_CREADORES = ["docente", "admin_tic", "director", "subdirector", "psicologa"];

const AREAS = [...AREAS_CNEB];

export default function AulaVirtualView() {
  const { usuario } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Curso | null>(null);

  const puedeCrear = usuario ? ROLES_CREADORES.includes(usuario.rol) : false;

  async function cargar() {
    setCargando(true);
    try {
      setCursos(await listarCursos(q ? { q } : undefined));
    } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [q]);

  async function handleEliminar(curso: Curso) {
    const ok = await confirmar({
      titulo: `Eliminar "${curso.titulo}"`,
      mensaje: "Se desactivará el curso. El material y las tareas no se borran, pero los estudiantes dejarán de verlo.",
      textoConfirmar: "Eliminar",
      variante: "peligro",
    });
    if (!ok) return;
    try {
      await eliminarCurso(curso.id);
      toast.ok("Curso eliminado.");
      cargar();
    } catch { toast.error("No se pudo eliminar el curso."); }
  }

  function esPropietario(curso: Curso) {
    if (!usuario || !ROLES_CREADORES.includes(usuario.rol)) return false;
    if (usuario.rol !== "docente") return true; // director/admin puede editar cualquier curso
    const nombreCompleto = `${usuario.first_name} ${usuario.last_name}`.trim();
    return curso.docente_nombre === nombreCompleto || curso.docente_nombre === usuario.username;
  }

  return (
    <div>
      <div className="dashboard-hero">
        <h2>Aula Virtual</h2>
        <p>Repositorio de material y tareas de tus cursos.</p>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <input
          className="form-input"
          placeholder="Buscar curso por título…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: "10px 12px" }}
        />
        {puedeCrear && (
          <button className="btn btn-primario btn-icono" onClick={() => setCreando(true)} style={{ width: "auto", padding: "10px 16px" }}>
            <Icon name="plus" /> Nuevo curso
          </button>
        )}
      </div>

      {cargando ? <Cargando /> : cursos.length === 0 ? (
        <EmptyState
          icono="libro"
          titulo="Sin cursos todavía"
          descripcion={
            puedeCrear
              ? "Crea tu primer curso para compartir material y tareas con tus estudiantes."
              : "Aún no hay cursos disponibles para tu sección."
          }
          accion={puedeCrear ? (
            <button className="btn btn-primario btn-icono" onClick={() => setCreando(true)}>
              <Icon name="plus" /> Crear curso
            </button>
          ) : undefined}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {cursos.map((c) => (
            <TarjetaCurso
              key={c.id}
              curso={c}
              puedeEditar={!!esPropietario(c)}
              onEditar={() => setEditando(c)}
              onEliminar={() => handleEliminar(c)}
            />
          ))}
        </div>
      )}

      {creando && (
        <CursoModal
          onCerrar={() => setCreando(false)}
          onGuardado={() => { setCreando(false); toast.ok("Curso creado."); cargar(); }}
        />
      )}
      {editando && (
        <CursoModal
          cursoInicial={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); toast.ok("Curso actualizado."); cargar(); }}
        />
      )}
    </div>
  );
}

interface TarjetaProps {
  curso: Curso;
  puedeEditar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}

function TarjetaCurso({ curso, puedeEditar, onEditar, onEliminar }: TarjetaProps) {
  return (
    <div style={{
      background: "var(--bg-panel)",
      border: "1px solid var(--borde)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      display: "flex",
      flexDirection: "column",
    }}>
      <Link to={`/aprender/${curso.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
        <div style={{
          height: 100,
          background: `linear-gradient(135deg, ${curso.color}, ${curso.color}cc)`,
          color: "white",
          padding: 16,
          display: "flex",
          alignItems: "flex-end",
        }}>
          <div>
            {curso.area && (
              <div style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.85, letterSpacing: 0.06 }}>
                {curso.area}
              </div>
            )}
            <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.2 }}>{curso.titulo}</h3>
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <p style={{ fontSize: 12, color: "var(--texto-mute)", marginBottom: 8, minHeight: 32 }}>
            {curso.descripcion?.slice(0, 100) || "Sin descripción."}
          </p>
          <div style={{ fontSize: 11, color: "var(--texto-mute)", display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="usuarios" size={11} /> {curso.docente_nombre}
          </div>
          {curso.secciones_detalle.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--texto-mute)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="libro" size={11} /> {curso.secciones_detalle.map((s) => s.nombre).join(", ")}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 12 }}>
            <span><strong>{curso.lecciones_count}</strong> lecciones</span>
            <span><strong>{curso.tareas_count}</strong> tareas</span>
          </div>
        </div>
      </Link>

      {puedeEditar && (
        <div style={{
          display: "flex", gap: 6, padding: "8px 14px",
          borderTop: "1px solid var(--borde)", background: "var(--fondo)",
        }}>
          <button
            className="btn btn-secundario"
            onClick={onEditar}
            style={{ flex: 1, padding: "6px 0", fontSize: 12, width: "auto" }}
          >
            Editar
          </button>
          <button
            onClick={onEliminar}
            style={{
              padding: "6px 12px", fontSize: 12, width: "auto",
              background: "#fee2e2", color: "#991b1b",
              border: "1px solid #fca5a5", borderRadius: 8, cursor: "pointer",
            }}
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

interface SeccionOpt { id: number; grado: string; letra: string; nombre?: string }

interface CursoModalProps {
  cursoInicial?: Curso;
  onCerrar: () => void;
  onGuardado: () => void;
}

function CursoModal({ cursoInicial, onCerrar, onGuardado }: CursoModalProps) {
  const [datos, setDatos] = useState({
    titulo: cursoInicial?.titulo ?? "",
    descripcion: cursoInicial?.descripcion ?? "",
    area: cursoInicial?.area ?? "",
    color: cursoInicial?.color ?? "#2E75B6",
    secciones: cursoInicial?.secciones_detalle?.map((s) => s.id) ?? [] as number[],
  });
  const [secciones, setSecciones] = useState<SeccionOpt[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results?: SeccionOpt[] } | SeccionOpt[]>("/usuarios/secciones/")
      .then(({ data }) => setSecciones(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => setSecciones([]));
  }, []);

  function toggleSeccion(id: number) {
    setDatos((d) => ({
      ...d,
      secciones: d.secciones.includes(id) ? d.secciones.filter((s) => s !== id) : [...d.secciones, id],
    }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      if (cursoInicial) {
        await actualizarCurso(cursoInicial.id, {
          titulo: datos.titulo,
          descripcion: datos.descripcion,
          area: datos.area,
          color: datos.color,
          secciones: datos.secciones,
        });
      } else {
        const nuevo = await crearCurso({
          titulo: datos.titulo,
          descripcion: datos.descripcion,
          area: datos.area,
          color: datos.color,
        });
        if (datos.secciones.length > 0) {
          await actualizarCurso(nuevo.id, { secciones: datos.secciones });
        }
      }
      onGuardado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      setError(JSON.stringify(err.response?.data ?? "Error"));
    } finally { setEnviando(false); }
  }

  const esEdicion = !!cursoInicial;

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal-header">
          <h3>{esEdicion ? "Editar curso" : "Nuevo curso"}</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <form onSubmit={guardar}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" required maxLength={150}
                value={datos.titulo} onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea className="form-input" rows={3}
                value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Área</label>
                <select className="form-input" value={datos.area}
                  onChange={(e) => setDatos({ ...datos, area: e.target.value })}>
                  <option value="">— Selecciona —</option>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input type="color" className="form-input" value={datos.color}
                  onChange={(e) => setDatos({ ...datos, color: e.target.value })}
                  style={{ padding: 4, height: 42 }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Secciones que verán el curso</label>
              {secciones.length === 0 ? (
                <p className="form-hint" style={{ fontSize: 11 }}>Cargando secciones...</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {secciones.map((s) => {
                    const activo = datos.secciones.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSeccion(s.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 20,
                          border: `2px solid ${activo ? "var(--azul-600)" : "var(--borde)"}`,
                          background: activo ? "var(--azul-600)" : "var(--bg-panel)",
                          color: activo ? "white" : "var(--texto)",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 0.12s",
                        }}
                      >
                        {s.nombre || `${s.grado} ${s.letra}`}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="form-hint" style={{ fontSize: 11, marginTop: 6 }}>
                Si dejás vacío, solo vos verás el curso (útil para borradores).
              </p>
            </div>

            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={enviando || !datos.titulo}>
              {enviando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear curso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
