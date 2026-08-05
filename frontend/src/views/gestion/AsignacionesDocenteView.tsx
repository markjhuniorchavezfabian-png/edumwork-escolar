import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";
import { Cargando } from "../../components/ui/Spinner";
import { BookOpen, Save, CheckCircle2, Trash2 } from "lucide-react";

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

interface AreaCNEB {
  id: number;
  nombre: string;
  nivel: string;
  orden: number;
  num_competencias: number;
}

const ANIO_LECTIVO = 2026;

function toArray<T>(d: { results?: T[] } | T[] | undefined): T[] {
  if (!d) return [];
  return Array.isArray(d) ? d : (d.results ?? []);
}

export default function AsignacionesDocenteView() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [docentes, setDocentes] = useState<DocenteOp[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [areasCNEB, setAreasCNEB] = useState<AreaCNEB[]>([]);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState<number | null>(null);
  const [docenteGlobal, setDocenteGlobal] = useState<string>("");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [sRes, dRes, aRes] = await Promise.all([
        api.get("/usuarios/secciones/?limit=200"),
        api.get("/usuarios/?rol=docente&limit=200"),
        api.get(`/notas/asignaciones/?limit=500&anio=${ANIO_LECTIVO}`),
      ]);
      const secs = toArray<Seccion>(sRes.data);
      setSecciones(secs);
      setDocentes(toArray<DocenteOp>(dRes.data));
      const asigs = toArray<Asignacion>(aRes.data);
      setAsignaciones(asigs);
      if (secs.length > 0) {
        const primera = seccionActiva && secs.some((s) => s.id === seccionActiva)
          ? seccionActiva
          : secs[0].id;
        setSeccionActiva(primera);
      }
    } catch {
      toast.error("Error al cargar datos.");
    } finally {
      setCargando(false);
    }
  }, [seccionActiva]); // eslint-disable-line

  useEffect(() => { cargar(); }, [cargar]);

  const seccionActual = useMemo(
    () => secciones.find((s) => s.id === seccionActiva),
    [secciones, seccionActiva]
  );

  const asigsDe = useCallback(
    (seccionId: number) => asignaciones.filter((a) => a.seccion === seccionId),
    [asignaciones]
  );

  // Cargar áreas CNEB y construir mapa cuando cambia la sección activa
  useEffect(() => {
    if (!seccionActual) return;
    setCargando(true);
    const nivel = seccionActual.nivel;
    Promise.all([
      api.get(`/curricula/areas/?nivel=${encodeURIComponent(nivel)}&limit=200`),
    ])
      .then(([areasRes]) => {
        const areas = toArray<AreaCNEB>(areasRes.data);
        // Agregar áreas ya asignadas en esta sección que no estén en el CNEB
        const asigs = asigsDe(seccionActual.id);
        const areaNames = new Set(areas.map((a) => a.nombre));
        const extras: AreaCNEB[] = asigs
          .filter((a) => !areaNames.has(a.area))
          .map((a) => ({
            id: -a.id,
            nombre: a.area,
            nivel,
            orden: 999,
            num_competencias: a.num_competencias,
          }));
        const todas = [...areas, ...extras].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
        setAreasCNEB(todas);
        const nuevoMapa: Record<string, string> = {};
        for (const area of todas) {
          const asig = asigs.find((a) => a.area === area.nombre);
          nuevoMapa[area.nombre] = asig ? String(asig.docente) : "";
        }
        setMapa(nuevoMapa);
        setDocenteGlobal("");
      })
      .catch(() => toast.error("Error al cargar áreas del currículo."))
      .finally(() => setCargando(false));
  }, [seccionActual, asigsDe]); // eslint-disable-line

  function aplicarGlobal() {
    if (!docenteGlobal) return;
    const nuevo = { ...mapa };
    areasCNEB.forEach((a) => {
      nuevo[a.nombre] = docenteGlobal;
    });
    setMapa(nuevo);
    setDocenteGlobal("");
    toast.ok("Docente asignado a todas las áreas. Puedes ajustar antes de guardar.");
  }

  function limpiarTodas() {
    const nuevo: Record<string, string> = {};
    areasCNEB.forEach((a) => {
      nuevo[a.nombre] = "";
    });
    setMapa(nuevo);
  }

  async function guardar() {
    if (!seccionActual) return;
    setGuardando(true);
    const asigs = asigsDe(seccionActual.id);
    const errores: string[] = [];
    const acciones: Promise<unknown>[] = [];

    for (const area of areasCNEB) {
      const docenteIdRaw = mapa[area.nombre] || "";
      const docenteId = docenteIdRaw ? Number(docenteIdRaw) : null;
      const asigExistente = asigs.find((a) => a.area === area.nombre);

      if (!docenteId) {
        if (asigExistente) {
          acciones.push(
            api.delete(`/notas/asignaciones/${asigExistente.id}/`).catch(() => {
              errores.push(`No se pudo quitar ${area.nombre}`);
            })
          );
        }
        continue;
      }

      if (asigExistente) {
        if (asigExistente.docente !== docenteId) {
          acciones.push(
            api.patch(`/notas/asignaciones/${asigExistente.id}/`, {
              docente: docenteId,
              num_competencias: area.num_competencias,
            }).catch(() => {
              errores.push(`No se pudo cambiar docente en ${area.nombre}`);
            })
          );
        }
      } else {
        acciones.push(
          api.post("/notas/asignaciones/", {
            docente: docenteId,
            seccion: seccionActual.id,
            area: area.nombre,
            num_competencias: area.num_competencias,
            anio_lectivo: ANIO_LECTIVO,
          }).catch(() => {
            errores.push(`No se pudo crear asignación en ${area.nombre}`);
          })
        );
      }
    }

    await Promise.all(acciones);
    setGuardando(false);
    await cargar();
    if (errores.length) {
      toast.error(`Guardado parcial. Errores: ${errores.slice(0, 3).join(", ")}${errores.length > 3 ? "..." : ""}`);
    } else {
      toast.ok("Asignaciones guardadas.");
    }
  }

  if (cargando && secciones.length === 0) return <Cargando />;

  return (
    <div>
      <h2 className="page-title">Asignaciones de docentes</h2>
      <p style={{ color: "var(--muted-foreground)", marginBottom: 20, fontSize: 14 }}>
        Asigna docente por área en cada sección. En primaria/inicial el tutor puede llevar
        la mayoría, pero puedes dejar áreas para especialistas.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Panel izquierdo: secciones */}
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
                    {s.nivel === "inicial" ? "Inicial" : s.nivel === "primaria" ? "Primaria" : "Secundaria"}
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

        {/* Panel derecho: tabla masiva */}
        <div style={{ flex: 1, minWidth: 300 }}>
          {seccionActual && (
            <Card titulo={`${seccionActual.nombre || `${seccionActual.grado} ${seccionActual.letra}`} — Asignación por área`}>
              {/* Atajos */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
                <div className="form-field" style={{ flex: 2, minWidth: 200 }}>
                  <label className="form-label">Asignar docente a todas las áreas</label>
                  <select
                    className="form-input"
                    value={docenteGlobal}
                    onChange={(e) => setDocenteGlobal(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {docentes.map((d) => (
                      <option key={d.id} value={d.id}>{d.nombre_completo || d.username}</option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn btn-secundario"
                  disabled={!docenteGlobal || guardando}
                  onClick={aplicarGlobal}
                >
                  Aplicar a todas
                </button>
                <button
                  className="btn btn-secundario"
                  disabled={guardando}
                  onClick={async () => {
                    const ok = await confirmar({
                      titulo: "Quitar todas las asignaciones",
                      mensaje: "¿Dejar sin docente todas las áreas de esta sección?",
                      variante: "peligro",
                    });
                    if (ok) limpiarTodas();
                  }}
                >
                  Limpiar
                </button>
                <button
                  className="btn btn-primary"
                  disabled={guardando}
                  onClick={guardar}
                  style={{ marginLeft: "auto" }}
                >
                  <Save size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>

              {cargando ? (
                <Cargando />
              ) : areasCNEB.length === 0 ? (
                <p style={{ color: "var(--muted-foreground)" }}>
                  No hay áreas configuradas para el nivel {seccionActual.nivel}. Carga el CNEB primero.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Área</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", width: 100 }}>Competencias</th>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Docente</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {areasCNEB.map((area) => {
                      const asig = asigsDe(seccionActual.id).find((a) => a.area === area.nombre);
                      return (
                        <tr key={area.nombre} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ fontWeight: 500 }}>{area.nombre}</div>
                            {asig && (
                              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                                <CheckCircle2 size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                                Asignado: {asig.docente_nombre}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "center", padding: "8px 10px", color: "var(--muted-foreground)" }}>
                            {area.num_competencias}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <select
                              className="form-input"
                              value={mapa[area.nombre] || ""}
                              onChange={(e) => setMapa((prev) => ({ ...prev, [area.nombre]: e.target.value }))}
                              disabled={guardando}
                            >
                              <option value="">Sin asignar</option>
                              {docentes.map((d) => (
                                <option key={d.id} value={d.id}>{d.nombre_completo || d.username}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              className="btn btn-secundario"
                              title="Quitar asignación"
                              disabled={guardando || !mapa[area.nombre]}
                              onClick={() => setMapa((prev) => ({ ...prev, [area.nombre]: "" }))}
                              style={{ padding: "4px 8px" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="btn btn-primary"
                  disabled={guardando}
                  onClick={guardar}
                >
                  <Save size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
