import { useEffect, useState } from "react";
import api from "../services/api";
import Card from "../components/ui/Card";
import { EmptyState, Cargando } from "../components/ui/Spinner";
import { useAuth } from "../hooks/useAuth";

interface Registro {
  id: number;
  usuario_username: string;
  tipo: string;
  tipo_label: string;
  modelo: string;
  objeto_id: string;
  descripcion: string;
  cambios: Record<string, unknown>;
  ip_origen: string | null;
  creado_en: string;
}

interface Paginado {
  count: number; next: string | null; previous: string | null; results: Registro[];
}

const MODELOS = ["", "Incidencia", "Equipo", "RegistroAsistencia", "Visita", "LLMConfig"];
const TIPOS = ["", "crear", "actualizar", "eliminar", "accion"];

export default function AuditoriaView() {
  const { usuario } = useAuth();
  const esDocente = usuario?.rol === "docente";
  const [data, setData] = useState<Paginado | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ modelo: "", tipo: "", usuario: "" });
  const [cargando, setCargando] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams({ page: String(pagina) });
    if (filtros.modelo) params.set("modelo", filtros.modelo);
    if (filtros.tipo) params.set("tipo", filtros.tipo);
    if (filtros.usuario) params.set("usuario", filtros.usuario);
    setCargando(true);
    api.get<Paginado>(`/auditoria/?${params}`).then(({ data }) => setData(data)).finally(() => setCargando(false));
  }, [pagina, filtros]);

  function toggle(id: number) {
    setExpandidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const totalPaginas = data ? Math.ceil(data.count / 30) : 1;

  return (
    <div>
      <h2 className="page-title">
        {esDocente ? "Historial de cambios en mis notas" : "Bitácora de auditoría"}
      </h2>

      {esDocente && (
        <div style={{
          background: "var(--azul-50)", border: "1px solid var(--azul-200)",
          borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13,
          color: "var(--azul-800)",
        }}>
          Acá ves si el director u otro rol modificó alguna nota de tus estudiantes.
          Solo se muestran cambios de calificación — tus propias cargas no aparecen.
        </div>
      )}

      {!esDocente && <Card titulo="Filtros">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-field">
            <label className="form-label">Módulo</label>
            <select className="form-input" value={filtros.modelo} onChange={(e) => { setFiltros({ ...filtros, modelo: e.target.value }); setPagina(1); }}>
              {MODELOS.map((m) => <option key={m} value={m}>{m || "Todos"}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Tipo</label>
            <select className="form-input" value={filtros.tipo} onChange={(e) => { setFiltros({ ...filtros, tipo: e.target.value }); setPagina(1); }}>
              {TIPOS.map((t) => <option key={t} value={t}>{t || "Todos"}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Usuario (contiene)</label>
            <input className="form-input" value={filtros.usuario} onChange={(e) => { setFiltros({ ...filtros, usuario: e.target.value }); setPagina(1); }} />
          </div>
        </div>
      </Card>}

      <Card titulo={`Registros (${data?.count ?? 0})`}>
        {cargando ? <Cargando inline /> : (data?.results?.length ?? 0) === 0 ? (
          <EmptyState icono="buscar" titulo="Sin registros"
            descripcion="No hay eventos de auditoría con los filtros actuales. Ajusta el rango de fechas o el módulo." />
        ) : (
          <>
            <div className="tabla-wrap" style={{ overflowX: "auto" }}>
              <table className="tabla-incidencias">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Módulo</th>
                    <th>Objeto</th>
                    <th>Descripción</th>
                    <th>IP</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.results.map((r) => (
                    <>
                      <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => toggle(r.id)}>
                        <td>{new Date(r.creado_en).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                        <td><strong>{r.usuario_username}</strong></td>
                        <td>
                          <span className="badge" style={{
                            background: r.tipo === "crear" ? "var(--verde-50)" : r.tipo === "actualizar" ? "var(--azul-100)" : r.tipo === "eliminar" ? "var(--rojo-50)" : "var(--slate-100)",
                            color: r.tipo === "crear" ? "var(--verde-600)" : r.tipo === "actualizar" ? "var(--azul-800)" : r.tipo === "eliminar" ? "var(--rojo-600)" : "var(--slate-700)",
                          }}>{r.tipo_label}</span>
                        </td>
                        <td>{r.modelo}</td>
                        <td><code style={{ fontSize: 12 }}>#{r.objeto_id}</code></td>
                        <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descripcion}</td>
                        <td style={{ fontSize: 11, color: "var(--texto-mute)" }}>{r.ip_origen || "—"}</td>
                        <td>{expandidos.has(r.id) ? "▼" : "▶"}</td>
                      </tr>
                      {expandidos.has(r.id) && Object.keys(r.cambios).length > 0 && (
                        <tr key={`${r.id}-detail`}>
                          <td colSpan={8} style={{ background: "var(--slate-50)", padding: 12 }}>
                            <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", margin: 0, fontFamily: "monospace" }}>
                              {JSON.stringify(r.cambios, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
              <span style={{ fontSize: 12, color: "var(--texto-mute)" }}>
                Página {pagina} de {totalPaginas}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-mini" disabled={!data?.previous} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
                <button className="btn-mini" disabled={!data?.next} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
