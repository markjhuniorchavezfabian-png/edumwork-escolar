import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../../components/ui/Icon";
import type { DocenteDisponible, Seccion } from "../../types/gestion";
import {
  listarSecciones,
  crearSeccion,
  actualizarSeccion,
  eliminarSeccion,
  docentesDisponibles,
} from "../../services/gestion";
import Card from "../../components/ui/Card";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";
import { Cargando } from "../../components/ui/Spinner";
import api from "../../services/api";
import { FileText, FileSpreadsheet } from "lucide-react";

export default function SeccionesView() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [docentes, setDocentes] = useState<DocenteDisponible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<Seccion | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [ss, dd] = await Promise.all([listarSecciones(), docentesDisponibles()]);
      setSecciones(ss);
      setDocentes(dd);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function imprimirLista(s: Seccion, formato: "pdf" | "xlsx") {
    try {
      const { data } = await api.get(
        `/usuarios/secciones/${s.id}/imprimir/?formato=${formato}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lista_${s.nombre.replace(/\s/g, "_")}.${formato}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("No se pudo generar la lista.");
    }
  }

  async function borrar(s: Seccion) {
    if (s.cantidad_estudiantes > 0) {
      toast.error("No se puede eliminar: la sección tiene estudiantes asignados.");
      return;
    }
    const ok = await confirmar({ mensaje: `¿Eliminar la sección "${s.nombre}"?`, variante: "peligro", textoConfirmar: "Eliminar" });
    if (!ok) return;
    await eliminarSeccion(s.id);
    toast.ok("Sección eliminada.");
    cargar();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Gestión de secciones</h2>
        <button className="btn btn-primario" onClick={() => setCreando(true)} style={{ padding: "8px 14px", width: "auto" }}>
          + Nueva sección
        </button>
      </div>

      {(() => {
        const sinTutor = secciones.filter((s) => !s.tutor_nombre);
        if (sinTutor.length === 0) return null;
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 10, marginBottom: 16,
            background: "rgba(245, 158, 11, 0.10)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
          }}>
            <Icon name="alerta" size={20} style={{ color: "rgb(245,158,11)" }} />
            <div style={{ flex: 1, fontSize: 13 }}>
              <strong>{sinTutor.length}</strong> sección(es) sin tutor asignado:
              {" "}<span style={{ color: "var(--texto-mute)" }}>{sinTutor.map(s => s.nombre).join(", ")}</span>
            </div>
            <button
              className="btn btn-primario"
              style={{ padding: "6px 12px", fontSize: 13, width: "auto" }}
              onClick={() => setEditando(sinTutor[0])}
            >
              Asignar tutores
            </button>
          </div>
        );
      })()}

      <Card titulo={`Secciones (${secciones.length})`}>
        {cargando ? <Cargando inline /> : (
          <div className="tabla-wrap">
            <table className="tabla-incidencias">
              <thead>
                <tr>
                  <th>Nombre</th><th>Nivel</th><th>Grado</th><th>Letra</th><th>Tutor</th>
                  <th>Docentes</th><th>Estudiantes</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {secciones.map((s) => (
                  <tr key={s.id} style={{ cursor: "default" }}>
                    <td><strong>{s.nombre}</strong></td>
                    <td>
                      {s.nivel ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                          background: s.nivel === "inicial" ? "rgba(139, 92, 246, 0.12)"
                            : s.nivel === "primaria" ? "rgba(16, 185, 129, 0.12)"
                            : "rgba(59, 130, 246, 0.12)",
                          color: s.nivel === "inicial" ? "#7C3AED"
                            : s.nivel === "primaria" ? "#059669"
                            : "#2563EB",
                        }}>
                          {s.nivel.charAt(0).toUpperCase() + s.nivel.slice(1)}
                        </span>
                      ) : <em style={{ color: "var(--texto-suave)" }}>—</em>}
                    </td>
                    <td>{s.grado}</td>
                    <td>{s.letra}</td>
                    <td>
                      {s.tutor_nombre ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                            background: "var(--azul-100,#dbeafe)", color: "var(--azul-700,#1d4ed8)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 700,
                          }}>
                            {s.tutor_nombre.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13 }}>{s.tutor_nombre}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditando(s)}
                          style={{
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#B45309",
                            padding: "3px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(245, 158, 11, 0.35)",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                          }}
                        >
                          + Asignar tutor
                        </button>
                      )}
                    </td>
                    <td>{s.cantidad_docentes}</td>
                    <td>
                      <div>
                        <Link
                          to={`/estudiantes?seccion=${s.id}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600,
                                   color: s.cantidad_estudiantes > 0 ? "var(--azul-600,#2563eb)" : "var(--texto-mute)",
                                   textDecoration: "none", fontSize: 13 }}
                        >
                          {s.cantidad_estudiantes}
                          {s.cantidad_estudiantes > 0 && <span style={{ fontSize: 11, opacity: 0.7 }}>ver →</span>}
                        </Link>
                        {s.cantidad_estudiantes > 0 && (
                          <div style={{ marginTop: 4, height: 3, borderRadius: 2, width: 60, background: "var(--borde)" }}>
                            <div style={{
                              height: "100%", borderRadius: 2,
                              width: `${Math.min(100, (s.cantidad_estudiantes / 35) * 100)}%`,
                              background: s.cantidad_estudiantes >= 30 ? "#ef4444"
                                        : s.cantidad_estudiantes >= 20 ? "#f59e0b"
                                        : "#22c55e",
                            }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn-mini"
                          onClick={() => imprimirLista(s, "pdf")}
                          title="Descargar lista PDF"
                          disabled={s.cantidad_estudiantes === 0}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            ...(s.cantidad_estudiantes === 0 ? { opacity: 0.4, cursor: "not-allowed" } : {})
                          }}
                        >
                          <FileText size={12} /> PDF
                        </button>
                        <button
                          className="btn-mini"
                          onClick={() => imprimirLista(s, "xlsx")}
                          title="Descargar lista Excel"
                          disabled={s.cantidad_estudiantes === 0}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            ...(s.cantidad_estudiantes === 0 ? { opacity: 0.4, cursor: "not-allowed" } : {})
                          }}
                        >
                          <FileSpreadsheet size={12} /> XLSX
                        </button>
                        <button className="btn-mini" onClick={() => setEditando(s)}>Editar</button>
                        <button className="btn-mini" style={{ color: "var(--rojo-600)" }} onClick={() => borrar(s)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(creando || editando) && (
        <SeccionModal
          seccion={editando}
          docentes={docentes}
          secciones={secciones}
          onCerrar={() => { setCreando(false); setEditando(null); }}
          onGuardado={() => { setCreando(false); setEditando(null); cargar(); }}
        />
      )}
    </div>
  );
}

