import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { Cargando } from "../components/ui/Spinner";
import { AREAS_CNEB } from "../constants/curriculo";

const DIAS_BASE = [
  { key: "lun", label: "Lunes" },
  { key: "mar", label: "Martes" },
  { key: "mie", label: "Miércoles" },
  { key: "jue", label: "Jueves" },
  { key: "vie", label: "Viernes" },
  { key: "sab", label: "Sábado" },
];

const HORAS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
];

const NL_COLORS = [
  "#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed",
  "#0891b2", "#be185d", "#92400e", "#065f46", "#1e3a5f",
  "#6d28d9", "#b91c1c",
];

interface Asignacion {
  id: number;
  seccion: number;
  seccion_nombre: string;
  area: string;
}

interface Horario {
  id: number;
  asignacion: number;
  area: string;
  seccion_id: number;
  seccion_nombre: string;
  docente_nombre: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
}

interface FormData {
  asignacion: string;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
}

const ROLES_PUEDEN_EDITAR = ["docente"];

function colorPorArea(area: string): string {
  const idx = AREAS_CNEB.indexOf(area as typeof AREAS_CNEB[number]);
  return NL_COLORS[idx >= 0 ? idx % NL_COLORS.length : 0];
}

export default function HorarioView() {
  const { usuario } = useAuth();
  const toast = useToast();
  const puedeEditar = usuario ? ROLES_PUEDEN_EDITAR.includes(usuario.rol) : false;

  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState<{ abierto: boolean; editando: Horario | null }>({
    abierto: false,
    editando: null,
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get<Horario[]>("/notas/horario/");
      setHorarios(data);
    } catch {
      toast.error("Error al cargar el horario.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario?.rol === "docente") {
      api.get<Asignacion[]>("/notas/mis-asignaciones/")
        .then(({ data }) => setAsignaciones(data))
        .catch(() => {});
    }
  }, [usuario?.rol]);

  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este bloque del horario?")) return;
    try {
      await api.delete(`/notas/horario/${id}/`);
      toast.ok("Bloque eliminado.");
      cargar();
    } catch {
      toast.error("No se pudo eliminar.");
    }
  }

  // Solo mostrar días que tienen datos (+ lun-vie siempre)
  const diasConDatos = new Set(horarios.map(h => h.dia_semana));
  const DIAS = DIAS_BASE.filter(d => d.key !== "sab" || diasConDatos.has("sab"));

  // Grilla dinámica: filas = todas las hora_inicio presentes en datos
  const grilla: Record<string, Record<string, Horario[]>> = {};
  for (const d of DIAS) grilla[d.key] = {};
  for (const h of horarios) {
    const horaKey = h.hora_inicio.slice(0, 5);
    if (!grilla[h.dia_semana]) continue;
    if (!grilla[h.dia_semana][horaKey]) grilla[h.dia_semana][horaKey] = [];
    grilla[h.dia_semana][horaKey].push(h);
  }

  // Filas: union de horas con datos + horas estándar del turno presente, ordenadas
  const horasEnDatos = [...new Set(horarios.map(h => h.hora_inicio.slice(0, 5)))];
  const horasConDatos = [...new Set([...horasEnDatos, ...HORAS.filter(h =>
    DIAS.some(d => (grilla[d.key][h] ?? []).length > 0)
  )])].sort();

  return (
    <div>
      <h2 className="page-title">Horario semanal</h2>
      <p style={{ color: "var(--muted-foreground)", marginBottom: 20, fontSize: 14 }}>
        {puedeEditar
          ? "Gestiona los bloques de clase de la semana."
          : "Horario de clases de tu sección."}
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {puedeEditar && (
          <button
            className="btn btn-primary"
            style={{ marginLeft: "auto" }}
            onClick={() => setModal({ abierto: true, editando: null })}
          >
            + Agregar bloque
          </button>
        )}
      </div>

      {cargando ? (
        <Cargando />
      ) : horarios.length === 0 ? (
        <div style={{
          background: "var(--muted)", borderRadius: 10, padding: 32,
          textAlign: "center", color: "var(--muted-foreground)", fontSize: 14,
        }}>
          {puedeEditar
            ? 'No hay bloques de horario. Haz clic en "+ Agregar bloque" para comenzar.'
            : "El docente aún no publicó el horario."}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", fontSize: 13,
            minWidth: 600,
          }}>
            <thead>
              <tr>
                <th style={thStyle}>Hora</th>
                {DIAS.map((d) => (
                  <th key={d.key} style={thStyle}>{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(horasConDatos.length > 0 ? horasConDatos : ["08:00","09:00","10:00","11:00","12:00"]).map((hora) => (
                <tr key={hora}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                    {hora}
                  </td>
                  {DIAS.map((d) => {
                    const bloques = grilla[d.key][hora] ?? [];
                    return (
                      <td key={d.key} style={{ ...tdStyle, verticalAlign: "top", padding: 4 }}>
                        {bloques.map((b) => (
                          <BloqueHorario
                            key={b.id}
                            bloque={b}
                            puedeEditar={puedeEditar && (
                              usuario?.rol !== "docente" || b.docente_nombre === `${usuario?.first_name} ${usuario?.last_name}`.trim()
                            )}
                            onEditar={() => setModal({ abierto: true, editando: b })}
                            onEliminar={() => eliminar(b.id)}
                          />
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal.abierto && (
        <HorarioModal
          asignaciones={asignaciones}
          editando={modal.editando}
          onCerrar={() => setModal({ abierto: false, editando: null })}
          onGuardado={() => {
            setModal({ abierto: false, editando: null });
            toast.ok(modal.editando ? "Bloque actualizado." : "Bloque agregado.");
            cargar();
          }}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  background: "var(--muted)",
  padding: "8px 10px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  borderBottom: "2px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--border)",
  minWidth: 120,
};

function BloqueHorario({
  bloque, puedeEditar, onEditar, onEliminar,
}: {
  bloque: Horario;
  puedeEditar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const color = colorPorArea(bloque.area);
  return (
    <div style={{
      background: `${color}18`,
      border: `2px solid ${color}`,
      borderRadius: 8,
      padding: "5px 8px",
      marginBottom: 4,
      position: "relative",
    }}>
      <div style={{ fontWeight: 700, fontSize: 12, color }}>{bloque.area}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        {bloque.hora_inicio.slice(0, 5)} – {bloque.hora_fin.slice(0, 5)}
      </div>
      {bloque.seccion_nombre && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{bloque.seccion_nombre}</div>
      )}
      {bloque.aula && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Aula: {bloque.aula}</div>
      )}
      {puedeEditar && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button
            onClick={onEditar}
            style={{ fontSize: 10, padding: "2px 6px", background: color, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Editar
          </button>
          <button
            onClick={onEliminar}
            style={{ fontSize: 10, padding: "2px 6px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function HorarioModal({
  asignaciones, editando, onCerrar, onGuardado,
}: {
  asignaciones: Asignacion[];
  editando: Horario | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    asignacion: editando ? String(editando.asignacion) : (asignaciones[0] ? String(asignaciones[0].id) : ""),
    dia_semana: editando?.dia_semana ?? "lun",
    hora_inicio: editando?.hora_inicio?.slice(0, 5) ?? "08:00",
    hora_fin: editando?.hora_fin?.slice(0, 5) ?? "09:00",
    aula: editando?.aula ?? "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.asignacion) { setError("Selecciona una asignación."); return; }
    if (form.hora_fin <= form.hora_inicio) { setError("La hora de fin debe ser posterior a la hora de inicio."); return; }
    setError(null);
    setEnviando(true);
    try {
      const payload = {
        asignacion: Number(form.asignacion),
        dia_semana: form.dia_semana,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        aula: form.aula,
      };
      if (editando) {
        await api.patch(`/notas/horario/${editando.id}/`, payload);
      } else {
        await api.post("/notas/horario/", payload);
      }
      onGuardado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      const data = err.response?.data;
      if (typeof data === "object" && data !== null) {
        const msgs = Object.values(data).flat().join(" ");
        setError(msgs || "Error al guardar.");
      } else {
        setError("Error al guardar.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>{editando ? "Editar bloque" : "Agregar bloque al horario"}</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <form onSubmit={guardar}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Área / Asignación *</label>
              <select
                className="form-input"
                required
                value={form.asignacion}
                onChange={(e) => setForm({ ...form, asignacion: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                {asignaciones.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.seccion_nombre} — {a.area}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Día *</label>
              <select
                className="form-input"
                value={form.dia_semana}
                onChange={(e) => setForm({ ...form, dia_semana: e.target.value })}
              >
                {DIAS_BASE.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Hora inicio *</label>
                <input
                  type="time"
                  className="form-input"
                  required
                  value={form.hora_inicio}
                  onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Hora fin *</label>
                <input
                  type="time"
                  className="form-input"
                  required
                  value={form.hora_fin}
                  onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Aula (opcional)</label>
              <input
                className="form-input"
                placeholder="Ej: Aula 201, Lab. Cómputo"
                value={form.aula}
                onChange={(e) => setForm({ ...form, aula: e.target.value })}
              />
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={enviando}>
              {enviando ? "Guardando..." : editando ? "Guardar cambios" : "Agregar bloque"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
