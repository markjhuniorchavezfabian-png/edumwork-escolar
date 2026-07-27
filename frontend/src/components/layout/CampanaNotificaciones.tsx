import { useEffect, useRef, useState } from "react";
import type { Notificacion } from "../../services/notificaciones";
import { misNotificaciones, marcarLeidaNotif, marcarTodasLeidas } from "../../services/notificaciones";
import { useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";

const INTERVALO_MS = 60_000;

type IconName = Parameters<typeof Icon>[0]["name"];
const ICONO_POR_TIPO: Record<string, IconName> = {
  asistencia: "check",
  comunicado: "megafono",
  incidencia: "alerta",
  convivencia: "escudo",
  visita:     "puerta",
  reserva:    "calendario",
  general:    "campana",
};

export default function CampanaNotificaciones() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const cargar = async () => {
    try {
      const r = await misNotificaciones();
      setNotifs(r.resultados);
      setNoLeidas(r.no_leidas);
    } catch (e) { console.warn("[campana]", e); }
  };

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, INTERVALO_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener("mousedown", cerrar);
      return () => document.removeEventListener("mousedown", cerrar);
    }
  }, [abierto]);

  async function abrirNotif(n: Notificacion) {
    if (!n.leida) {
      try {
        await marcarLeidaNotif(n.id);
        setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, leida: true } : x));
        setNoLeidas((c) => Math.max(0, c - 1));
      } catch (e) { console.warn("[campana]", e); }
    }
    if (n.url_accion) {
      navigate(n.url_accion);
      setAbierto(false);
    }
  }

  async function limpiarTodas() {
    try {
      await marcarTodasLeidas();
      setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
      setNoLeidas(0);
    } catch (e) { console.warn("[campana]", e); }
  }

  return (
    <div className="campana-wrap" ref={contenedorRef}>
      <button
        className="campana-btn"
        onClick={() => setAbierto(!abierto)}
        aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} sin leer)` : ""}`}
        title="Notificaciones"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {noLeidas > 0 && <span className="campana-badge">{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>

      {abierto && (
        <div className="campana-dropdown">
          <div className="campana-header">
            <strong>Notificaciones</strong>
            {noLeidas > 0 && (
              <button className="btn-mini" onClick={limpiarTodas}>Marcar todas leídas</button>
            )}
          </div>
          <div className="campana-lista">
            {notifs.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--texto-mute)", fontSize: 13 }}>
                Sin notificaciones.
              </div>
            )}
            {notifs.map((n) => (
              <button key={n.id} className={`campana-item ${n.leida ? "leida" : ""}`} onClick={() => abrirNotif(n)}>
                <span className="campana-item-icono"><Icon name={ICONO_POR_TIPO[n.tipo] ?? "campana"} size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="campana-item-titulo">{n.titulo}</div>
                  <div className="campana-item-cuerpo">{n.cuerpo}</div>
                  <div className="campana-item-fecha">
                    {new Date(n.creado_en).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                {!n.leida && <span className="campana-item-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
