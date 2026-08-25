import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import { Cargando, EmptyState } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../hooks/useAuth";

interface Ambiente {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  tipo_label?: string;
  edificio: string;
  piso: string;
  capacidad: number | null;
  reservable: boolean;
}

interface Bitacora {
  id: number;
  ambiente: number;
  ambiente_codigo: string;
  ambiente_nombre: string;
  usuario_nombre: string;
  motivo: string;
  inicio: string;
  fin: string | null;
  estado_salida: string;
  estado_salida_label: string;
  observaciones: string;
  incidencia_relacionada: number | null;
  abierta: boolean;
}

/** Vista que se abre al escanear el QR de un ambiente: /ambiente/CODIGO */
export default function AmbientePublicoView() {
  const { codigo } = useParams<{ codigo: string }>();
  const { usuario } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [ambiente, setAmbiente] = useState<Ambiente | null>(null);
  const [historial, setHistorial] = useState<Bitacora[]>([]);
  const [miAbierta, setMiAbierta] = useState<Bitacora | null>(null);
  const [cargando, setCargando] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cerrandoModal, setCerrandoModal] = useState<Bitacora | null>(null);

  async function cargar() {
    if (!codigo) return;
    setCargando(true);
    try {
      const { data: amb } = await api.get<Ambiente>(`/ambientes/por-codigo/${encodeURIComponent(codigo)}/`);
      setAmbiente(amb);
      const { data: bits } = await api.get<{ results?: Bitacora[] } | Bitacora[]>(`/ambientes/bitacoras/?codigo=${encodeURIComponent(codigo)}`);
      const lista = Array.isArray(bits) ? bits : (bits.results ?? []);
      setHistorial(lista);
      const abierta = lista.find((b) => b.abierta && b.usuario_nombre.includes(usuario?.first_name ?? "___"));
      setMiAbierta(abierta ?? null);
    } catch {
      setAmbiente(null);
    } finally { setCargando(false); }
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [codigo]);

  async function abrirSesion() {
    if (!ambiente) return;
    setEnviando(true);
    try {
      await api.post("/ambientes/bitacoras/", { ambiente: ambiente.id, motivo });
      toast.ok(`Sesión iniciada en ${ambiente.nombre}.`);
      setMotivo("");
      cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail ?? "Error al iniciar sesión.");
    } finally { setEnviando(false); }
  }

  if (cargando) return <Cargando />;
  if (!ambiente) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyState icono="puerta" titulo="Ambiente no encontrado"
          descripcion={`No hay ambiente con código "${codigo}". Verifica el QR o pregunta al equipo TIC.`}
          accion={<Link to="/" className="btn btn-primario btn-icono" style={{ width: "auto" }}>
            <Icon name="casa" /> Ir al inicio
          </Link>} />
      </div>
    );
  }

  return (
    <div>
      {/* Cabecera del ambiente */}
      <div style={{
        background: "linear-gradient(135deg, var(--azul-600), var(--azul-800))",
        color: "white",
        padding: "24px 28px",
        borderRadius: 16,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.05 }}>
          {ambiente.tipo_label || ambiente.tipo}
        </div>
        <h2 style={{ margin: "4px 0 6px", fontSize: 28 }}>{ambiente.nombre}</h2>
        <div style={{ fontSize: 14, opacity: 0.9 }}>
          <code style={{ background: "rgba(255,255,255,.15)", padding: "2px 8px", borderRadius: 4 }}>
            {ambiente.codigo}
          </code>
          {ambiente.edificio && <> · {ambiente.edificio}</>}
          {ambiente.piso && <> · {ambiente.piso}</>}
          {ambiente.capacidad && <> · Capacidad {ambiente.capacidad}</>}
        </div>
      </div>

      {/* Si tiene sesión abierta */}
      {miAbierta ? (
        <Card titulo="Tienes una sesión abierta acá">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div><strong>Inicio:</strong> {new Date(miAbierta.inicio).toLocaleString("es-PE")}</div>
            {miAbierta.motivo && <div><strong>Motivo:</strong> {miAbierta.motivo}</div>}
          </div>
          <button className="btn btn-primario btn-icono" style={{ marginTop: 14, width: "auto" }}
            onClick={() => setCerrandoModal(miAbierta)}>
            <Icon name="detener" /> Cerrar sesión de uso
          </button>
        </Card>
      ) : (
        /* Iniciar nueva sesión */
        <Card titulo="Iniciar sesión de uso">
          <div className="form-group">
            <label className="form-label">Motivo (opcional)</label>
            <input className="form-input" value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Clase de Comunicación 3A, reunión de padres, ensayo teatro..." />
          </div>
          <button className="btn btn-primario btn-icono" onClick={abrirSesion} disabled={enviando}
            style={{ width: "auto", marginTop: 6 }}>
            <Icon name="reproducir" /> {enviando ? "Iniciando..." : "Comenzar a usar este ambiente"}
          </button>
          <p className="form-hint" style={{ fontSize: 11, marginTop: 10 }}>
            Al cerrar la sesión te pedirá reportar el estado del ambiente. Si algo no funciona, puedes
            abrir una incidencia TIC directamente desde ahí.
          </p>
        </Card>
      )}

      {/* Historial reciente */}
      <Card titulo={`Historial de uso (${historial.length})`}>
        {historial.length === 0 ? (
          <EmptyState icono="documento" titulo="Sin registros" descripcion="Este ambiente aún no tiene bitácora de uso." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historial.slice(0, 20).map((b) => (
              <div key={b.id} style={{
                padding: 12, borderRadius: 8,
                border: `1px solid ${b.abierta ? "var(--verde-600)" : "var(--borde)"}`,
                background: b.abierta ? "var(--verde-50)" : "var(--bg-panel)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{b.usuario_nombre}</strong>
                    {b.motivo && <span style={{ fontSize: 12, color: "var(--texto-mute)" }}> · {b.motivo}</span>}
                  </div>
                  {b.abierta ? (
                    <span className="badge" style={{ background: "var(--verde-100)", color: "var(--verde-700)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Icon name="check" size={11} /> En uso
                    </span>
                  ) : (
                    <span className="badge" style={{
                      background: b.estado_salida === "incidente" ? "var(--rojo-50)" :
                                  b.estado_salida === "observacion" ? "var(--amarillo-50)" : "var(--slate-100)",
                      color: b.estado_salida === "incidente" ? "var(--rojo-600)" :
                             b.estado_salida === "observacion" ? "var(--amarillo-600)" : "var(--slate-700)",
                    }}>{b.estado_salida_label || "Finalizado"}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--texto-mute)", marginTop: 4 }}>
                  {new Date(b.inicio).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {b.fin && <> — {new Date(b.fin).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</>}
                </div>
                {b.observaciones && (
                  <div style={{ fontSize: 12, marginTop: 6, padding: 6, background: "var(--slate-50)", borderRadius: 4 }}>
                    {b.observaciones}
                  </div>
                )}
                {b.incidencia_relacionada && (
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    <Link to={`/incidencias?id=${b.incidencia_relacionada}`}>
                      Ver incidencia relacionada →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {cerrandoModal && (
        <CerrarSesionModal bitacora={cerrandoModal}
          onCerrar={() => setCerrandoModal(null)}
          onCerrada={() => { setCerrandoModal(null); toast.ok("Sesión cerrada."); cargar(); }}
          irAIncidencia={(id) => navigate(`/incidencias?id=${id}`)} />
      )}
    </div>
  );
}

function CerrarSesionModal({ bitacora, onCerrar, onCerrada, irAIncidencia }: {
  bitacora: Bitacora; onCerrar: () => void; onCerrada: () => void; irAIncidencia: (id: number) => void;
}) {
  const [estado, setEstado] = useState<"ok" | "observacion" | "incidente">("ok");
  const [observaciones, setObservaciones] = useState("");
  const [crearIncidencia, setCrearIncidencia] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function cerrar() {
    setEnviando(true);
    try {
      const { data } = await api.post<Bitacora>(`/ambientes/bitacoras/${bitacora.id}/cerrar/`, {
        estado_salida: estado,
        observaciones,
        crear_incidencia: crearIncidencia && estado === "incidente",
      });
      onCerrada();
      if (data.incidencia_relacionada) {
        irAIncidencia(data.incidencia_relacionada);
      }
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Cerrar sesión de uso</h3>
          <button className="modal-cerrar" onClick={onCerrar}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--texto-mute)", marginBottom: 16 }}>
            ¿Cómo dejas el ambiente <strong>{bitacora.ambiente_nombre}</strong>?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { val: "ok", label: "Todo OK", color: "var(--verde-600)" },
              { val: "observacion", label: "Con observación", color: "var(--amarillo-600)" },
              { val: "incidente", label: "Reportar", color: "var(--rojo-600)" },
            ].map((o) => (
              <button key={o.val} type="button"
                onClick={() => setEstado(o.val as typeof estado)}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: `2px solid ${estado === o.val ? o.color : "var(--borde)"}`,
                  background: estado === o.val ? `${o.color}15` : "var(--bg-panel)",
                  color: estado === o.val ? o.color : "var(--texto)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                {o.label}
              </button>
            ))}
          </div>

          {(estado === "observacion" || estado === "incidente") && (
            <div className="form-group">
              <label className="form-label">
                Cuenta qué pasó {estado === "incidente" && "(obligatorio)"}
              </label>
              <textarea className="form-input" rows={4}
                value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: proyector no enciende, faltaba tiza, silla rota..." />
            </div>
          )}

          {estado === "incidente" && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 8 }}>
              <input type="checkbox" checked={crearIncidencia}
                onChange={(e) => setCrearIncidencia(e.target.checked)} />
              <span>Abrir incidencia TIC automáticamente para que admin_tic la vea.</span>
            </label>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario btn-icono" onClick={cerrar}
            disabled={enviando || (estado === "incidente" && !observaciones.trim())}>
            <Icon name="check" /> {enviando ? "Cerrando..." : "Cerrar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