const GRADOS_POR_NIVEL: Record<string, string[]> = {
  inicial:    ["3 años", "4 años", "5 años"],
  primaria:   ["1ro", "2do", "3ro", "4to", "5to", "6to"],
  secundaria: ["1ro", "2do", "3ro", "4to", "5to"],
};

function siguienteLetra(secciones: Seccion[], nivel: string, grado: string): string {
  const letrasUsadas = secciones
    .filter(s => s.nivel === nivel && s.grado === grado)
    .map(s => (s.letra ?? "").toUpperCase())
    .filter(l => /^[A-Z]$/.test(l));
  for (let i = 0; i < 26; i++) {
    const candidata = String.fromCharCode(65 + i);
    if (!letrasUsadas.includes(candidata)) return candidata;
  }
  return "";
}

function SeccionModal({
  seccion, docentes, secciones, onCerrar, onGuardado,
}: {
  seccion: Seccion | null;
  docentes: DocenteDisponible[];
  secciones: Seccion[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const toast = useToast();
  const esNueva = seccion === null;
  const [datos, setDatos] = useState<Partial<Seccion>>(seccion ?? {
    nombre: "", grado: "", letra: "", tutor: null, docentes: [],
  });
  const [enviando, setEnviando] = useState(false);

  function actualizarNivel(nivel: string) {
    const gradosPosibles = GRADOS_POR_NIVEL[nivel] ?? [];
    const nuevoGrado = gradosPosibles[0] ?? "";
    const letra = esNueva ? siguienteLetra(secciones, nivel, nuevoGrado) : datos.letra ?? "";
    setDatos(d => ({ ...d, nivel: nivel as Seccion["nivel"], grado: nuevoGrado, letra }));
  }

  function actualizarGrado(grado: string) {
    const letra = esNueva && datos.nivel ? siguienteLetra(secciones, datos.nivel, grado) : datos.letra ?? "";
    setDatos(d => ({ ...d, grado, letra }));
  }

  function actualizarLetra(valor: string) {
    setDatos(d => ({ ...d, letra: valor.toUpperCase().slice(0, 1) }));
  }

  function toggleDocente(id: number) {
    const actual = datos.docentes ?? [];
    setDatos({ ...datos, docentes: actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id] });
  }

  async function guardar() {
    setEnviando(true);
    try {
      if (esNueva) {
        const nombre = datos.nombre || `${datos.grado} ${datos.letra}`.trim();
        await crearSeccion({ ...datos, nombre });
        toast.ok("Sección creada.");
      } else {
        await actualizarSeccion(seccion!.id, datos);
        toast.ok("Sección actualizada.");
      }
      onGuardado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{esNueva ? "Nueva sección" : `Editar ${seccion?.nombre}`}</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label className="form-label">Nivel educativo</label>
            <select
              className="form-input"
              value={datos.nivel ?? ""}
              onChange={(e) => actualizarNivel(e.target.value)}
            >
              <option value="">— Sin especificar —</option>
              <option value="inicial">Inicial</option>
              <option value="primaria">Primaria</option>
              <option value="secundaria">Secundaria</option>
            </select>
            <span style={{ fontSize: 11, color: "var(--texto-mute)" }}>
              Importante en colegios integrados (para diferenciar "1ro A primaria" de "1ro A secundaria").
            </span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Grado *</label>
              <select className="form-input" value={datos.grado ?? ""} onChange={(e) => actualizarGrado(e.target.value)}>
                <option value="">— Elegir nivel primero —</option>
                {(GRADOS_POR_NIVEL[datos.nivel ?? ""] ?? []).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Letra *</label>
              <input
                className="form-input"
                placeholder="Ej: A"
                value={datos.letra ?? ""}
                onChange={(e) => actualizarLetra(e.target.value)}
                style={{ textTransform: "uppercase" }}
                maxLength={1}
              />
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Nombre (opcional)</label>
            <input className="form-input" placeholder="Auto-generado si vacío (ej: '5to A')" value={datos.nombre ?? ""} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Tutor titular</label>
            <select className="form-input" value={datos.tutor ?? ""} onChange={(e) => setDatos({ ...datos, tutor: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— Sin tutor —</option>
              {docentes.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Docentes asignados</label>
            <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--borde)", borderRadius: 6, padding: 10 }}>
              {docentes.map((d) => (
                <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={(datos.docentes ?? []).includes(d.id)}
                    onChange={() => toggleDocente(d.id)}
                  />
                  {d.nombre} <span style={{ fontSize: 11, color: "var(--texto-mute)" }}>@{d.username}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar} disabled={enviando}>{enviando ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
