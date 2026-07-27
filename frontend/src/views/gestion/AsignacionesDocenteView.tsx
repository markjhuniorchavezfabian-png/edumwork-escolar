import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";
import { Cargando } from "../../components/ui/Spinner";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { AREAS_CNEB } from "../../constants/curriculo";

interface Seccion {
  id: number;
  nombre: string;
  grado: string;
  letra: string;
  nivel: string;
}

interface DocenteOp {
  id: number;
  nombre_completo?: string;
  username: string;
}

interface Asignacion {
  id: number;
  docente: number;
  docente_nombre: string;
  seccion: number;
  seccion_nombre: string;
  area: string;
  num_competencias: number;
}

const AREAS_COMUNES = AREAS_CNEB;

const AREAS_PROFESOR_AULA = [
  "Comunicación (3 comp.)",
  "Matemática (2 comp.)",
  "Personal Social (2 comp.)",
  "Ciencia y Tecnología (1 comp.)",
  "Arte y Cultura (1 comp.)",
  "Educación Física (1 comp.)",
  "Educación Religiosa (1 comp.)",
];

function nivelEsAula(nivel: string) {
  return nivel === "inicial" || nivel === "primaria";
}

export default function AsignacionesDocenteView() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [docentes, setDocentes] = useState<DocenteOp[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seccionActiva, setSeccionActiva] = useState<number | null>(null);

  // Formulario nueva asignación
  const [form, setForm] = useState({
    docente: "",
    area: "",
    areaPersonalizada: "",
  });
  const [docenteAula, setDocenteAula] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      type Paged<T> = { results?: T[]; count?: number } | T[];
      const [sRes, dRes, aRes] = await Promise.all([
        api.get<Paged<Seccion>>("/usuarios/secciones/?limit=200"),
        api.get<Paged<DocenteOp>>("/usuarios/?rol=docente&limit=200"),
        api.get<Paged<Asignacion>>("/notas/asignaciones/?limit=500"),
      ]);
      const toArray = <T,>(d: Paged<T>): T[] =>
        Array.isArray(d) ? d : ((d as { results?: T[] }).results ?? []);
      const secs = toArray(sRes.data);
      setSecciones(secs);
      setDocentes(toArray(dRes.data));
      setAsignaciones(toArray(aRes.data));
      if (secs.length > 0) setSeccionActiva((prev) => prev ?? secs[0].id);
    } catch {
      toast.error("Error al cargar datos.");
    } finally {
      setCargando(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { cargar(); }, [cargar]);

  const asigsDe = (seccionId: number) =>
    asignaciones.filter((a) => a.seccion === seccionId);

  async function agregar(seccionId: number) {
    const areaFinal = form.area === "__otro__" ? form.areaPersonalizada.trim() : form.area;
    if (!form.docente || !areaFinal) {
      toast.error("Selecciona docente y área.");
      return;
    }
    setGuardando(true);
    try {
      const { data } = await api.post<Asignacion>("/notas/asignaciones/", {
        docente: Number(form.docente),
        seccion: seccionId,
        area: areaFinal,
      });
      setAsignaciones((prev) => [...prev, data]);
      setForm({ docente: "", area: "", areaPersonalizada: "" });
      toast.ok(`Asignación creada: ${data.docente_nombre} → ${areaFinal}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; non_field_errors?: string[] } } };
      const msg = err.response?.data?.non_field_errors?.[0]
        || err.response?.data?.detail
        || "Error al crear asignación.";
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(asig: Asignacion) {
    const ok = await confirmar({
      titulo: "Eliminar asignación",
      mensaje: `¿Eliminar asignación de ${asig.docente_nombre} en ${asig.area}? Las notas ya registradas no se borran.`,
      variante: "peligro",
    });
    if (!ok) return;
    try {
      await api.delete(`/notas/asignaciones/${asig.id}/`);
      setAsignaciones((prev) => prev.filter((a) => a.id !== asig.id));
      toast.ok("Asignación eliminada.");
    } catch {
      toast.error("Error al eliminar.");
    }
  }

  async function asignarProfesorAula(seccionId: number) {
    setGuardando(true);
    try {
      const { data } = await api.post<{ asignaciones: Asignacion[]; total: number }>(
        "/notas/asignar-profesor-aula/",
        { seccion_id: seccionId, docente_id: docenteAula ? Number(docenteAula) : null }
      );
      // Reemplazar asignaciones de esta sección con las nuevas
      setAsignaciones((prev) => [
        ...prev.filter((a) => a.seccion !== seccionId),
        ...data.asignaciones.map((a) => ({ ...a, seccion: seccionId })),
      ]);
      setDocenteAula("");
      toast.ok(docenteAula
        ? `Profesor de aula asignado (${data.total} áreas creadas).`
        : "Asignaciones de esta sección eliminadas.");
    } catch {
      toast.error("Error al asignar profesor de aula.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <Cargando />;

  const seccionActual = secciones.find((s) => s.id === seccionActiva);

  return (
    <div>
      <h2 className="page-title">Asignaciones de docentes</h2>
      <p style={{ color: "var(--muted-foreground)", marginBottom: 20, fontSize: 14 }}>
        Aquí defines qué docente enseña cada área en cada sección. Esto permite que el docente vea
        a sus estudiantes y registre sus notas.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Panel izquierdo: lista de secciones */}
        <div style={{ minWidth: 180, maxHeight: "80vh", overflowY: "auto", paddingRight: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            Secciones
          </div>
          {secciones.map((s) => {
            const activo = seccionActiva === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSeccionActiva(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  marginBottom: 4,
                  background: activo ? "var(--primary)" : "var(--card)",
                  color: activo ? "var(--primary-foreground)" : "var(--foreground)",
                  fontWeight: activo ? 600 : 400,
                  fontSize: 14,
                  boxShadow: activo ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                <BookOpen size={14} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div>{s.nombre || `${s.grado} ${s.letra}`}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 400 }}>
                    {s.nivel === "inicial" ? "Inicial · Prof. aula"
                      : s.nivel === "primaria" ? "Primaria · Prof. aula"
                      : "Secundaria"}
                  </div>
                </div>
                <span style={{
                  fontSize: 11,
                  background: activo ? "rgba(255,255,255,0.2)" : "var(--muted)",
                  borderRadius: 10,
                  padding: "1px 7px",
                  flexShrink: 0,
                }}>
                  {asigsDe(s.id).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel derecho: asignaciones de la sección activa */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {seccionActual && (
            <Card titulo={`${seccionActual.nombre || `${seccionActual.grado} ${seccionActual.letra}`} — Asignaciones`}>
              {/* Badge de modo */}
              {nivelEsAula(seccionActual.nivel) && (
                <div style={{
                  background: "var(--azul-50)", border: "1px solid var(--azul-200)",
                  borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 16,
                  color: "var(--azul-800)",
                }}>
                  <strong>Nivel {seccionActual.nivel === "inicial" ? "Inicial" : "Primaria"}</strong> —
                  modo <em>Profesor de aula</em>. Un docente enseña todas las áreas de la sección.
                </div>
              )}

              {/* Tabla de asignaciones actuales */}
              {asigsDe(seccionActual.id).length === 0 ? (
                <p style={{ color: "var(--muted-foreground)", fontSize: 14, marginBottom: 16 }}>
                  Esta sección no tiene docentes asignados aún.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Área</th>
                      <th style={{ textAlign: "left", padding: "6px 8px" }}>Docente</th>
                      {!nivelEsAula(seccionActual.nivel) && <th style={{ width: 40 }} />}
                    </tr>
                  </thead>
                  <tbody>
                    {asigsDe(seccionActual.id).map((asig) => (
                      <tr key={asig.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 8px", fontWeight: 500 }}>{asig.area}</td>
                        <td style={{ padding: "8px 8px", color: "var(--muted-foreground)" }}>
                          {asig.docente_nombre}
                        </td>
                        {!nivelEsAula(seccionActual.nivel) && (
                          <td style={{ padding: "8px 4px", textAlign: "center" }}>
                            <button
                              onClick={() => eliminar(asig)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--destructive)", padding: 4 }}
                              title="Eliminar asignación"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Formulario — diferenciado por nivel */}
              {nivelEsAula(seccionActual.nivel) ? (
                /* Profesor de aula */
                <div style={{ background: "var(--muted)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    Asignar profesor de aula
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10 }}>
                    Se crearán automáticamente las asignaciones para: {AREAS_PROFESOR_AULA.join(", ")}.
                    Las asignaciones anteriores de esta sección se reemplazarán.
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div className="form-field" style={{ flex: 2, minWidth: 200 }}>
                      <label className="form-label">Docente (profesor de aula)</label>
                      <select
                        className="form-input"
                        value={docenteAula}
                        onChange={(e) => setDocenteAula(e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        {docentes.map((d) => (
                          <option key={d.id} value={d.id}>{d.nombre_completo || d.username}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn-primario"
                      disabled={!docenteAula || guardando}
                      onClick={() => asignarProfesorAula(seccionActual.id)}
                      style={{ marginBottom: 2, width: "auto" }}
                    >
                      {guardando ? "Asignando..." : "Asignar todas las áreas"}
                    </button>
                    {asigsDe(seccionActual.id).length > 0 && (
                      <button
                        className="btn btn-secundario"
                        disabled={guardando}
                        onClick={async () => {
                          const ok = await confirmar({
                            titulo: "Quitar todas las asignaciones",
                            mensaje: "¿Eliminar todas las asignaciones de esta sección? Las notas ya registradas no se borran.",
                            variante: "peligro",
                          });
                          if (ok) asignarProfesorAula(seccionActual.id);
                        }}
                        style={{ marginBottom: 2, width: "auto" }}
                      >
                        Quitar todas
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Secundaria — asignación por área */
                <div style={{ background: "var(--muted)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                    <Plus size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                    Agregar asignación
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div className="form-field" style={{ flex: 2, minWidth: 180 }}>
                      <label className="form-label">Docente</label>
                      <select
                        className="form-input"
                        value={form.docente}
                        onChange={(e) => setForm((p) => ({ ...p, docente: e.target.value }))}
                      >
                        <option value="">Seleccionar...</option>
                        {docentes.map((d) => (
                          <option key={d.id} value={d.id}>{d.nombre_completo || d.username}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field" style={{ flex: 2, minWidth: 180 }}>
                      <label className="form-label">Área</label>
                      <select
                        className="form-input"
                        value={form.area}
                        onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
                      >
                        <option value="">Seleccionar...</option>
                        {AREAS_COMUNES.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                        <option value="__otro__">Otra área...</option>
                      </select>
                    </div>
                    {form.area === "__otro__" && (
                      <div className="form-field" style={{ flex: 2, minWidth: 180 }}>
                        <label className="form-label">Nombre del área</label>
                        <input
                          className="form-input"
                          placeholder="Ej: Emprendimiento"
                          value={form.areaPersonalizada}
                          onChange={(e) => setForm((p) => ({ ...p, areaPersonalizada: e.target.value }))}
                        />
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      disabled={guardando}
                      onClick={() => agregar(seccionActual.id)}
                      style={{ marginBottom: 2 }}
                    >
                      {guardando ? "Guardando..." : "Agregar"}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
