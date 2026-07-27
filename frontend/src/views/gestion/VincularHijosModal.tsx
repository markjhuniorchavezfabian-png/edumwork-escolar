import { useEffect, useMemo, useState } from "react";
import type { EstudianteResumen } from "../../services/gestion";
import { listarEstudiantesPickeables, vincularHijos } from "../../services/gestion";
import { useToast } from "../../components/ui/Toast";
import api from "../../services/api";

interface Props {
  idPadre: number;
  nombrePadre: string;
  onCerrar: () => void;
  onGuardado: () => void;
}

export default function VincularHijosModal({ idPadre, nombrePadre, onCerrar, onGuardado }: Props) {
  const toast = useToast();
  const [estudiantes, setEstudiantes] = useState<EstudianteResumen[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Cargar todos los estudiantes y la lista actual de hijos vinculados
    Promise.all([
      listarEstudiantesPickeables(),
      api.get<{ hijos: Array<{ estudiante_id: number }> }>("/asistencia/registros/mis-hijos/").catch(() => ({ data: { hijos: [] } })),
    ])
      .then(([ests, hijosResp]) => {
        setEstudiantes(ests);
        // Nota: el endpoint /mis-hijos solo funciona si el logueado es padre.
        // Como el staff vincula desde afuera, hay que traer el estado desde otro lado.
        // Solución simple: cargar los hijos del padre via el endpoint de detail del usuario si existe.
        // Para MVP, dejamos la selección vacía y el staff marca desde cero.
        void hijosResp;
      })
      .finally(() => setCargando(false));
  }, [idPadre]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return estudiantes;
    return estudiantes.filter((e) =>
      e.nombre_completo.toLowerCase().includes(q) ||
      e.codigo_matricula?.toLowerCase().includes(q)
    );
  }, [estudiantes, busqueda]);

  function toggle(id: number) {
    const n = new Set(seleccionados);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSeleccionados(n);
  }

  async function guardar() {
    setEnviando(true);
    try {
      const r = await vincularHijos(idPadre, [...seleccionados]);
      toast.ok(`${r.hijos_vinculados.length} hijos vinculados a ${nombrePadre}.`);
      onGuardado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Vincular hijos a <em>{nombrePadre}</em></h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 12, color: "var(--texto-mute)", marginBottom: 8 }}>
            Marca los estudiantes que son hijos/as de este padre/madre. Puedes seleccionar múltiples.
          </p>
          <input
            className="form-input"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {cargando ? <p>Cargando estudiantes...</p> : (
            <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--borde)", borderRadius: 8 }}>
              {filtrados.map((est) => (
                <label
                  key={est.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--borde)",
                    cursor: "pointer",
                    background: seleccionados.has(est.id) ? "var(--azul-50)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.has(est.id)}
                    onChange={() => toggle(est.id)}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{est.nombre_completo}</div>
                    <div style={{ fontSize: 11.5, color: "var(--texto-mute)" }}>
                      {est.grado} {est.seccion} · <code>{est.codigo_matricula || "sin código"}</code>
                    </div>
                  </div>
                </label>
              ))}
              {filtrados.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--texto-mute)", fontSize: 13 }}>
                  Sin resultados.
                </div>
              )}
            </div>
          )}
          <p style={{ fontSize: 12, color: "var(--texto-suave)", marginTop: 8 }}>
            {seleccionados.size} estudiante{seleccionados.size === 1 ? "" : "s"} seleccionado{seleccionados.size === 1 ? "" : "s"}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar} disabled={enviando || seleccionados.size === 0}>
            {enviando ? "Vinculando..." : `Vincular ${seleccionados.size} hijos`}
          </button>
        </div>
      </div>
    </div>
  );
}
