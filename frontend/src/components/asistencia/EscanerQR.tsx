import { useRef, useState } from "react";
import api from "../../services/api";
import { useQrScanner } from "../../hooks/useQrScanner";
import Icon from "../ui/Icon";

interface Resultado {
  ok: boolean;
  creado: boolean;
  estudiante: { id: number; nombre: string; grado: string; seccion: string; codigo_matricula: string };
  fecha: string;
  estado: string;
}

interface Props {
  fecha: string;
  onMarcado: () => void;
  onCerrar: () => void;
}

export default function EscanerQR({ fecha, onMarcado, onCerrar }: Props) {
  const contenedorId = "qr-scanner-container";
  const [estado, setEstado] = useState<"presente" | "tardanza">("presente");
  const [historial, setHistorial] = useState<Resultado[]>([]);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const { escaneando, error } = useQrScanner({
    contenedorId,
    qrbox: 280,
    onCodigo: async (codigo) => {
      const estadoActual = estadoRef.current;
      try {
        const { data } = await api.post<Resultado>("/asistencia/registros/marcar-qr/", {
          codigo, fecha, estado: estadoActual,
        });
        setHistorial((h) => [data, ...h].slice(0, 8));
        onMarcado();
        beep(true);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        const msg = err.response?.data?.error ?? "Error desconocido";
        setHistorial((h) => [{
          ok: false, creado: false,
          estudiante: { id: 0, nombre: `Error: ${msg}`, grado: "", seccion: "", codigo_matricula: codigo },
          fecha, estado: estadoActual,
        } as Resultado, ...h].slice(0, 8));
        beep(false);
      }
    },
  });

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="camara" size={18} /> Escáner de QR — Asistencia
          </h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px", minWidth: 300 }}>
              <div id={contenedorId} className="qr-camara"></div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label className="form-label" style={{ margin: 0 }}>Marcar como:</label>
                <button
                  className={`asistencia-btn asistencia-btn-presente ${estado === "presente" ? "asistencia-btn-activo" : ""}`}
                  onClick={() => setEstado("presente")}
                >Presente</button>
                <button
                  className={`asistencia-btn asistencia-btn-tardanza ${estado === "tardanza" ? "asistencia-btn-activo" : ""}`}
                  onClick={() => setEstado("tardanza")}
                >Tardanza</button>
              </div>
              {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
              {!error && (
                <p style={{ fontSize: 12, color: "var(--texto-mute)", marginTop: 8 }}>
                  {escaneando ? "🟢 Cámara activa. Apunta al QR del carnet del estudiante." : "Inicializando cámara..."}
                </p>
              )}
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <h4 style={{ marginBottom: 8, fontSize: 12, color: "var(--slate-700)", textTransform: "uppercase" }}>
                Últimos escaneos ({historial.length})
              </h4>
              <div className="qr-historial">
                {historial.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--texto-suave)", fontStyle: "italic" }}>
                    Aún no hay escaneos.
                  </p>
                )}
                {historial.map((r, i) => (
                  <div key={i} className={`qr-historial-item ${r.ok ? "ok" : "err"}`}>
                    <strong>{r.estudiante.nombre}</strong>
                    {r.ok && <span style={{ fontSize: 11, color: "var(--texto-mute)" }}>
                      {r.estudiante.grado} {r.estudiante.seccion} · {r.estado}
                    </span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primario" onClick={onCerrar} style={{ width: "auto" }}>
            Terminar
          </button>
        </div>
      </div>
    </div>
  );
}

function beep(exito: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = exito ? 880 : 220;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + (exito ? 0.15 : 0.4));
  } catch { /* noop */ }
}
