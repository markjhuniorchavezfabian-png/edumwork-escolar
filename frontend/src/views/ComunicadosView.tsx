import { useCallback, useEffect, useState } from "react";
import type { Comunicado, CategoriaComunicado, AlcanceComunicado, LecturaComunicado } from "../types/comunicados";
import { CATEGORIA_COLOR } from "../types/comunicados";
import {
  listarComunicados,
  crearComunicado,
  marcarLeido,
  lecturasDeComunicado,
  eliminarComunicado,
} from "../services/comunicados";
import api from "../services/api";
import { listarSecciones } from "../services/gestion";
import type { Seccion } from "../types/gestion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { useConfirm } from "../components/ui/Confirm";
import Icon from "../components/ui/Icon";
import { EmptyState, Cargando } from "../components/ui/Spinner";

const CATEGORIAS: Array<{ codigo: CategoriaComunicado; etiqueta: string }> = [
  { codigo: "academico", etiqueta: "Académico" },
  { codigo: "administrativo", etiqueta: "Administrativo" },
  { codigo: "actividad", etiqueta: "Actividad / Evento" },
  { codigo: "recordatorio", etiqueta: "Recordatorio" },
  { codigo: "convocatoria", etiqueta: "Convocatoria" },
  { codigo: "emergencia", etiqueta: "Emergencia" },
];

const ALCANCES: Array<{ codigo: AlcanceComunicado; etiqueta: string }> = [
  { codigo: "toda_ie", etiqueta: "Toda la institución" },
  { codigo: "seccion", etiqueta: "Una sección" },
  { codigo: "staff", etiqueta: "Solo personal" },
  { codigo: "padres", etiqueta: "Solo padres" },
];

const ROLES_PUBLICAR = ["director", "subdirector", "docente", "psicologa", "secretaria", "admin_tic"];

