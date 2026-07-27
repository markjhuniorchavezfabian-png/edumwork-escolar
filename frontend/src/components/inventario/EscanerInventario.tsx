import { useState } from "react";
import api from "../../services/api";
import type { Equipo } from "../../types/inventario";
import { ESTADO_EQUIPO_COLOR } from "../../types/inventario";
import { useQrScanner } from "../../hooks/useQrScanner";
import Icon from "../ui/Icon";

interface Props { onCerrar: () => void; onEditar?: (eq: Equipo) => void; }

export default function EscanerInventario({ onCerrar, onEditar }: Props) {
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [errorScan, setErrorScan] = useState<string | null>(null);

  const { error: errorCamara } = useQrScanner({
    contenedorId: "qr-inv-scanner",
    onCodigo: async (codigo) => {
      try {
        const { data } = await api.get<Equipo>(`/inventario/equipos/por-codigo/${encodeURIComponent(codigo)}/`);
        setEquipo(data);
      } catch {
        setErrorScan(`Equipo con código "${codigo}" no encontrado.`);
        setTimeout(() => setErrorScan(null), 3000);
      }
    },
  });

  const error = errorCamara || errorScan;

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="camara" size={18} /> Escanear QR de equipo
          </h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
            <div>
              <div id="qr-inv-scanner" className="qr-camara" style={{ minHeight: 280 }} />
              {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
              <p style={{ fontSize: 12, color: "var(--texto-mute)", marginTop: 8 }}>
                Apunta al QR pegado en el equipo.
              </p>
            </div>

            <div>
              {equipo ? (
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--texto-mute)", letterSpacing: 0.05 }}>
                    Ficha del equipo
                  </div>
                  <h3 style={{ fontSize: 16, marginTop: 4 }}>{equipo.codigo_inventario}</h3>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                    <div><strong>Tipo:</strong> {equipo.tipo_label}</div>
                    <div><strong>Marca / modelo:</strong> {equipo.marca} {equipo.modelo}</div>
                    <div><strong>N° serie:</strong> <code style={{ fontSize: 11 }}>{equipo.numero_serie || "—"}</code></div>
                    <div><strong>Ubicación:</strong> {equipo.ubicacion} {equipo.ambiente_nombre && `(${equipo.ambiente_nombre})`}</div>
                    <div>
                      <strong>Estado:</strong>{" "}
                      <span className="badge" style={{ background: "var(--slate-100)", color: ESTADO_EQUIPO_COLOR[equipo.estado] }}>
                        {equipo.estado_label}
                      </span>
                    </div>
                    {equipo.valor_referencial && <div><strong>Valor:</strong> S/ {Number(equipo.valor_referencial).toLocaleString("es-PE")}</div>}
                  </div>
                  {onEditar && (
                    <button className="btn btn-primario btn-icono" style={{ marginTop: 12, width: "100%" }} onClick={() => { onEditar(equipo); onCerrar(); }}>
                      <Icon name="editar" /> Editar / Reportar
                    </button>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--texto-mute)" }}>Sin lecturas todavía.</p>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