export default function ComunicadosView() {
  const { usuario } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();

  const puedePublicar = usuario ? ROLES_PUBLICAR.includes(usuario.rol) : false;

  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<Comunicado | null>(null);
  const [mostrandoNuevo, setMostrandoNuevo] = useState(false);
  const [verLecturas, setVerLecturas] = useState<Comunicado | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      let seccionesFetch: Promise<Seccion[]>;
      if (!puedePublicar) {
        seccionesFetch = Promise.resolve([] as Seccion[]);
      } else if (usuario?.rol === "docente") {
        // Docente: solo las secciones donde tiene asignaciones
        seccionesFetch = api.get<{ seccion_id: number; seccion_nombre: string }[]>("/notas/mis-asignaciones/")
          .then(({ data }) => {
            const seen = new Set<number>();
            return data.reduce<Seccion[]>((acc, a) => {
              if (!seen.has(a.seccion_id)) {
                seen.add(a.seccion_id);
                acc.push({ id: a.seccion_id, nombre: a.seccion_nombre, grado: "", letra: "", tutor: null, tutor_nombre: null, docentes: [], docentes_detalle: [], cantidad_estudiantes: 0, cantidad_docentes: 0 });
              }
              return acc;
            }, []);
          });
      } else {
        seccionesFetch = listarSecciones();
      }
      const [c, s] = await Promise.all([listarComunicados(), seccionesFetch]);
      setComunicados(c);
      setSecciones(s);
    } finally {
      setCargando(false);
    }
  }, [puedePublicar, usuario?.rol]); // eslint-disable-line

  useEffect(() => { cargar(); }, [cargar]);

  async function abrir(c: Comunicado) {
    setSeleccionado(c);
    if (!c.ya_leido) {
      try {
        await marcarLeido(c.id);
        setComunicados((prev) => prev.map((x) => x.id === c.id ? { ...x, ya_leido: true, total_lecturas: x.total_lecturas + 1 } : x));
      } catch { /* noop */ }
    }
  }

  async function borrar(c: Comunicado) {
    const ok = await confirmar({
      titulo: "Eliminar comunicado",
      mensaje: `¿Eliminar "${c.titulo}"? El comunicado desaparecerá para todos.`,
      textoConfirmar: "Eliminar",
      variante: "peligro",
    });
    if (!ok) return;
    try {
      await eliminarComunicado(c.id);
      toast.ok("Comunicado eliminado.");
      cargar();
    } catch {
      toast.error("Error al eliminar.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Comunicados</h2>
        {puedePublicar && (
          <button className="btn btn-primario" onClick={() => setMostrandoNuevo(true)} style={{ padding: "8px 14px", width: "auto" }}>
            + Nuevo comunicado
          </button>
        )}
      </div>

      {cargando ? <Cargando inline /> :
        comunicados.length === 0 ? (
          <EmptyState icono="megafono" titulo="Sin comunicados" descripcion="Cuando el equipo publique un comunicado aparecerá aquí." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {comunicados.map((c) => (
              <div
                key={c.id}
                className="card comunicado-card"
                style={{
                  cursor: "pointer",
                  borderLeft: `4px solid ${CATEGORIA_COLOR[c.categoria]}`,
                  opacity: c.ya_leido ? 0.85 : 1,
                }}
                onClick={() => abrir(c)}
              >
                <div className="card-body">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span className="badge" style={{ background: `${CATEGORIA_COLOR[c.categoria]}22`, color: CATEGORIA_COLOR[c.categoria] }}>
                          {c.categoria_label}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--texto-mute)" }}>{c.alcance_label}</span>
                        {c.seccion_nombre && <span style={{ fontSize: 11, color: "var(--azul-700)", fontWeight: 600 }}>· {c.seccion_nombre}</span>}
                        {!c.ya_leido && <span className="badge" style={{ background: "var(--rojo-600)", color: "white", fontSize: 9, padding: "2px 6px" }}>NUEVO</span>}
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--texto)", marginBottom: 4 }}>{c.titulo}</h3>
                      <p style={{ fontSize: 13.5, color: "var(--texto-mute)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {c.cuerpo}
                      </p>
                      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11.5, color: "var(--texto-suave)", flexWrap: "wrap" }}>
                        <span>Por {c.autor_nombre} ({c.autor_rol_label})</span>
                        <span>· {new Date(c.fecha_publicacion).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        {puedePublicar && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>· <Icon name="ojo" size={12} /> {c.total_lecturas} / {c.total_alcance} ({c.porcentaje_lectura}%)</span>
                        )}
                      </div>
                    </div>
                    {puedePublicar && (
                      <div style={{ display: "flex", gap: 6, flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn-mini btn-icono" onClick={() => setVerLecturas(c)}><Icon name="ojo" size={12} /> Ver quién leyó</button>
                        {(c.autor === usuario?.id || ["director", "subdirector"].includes(usuario?.rol ?? "")) && (
                          <button className="btn-mini" style={{ color: "var(--rojo-600)" }} onClick={() => borrar(c)}>Eliminar</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {seleccionado && (
        <div className="modal-overlay" onClick={() => setSeleccionado(null)}>
          <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <span className="badge" style={{ background: `${CATEGORIA_COLOR[seleccionado.categoria]}22`, color: CATEGORIA_COLOR[seleccionado.categoria], marginRight: 8 }}>
                  {seleccionado.categoria_label}
                </span>
                {seleccionado.titulo}
              </h3>
              <button onClick={() => setSeleccionado(null)} className="modal-cerrar">×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: "var(--texto-mute)", marginBottom: 12 }}>
                Publicado por <strong>{seleccionado.autor_nombre}</strong> ({seleccionado.autor_rol_label}) · {new Date(seleccionado.fecha_publicacion).toLocaleString("es-PE")}
              </p>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14 }}>{seleccionado.cuerpo}</p>
              {seleccionado.adjunto && (
                <p style={{ marginTop: 12 }}>
                  <a href={seleccionado.adjunto} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="adjunto" size={14} /> Ver adjunto
                  </a>
                </p>
              )}
            </div>
            <div className="modal-footer">
              <div style={{ marginRight: "auto", fontSize: 12, color: "var(--texto-mute)" }}>
                {seleccionado.ya_leido && <span>✓ Visto por {usuario?.first_name} (registrado)</span>}
              </div>
              <button className="btn btn-primario" onClick={() => setSeleccionado(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {mostrandoNuevo && (
        <NuevoComunicadoModal
          secciones={secciones}
          onCerrar={() => setMostrandoNuevo(false)}
          onCreado={() => { setMostrandoNuevo(false); cargar(); toast.ok("Comunicado publicado."); }}
        />
      )}

      {verLecturas && (
        <VerLecturasModal comunicado={verLecturas} onCerrar={() => setVerLecturas(null)} />
      )}
    </div>
  );
}

function NuevoComunicadoModal({ secciones, onCerrar, onCreado }: {
  secciones: Seccion[]; onCerrar: () => void; onCreado: () => void;
}) {
  const toast = useToast();
  const [datos, setDatos] = useState<Partial<Comunicado>>({
    titulo: "", cuerpo: "", categoria: "academico", alcance: "toda_ie", seccion: null,
  });
  const [enviando, setEnviando] = useState(false);

  async function publicar() {
    setEnviando(true);
    try {
      await crearComunicado(datos);
      onCreado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nuevo comunicado</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div className="form-field">
            <label className="form-label">Título *</label>
            <input className="form-input" value={datos.titulo} onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Categoría</label>
              <select className="form-input" value={datos.categoria} onChange={(e) => setDatos({ ...datos, categoria: e.target.value as CategoriaComunicado })}>
                {CATEGORIAS.map((c) => <option key={c.codigo} value={c.codigo}>{c.etiqueta}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Alcance</label>
              <select className="form-input" value={datos.alcance} onChange={(e) => setDatos({ ...datos, alcance: e.target.value as AlcanceComunicado, seccion: null })}>
                {ALCANCES.map((a) => <option key={a.codigo} value={a.codigo}>{a.etiqueta}</option>)}
              </select>
            </div>
          </div>
          {datos.alcance === "seccion" && (
            <div className="form-field">
              <label className="form-label">Sección</label>
              <select className="form-input" value={datos.seccion ?? ""} onChange={(e) => setDatos({ ...datos, seccion: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Elige —</option>
                {secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Cuerpo del comunicado *</label>
            <textarea className="form-input" rows={6} value={datos.cuerpo} onChange={(e) => setDatos({ ...datos, cuerpo: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={publicar} disabled={enviando || !datos.titulo || !datos.cuerpo}>
            {enviando ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VerLecturasModal({ comunicado, onCerrar }: { comunicado: Comunicado; onCerrar: () => void }) {
  const [lecturas, setLecturas] = useState<LecturaComunicado[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    lecturasDeComunicado(comunicado.id).then(setLecturas).finally(() => setCargando(false));
  }, [comunicado.id]);

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Lecturas de "{comunicado.titulo}"</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            <strong>{comunicado.total_lecturas}</strong> de {comunicado.total_alcance} destinatarios lo han leído ({comunicado.porcentaje_lectura}%).
          </p>
          {cargando ? <Cargando inline /> :
            lecturas.length === 0 ? <p style={{ color: "var(--texto-mute)" }}>Aún nadie lo ha leído.</p> : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {lecturas.map((l) => (
                  <div key={l.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--borde)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <div>
                      <strong>{l.usuario_nombre}</strong>
                      <span style={{ marginLeft: 6, fontSize: 11, color: "var(--texto-mute)" }}>{l.usuario_rol}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--texto-mute)" }}>
                      {new Date(l.leido_en).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
        <div className="modal-footer">
          <button className="btn btn-primario" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
