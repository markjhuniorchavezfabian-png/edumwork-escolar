import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Aviso, Curso, Entrega, Leccion, Recurso, Tarea, TipoRecurso } from "../../types/aula";
import {
  obtenerCurso, listarLecciones, listarTareas,
  crearLeccion, eliminarLeccion,
  crearRecurso, eliminarRecurso,
  crearTarea, crearEntrega,
  listarEntregas, calificarEntrega,
  listarAvisos, crearAviso, eliminarAviso, toggleFijadoAviso,
} from "../../services/aula";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import { Cargando, EmptyState } from "../../components/ui/Spinner";
import TextoExpandible from "../../components/ui/TextoExpandible";

export default function CursoDetalleView() {
  const { id } = useParams<{ id: string }>();
  const cursoId = Number(id);
  const { usuario } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();

  const [curso, setCurso] = useState<Curso | null>(null);
  const [lecciones, setLecciones] = useState<Leccion[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [creandoLeccion, setCreandoLeccion] = useState(false);
  const [creandoTarea, setCreandoTarea] = useState(false);
  const [recursoModal, setRecursoModal] = useState<{ leccionId: number } | null>(null);
  const [entregarTarea, setEntregarTarea] = useState<Tarea | null>(null);
  const [verEntregasTarea, setVerEntregasTarea] = useState<Tarea | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [creandoAviso, setCreandoAviso] = useState(false);

  const esDocente = curso && usuario && (curso.docente === usuario.id || ["director","subdirector"].includes(usuario.rol));
  const esEstudiante = usuario?.rol === "estudiante";

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, ls, ts, avs] = await Promise.all([
        obtenerCurso(cursoId),
        listarLecciones(cursoId),
        listarTareas(cursoId),
        listarAvisos(cursoId),
      ]);
      setCurso(c); setLecciones(ls); setTareas(ts); setAvisos(avs);
    } catch {
      toast.error("No se pudo cargar el curso.");
    } finally { setCargando(false); }
  }, [cursoId, toast]);
  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <Cargando />;
  if (!curso) return <EmptyState icono="alerta" titulo="Curso no encontrado" />;

  async function borrarLeccion(l: Leccion) {
    const ok = await confirmar({
      titulo: "Eliminar lección",
      mensaje: `¿Eliminar la lección "${l.titulo}" y todos sus recursos?`,
      variante: "peligro",
      textoConfirmar: "Eliminar",
    });
    if (!ok) return;
    await eliminarLeccion(l.id);
    toast.ok("Lección eliminada.");
    cargar();
  }

  return (
    <div>
      {/* Cabecera del curso */}
      <div style={{
        background: `linear-gradient(135deg, ${curso.color}, ${curso.color}cc)`,
        color: "white",
        padding: "24px 28px",
        borderRadius: 16,
        marginBottom: 20,
      }}>
        <Link to="/aprender" style={{ color: "rgba(255,255,255,.85)", fontSize: 12, textDecoration: "none" }}>
          ← Volver al Aula Virtual
        </Link>
        {curso.area && (
          <div style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.85, marginTop: 8 }}>
            {curso.area}
          </div>
        )}
        <h2 style={{ margin: "4px 0 8px", fontSize: 26 }}>{curso.titulo}</h2>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{curso.descripcion}</p>
        <div style={{ fontSize: 12, marginTop: 12, opacity: 0.85 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Icon name="usuarios" size={12} /> {curso.docente_nombre}
          </span>
          {curso.secciones_detalle.length > 0 && (
            <> · <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon name="libro" size={12} /> {curso.secciones_detalle.map((s) => s.nombre).join(", ")}
            </span></>
          )}
        </div>
      </div>

      {/* Lecciones */}
      <Card titulo={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Lecciones ({lecciones.length})</span>
          {esDocente && (
            <button className="btn btn-primario btn-icono" style={{ width: "auto", padding: "6px 12px" }}
              onClick={() => setCreandoLeccion(true)}>
              <Icon name="plus" size={14} /> Nueva lección
            </button>
          )}
        </div>
      }>
        {lecciones.length === 0 ? (
          <EmptyState icono="libro" titulo="Sin lecciones todavía"
            descripcion={esDocente ? "Agregá la primera lección para empezar a compartir material." : "El docente aún no publicó contenido."} />
        ) : (
          lecciones.map((l) => (
            <div key={l.id} style={{ borderBottom: "1px solid var(--borde)", padding: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: 15 }}>{l.orden + 1}. {l.titulo}</h4>
                  {l.contenido && <p style={{ fontSize: 13, color: "var(--texto-mute)", marginTop: 4 }}>{l.contenido}</p>}
                </div>
                {esDocente && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn-mini btn-icono" onClick={() => setRecursoModal({ leccionId: l.id })}>
                      <Icon name="plus" size={12} /> Recurso
                    </button>
                    <button className="btn-mini" style={{ color: "var(--rojo-600)" }} onClick={() => borrarLeccion(l)}>
                      <Icon name="borrar" size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Recursos de la lección */}
              {l.recursos.length > 0 && (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {l.recursos.map((r) => <RecursoCard key={r.id} recurso={r} puedeBorrar={!!esDocente} onBorrado={cargar} />)}
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      {/* Tareas */}
      <Card titulo={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Tareas ({tareas.length})</span>
          {esDocente && (
            <button className="btn btn-primario btn-icono" style={{ width: "auto", padding: "6px 12px" }}
              onClick={() => setCreandoTarea(true)}>
              <Icon name="plus" size={14} /> Nueva tarea
            </button>
          )}
        </div>
      }>
        {tareas.length === 0 ? (
          <EmptyState icono="editar" titulo="Sin tareas asignadas" />
        ) : (
          tareas.map((t) => {
            const vencida = new Date(t.fecha_entrega) < new Date();
            const yaEntregada = !!t.mi_entrega;
            return (
              <div key={t.id} style={{ borderBottom: "1px solid var(--borde)", padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h4 style={{ margin: 0, fontSize: 15 }}>{t.titulo}</h4>
                    <p style={{ fontSize: 13, color: "var(--texto-mute)", marginTop: 4 }}><TextoExpandible texto={t.descripcion} maxChars={100} /></p>
                    <div style={{ fontSize: 11, color: vencida ? "var(--rojo-600)" : "var(--texto-mute)", marginTop: 6 }}>
                      Entrega: {new Date(t.fecha_entrega).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {" · "}Puntaje: {t.puntaje_maximo}
                    </div>
                  </div>
                  {esEstudiante && (
                    yaEntregada ? (
                      <span className="badge" style={{
                        background: "var(--verde-50)", color: "var(--verde-600)",
                      }}>
                        ✓ {t.mi_entrega!.estado_label}
                        {t.mi_entrega!.nota && ` · ${t.mi_entrega!.nota}/${t.puntaje_maximo}`}
                      </span>
                    ) : (
                      <button className="btn btn-primario btn-icono" style={{ width: "auto", padding: "6px 12px" }}
                        onClick={() => setEntregarTarea(t)}>
                        <Icon name="subir" size={12} /> Entregar
                      </button>
                    )
                  )}
                  {esDocente && (
                    <button className="btn btn-secundario btn-icono" style={{ width: "auto", padding: "6px 12px" }}
                      onClick={() => setVerEntregasTarea(t)}>
                      <Icon name="documento" size={12} /> Ver entregas ({t.entregas_count})
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* Avisos */}
      <Card titulo={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Avisos ({avisos.length})</span>
          {esDocente && (
            <button className="btn btn-primario btn-icono" style={{ width: "auto", padding: "6px 12px" }}
              onClick={() => setCreandoAviso(true)}>
              <Icon name="plus" size={14} /> Nuevo aviso
            </button>
          )}
        </div>
      }>
        {avisos.length === 0 ? (
          <EmptyState icono="megafono" titulo="Sin avisos" descripcion={esDocente ? "Publicá avisos para comunicar novedades a tus estudiantes." : "El docente no ha publicado avisos aún."} />
        ) : (
          avisos.map((a) => (
            <div key={a.id} style={{
              borderBottom: "1px solid var(--borde)", padding: "14px 0",
              background: a.fijado ? "var(--amarillo-50)" : undefined,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    {a.fijado && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--amarillo-700)", background: "var(--amarillo-100)", padding: "2px 8px", borderRadius: 10 }}>📌 FIJADO</span>}
                    <h4 style={{ margin: 0, fontSize: 15 }}>{a.titulo}</h4>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--texto-mute)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.contenido}</p>
                  <div style={{ fontSize: 11, color: "var(--texto-mute)", marginTop: 6 }}>
                    {a.autor_nombre} · {new Date(a.creado_en).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                {esDocente && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn-mini"
                      title={a.fijado ? "Desfijar" : "Fijar"}
                      onClick={async () => { await toggleFijadoAviso(a.id, !a.fijado); cargar(); }}
                      style={{ color: a.fijado ? "var(--amarillo-600)" : "var(--texto-mute)" }}
                    >
                      📌
                    </button>
                    <button
                      className="btn-mini"
                      style={{ color: "var(--rojo-600)" }}
                      onClick={async () => {
                        const ok = await confirmar({ titulo: "Eliminar aviso", mensaje: `¿Eliminar "${a.titulo}"?`, variante: "peligro", textoConfirmar: "Eliminar" });
                        if (!ok) return;
                        await eliminarAviso(a.id);
                        toast.ok("Aviso eliminado.");
                        cargar();
                      }}
                    >
                      <Icon name="borrar" size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </Card>

      {creandoAviso && (
        <NuevoAvisoModal cursoId={cursoId}
          onCerrar={() => setCreandoAviso(false)}
          onCreado={() => { setCreandoAviso(false); toast.ok("Aviso publicado."); cargar(); }} />
      )}

      {creandoLeccion && (
        <NuevaLeccionModal cursoId={cursoId} ordenSiguiente={lecciones.length}
          onCerrar={() => setCreandoLeccion(false)}
          onCreada={() => { setCreandoLeccion(false); toast.ok("Lección creada."); cargar(); }} />
      )}

      {creandoTarea && (
        <NuevaTareaModal cursoId={cursoId} lecciones={lecciones}
          onCerrar={() => setCreandoTarea(false)}
          onCreada={() => { setCreandoTarea(false); toast.ok("Tarea publicada."); cargar(); }} />
      )}

      {recursoModal && (
        <NuevoRecursoModal leccionId={recursoModal.leccionId}
          onCerrar={() => setRecursoModal(null)}
          onCreado={() => { setRecursoModal(null); toast.ok("Recurso agregado."); cargar(); }} />
      )}

      {entregarTarea && (
        <EntregarTareaModal tarea={entregarTarea}
          onCerrar={() => setEntregarTarea(null)}
          onEnviada={() => { setEntregarTarea(null); toast.ok("Entrega enviada."); cargar(); }} />
      )}

      {verEntregasTarea && (
        <EntregasTareaModal tarea={verEntregasTarea}
          onCerrar={() => setVerEntregasTarea(null)}
          onCalificada={() => { toast.ok("Calificación guardada."); cargar(); }} />
      )}
    </div>
  );
}

function EntregasTareaModal({ tarea, onCerrar, onCalificada }: {
  tarea: Tarea; onCerrar: () => void; onCalificada: () => void;
}) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<{ id: number; nota: string; comentario: string } | null>(null);

  async function cargar() {
    setCargando(true);
    try { setEntregas(await listarEntregas(tarea.id)); }
    finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [tarea.id]);

  async function guardar() {
    if (!editando) return;
    const nota = Number(editando.nota);
    if (isNaN(nota)) return;
    await calificarEntrega(editando.id, nota, editando.comentario);
    setEditando(null);
    onCalificada();
    cargar();
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel modal-panel-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Entregas: {tarea.titulo}</h3>
          <button className="modal-cerrar" onClick={onCerrar}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 12, color: "var(--texto-mute)", marginBottom: 12 }}>
            Puntaje máximo: {tarea.puntaje_maximo} · Fecha entrega: {new Date(tarea.fecha_entrega).toLocaleString("es-PE")}
          </p>
          {cargando ? <Cargando /> : entregas.length === 0 ? (
            <EmptyState icono="bandeja" titulo="Sin entregas todavía" descripcion="Cuando los estudiantes entreguen aparecerán acá." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {entregas.map((e) => (
                <div key={e.id} style={{
                  border: "1px solid var(--borde)", borderRadius: 10, padding: 14,
                  background: e.estado === "calificada" ? "var(--verde-50)" : "var(--bg-panel)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <strong>{e.estudiante_nombre}</strong>
                      <div style={{ fontSize: 11, color: "var(--texto-mute)" }}>
                        Entregada: {new Date(e.entregada_en).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <span className="badge" style={{
                      background: e.estado === "calificada" ? "var(--verde-100)" : e.estado === "tardia" ? "var(--amarillo-50)" : "var(--azul-50)",
                      color: e.estado === "calificada" ? "var(--verde-700)" : e.estado === "tardia" ? "var(--amarillo-600)" : "var(--azul-600)",
                    }}>{e.estado_label}{e.nota && ` · ${e.nota}/${tarea.puntaje_maximo}`}</span>
                  </div>
                  {e.texto && (
                    <div style={{ marginTop: 8, padding: 8, background: "var(--slate-50)", borderRadius: 6, fontSize: 13 }}>
                      {e.texto}
                    </div>
                  )}
                  {e.archivo && (
                    <div style={{ marginTop: 8 }}>
                      <a href={e.archivo} target="_blank" rel="noopener noreferrer" className="btn-mini btn-icono">
                        <Icon name="descargar" size={12} /> Descargar archivo
                      </a>
                    </div>
                  )}
                  {e.comentario_docente && (
                    <div style={{ marginTop: 8, padding: 8, background: "var(--verde-100)", borderRadius: 6, fontSize: 12 }}>
                      <strong>Docente:</strong> {e.comentario_docente}
                    </div>
                  )}

                  {editando?.id === e.id ? (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div className="form-group" style={{ marginBottom: 0, flex: "0 0 100px" }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Nota</label>
                        <input className="form-input" type="number" step="0.5" min="0" max={tarea.puntaje_maximo}
                          value={editando.nota}
                          onChange={(ev) => setEditando({ ...editando, nota: ev.target.value })} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Comentario</label>
                        <input className="form-input" placeholder="Opcional..."
                          value={editando.comentario}
                          onChange={(ev) => setEditando({ ...editando, comentario: ev.target.value })} />
                      </div>
                      <button className="btn btn-primario" style={{ width: "auto", padding: "8px 14px" }} onClick={guardar}>Guardar</button>
                      <button className="btn btn-secundario" style={{ width: "auto", padding: "8px 14px" }} onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-mini btn-icono"
                        onClick={() => setEditando({ id: e.id, nota: e.nota ?? "", comentario: e.comentario_docente ?? "" })}>
                        <Icon name="editar" size={12} /> {e.estado === "calificada" ? "Modificar nota" : "Calificar"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function RecursoCard({ recurso, puedeBorrar, onBorrado }: { recurso: Recurso; puedeBorrar: boolean; onBorrado: () => void }) {
  return (
    <div style={{
      background: "var(--slate-50, #f8fafc)",
      border: "1px solid var(--borde)",
      borderRadius: 8,
      padding: 10,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <IconoRecurso tipo={recurso.tipo} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{recurso.titulo}</div>
        {recurso.descripcion && (
          <div style={{ fontSize: 11, color: "var(--texto-mute)" }}>{recurso.descripcion}</div>
        )}
      </div>
      {recurso.tipo === "video_youtube" && recurso.youtube_id ? (
        <a href={recurso.url} target="_blank" rel="noopener noreferrer" className="btn-mini btn-icono">
          <Icon name="reproducir" size={12} /> Ver video
        </a>
      ) : recurso.tipo === "texto" ? null : (
        <a href={recurso.url} target="_blank" rel="noopener noreferrer" className="btn-mini btn-icono">
          <Icon name="ver" size={12} /> Abrir
        </a>
      )}
      {puedeBorrar && (
        <button className="btn-mini" style={{ color: "var(--rojo-600)" }}
          onClick={async () => { await eliminarRecurso(recurso.id); onBorrado(); }}>
          <Icon name="borrar" size={12} />
        </button>
      )}
    </div>
  );
}

function IconoRecurso({ tipo }: { tipo: TipoRecurso }) {
  const map: Record<TipoRecurso, { icon: Parameters<typeof Icon>[0]["name"]; color: string }> = {
    video_youtube: { icon: "reproducir", color: "#ff0000" },
    video_link: { icon: "reproducir", color: "var(--azul-600)" },
    pdf: { icon: "pdf", color: "#e63946" },
    documento: { icon: "documento", color: "#2E75B6" },
    imagen: { icon: "camara", color: "var(--verde-600)" },
    enlace: { icon: "ver", color: "var(--slate-600)" },
    texto: { icon: "documento", color: "var(--slate-500)" },
  };
  const { icon, color } = map[tipo];
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: `${color}15`, color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon name={icon} size={18} />
    </div>
  );
}

function NuevaLeccionModal({ cursoId, ordenSiguiente, onCerrar, onCreada }: {
  cursoId: number; ordenSiguiente: number; onCerrar: () => void; onCreada: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await crearLeccion({ curso: cursoId, titulo, contenido, orden: ordenSiguiente, publicada: true });
      onCreada();
    } finally { setEnviando(false); }
  }
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Nueva lección</h3><button className="modal-cerrar" onClick={onCerrar}>×</button></div>
        <form onSubmit={guardar}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Introducción (opcional)</label>
              <textarea className="form-input" rows={3} value={contenido} onChange={(e) => setContenido(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={enviando || !titulo}>Crear</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NuevoRecursoModal({ leccionId, onCerrar, onCreado }: {
  leccionId: number; onCerrar: () => void; onCreado: () => void;
}) {
  const [datos, setDatos] = useState<{ tipo: TipoRecurso; titulo: string; url: string; descripcion: string; contenido: string }>({
    tipo: "video_youtube", titulo: "", url: "", descripcion: "", contenido: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await crearRecurso({ leccion: leccionId, ...datos });
      onCreado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      setError(JSON.stringify(err.response?.data ?? "Error"));
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Agregar recurso</h3><button className="modal-cerrar" onClick={onCerrar}>×</button></div>
        <form onSubmit={guardar}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Tipo de recurso</label>
              <select className="form-input" value={datos.tipo}
                onChange={(e) => setDatos({ ...datos, tipo: e.target.value as TipoRecurso })}>
                <option value="video_youtube">Video de YouTube</option>
                <option value="video_link">Video (otro link)</option>
                <option value="pdf">PDF (link)</option>
                <option value="documento">Documento (Google Docs/Word link)</option>
                <option value="imagen">Imagen (link)</option>
                <option value="enlace">Enlace externo</option>
                <option value="texto">Texto/nota</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Título</label>
              <input className="form-input" required value={datos.titulo}
                onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción (opcional)</label>
              <textarea className="form-input" rows={2} value={datos.descripcion}
                onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
            </div>
            {datos.tipo === "texto" ? (
              <div className="form-group">
                <label className="form-label">Contenido</label>
                <textarea className="form-input" rows={5} required value={datos.contenido}
                  onChange={(e) => setDatos({ ...datos, contenido: e.target.value })} />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">URL</label>
                <input className="form-input" type="url" required value={datos.url}
                  onChange={(e) => setDatos({ ...datos, url: e.target.value })}
                  placeholder={
                    datos.tipo === "video_youtube" ? "https://youtube.com/watch?v=..." :
                    datos.tipo === "pdf" ? "https://ejemplo.com/material.pdf" :
                    "https://..."
                  } />
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={enviando}>Agregar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NuevaTareaModal({ cursoId, lecciones, onCerrar, onCreada }: {
  cursoId: number; lecciones: Leccion[]; onCerrar: () => void; onCreada: () => void;
}) {
  const [datos, setDatos] = useState({
    titulo: "", descripcion: "", fecha_entrega: "", puntaje_maximo: "20", leccion: "",
  });
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await crearTarea({
        curso: cursoId,
        leccion: datos.leccion ? Number(datos.leccion) : null,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        fecha_entrega: new Date(datos.fecha_entrega).toISOString(),
        puntaje_maximo: datos.puntaje_maximo,
        publicada: true,
        permite_archivo: true,
        permite_texto: true,
      });
      onCreada();
    } finally { setEnviando(false); }
  }
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Nueva tarea</h3><button className="modal-cerrar" onClick={onCerrar}>×</button></div>
        <form onSubmit={guardar}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" required value={datos.titulo}
                onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Consigna *</label>
              <textarea className="form-input" rows={4} required value={datos.descripcion}
                onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Fecha de entrega *</label>
                <input className="form-input" type="datetime-local" required
                  value={datos.fecha_entrega}
                  onChange={(e) => setDatos({ ...datos, fecha_entrega: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Puntaje</label>
                <input className="form-input" type="number" step="0.5" min="0" max="20"
                  value={datos.puntaje_maximo}
                  onChange={(e) => setDatos({ ...datos, puntaje_maximo: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Lección relacionada (opcional)</label>
              <select className="form-input" value={datos.leccion}
                onChange={(e) => setDatos({ ...datos, leccion: e.target.value })}>
                <option value="">— Ninguna —</option>
                {lecciones.map((l) => <option key={l.id} value={l.id}>{l.titulo}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={enviando}>Publicar tarea</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EntregarTareaModal({ tarea, onCerrar, onEnviada }: {
  tarea: Tarea; onCerrar: () => void; onEnviada: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!texto.trim() && !archivo) {
      setError("Agregá texto o archivo antes de entregar.");
      return;
    }
    setEnviando(true);
    try {
      await crearEntrega({ tarea: tarea.id, texto, archivo });
      onEnviada();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      setError(JSON.stringify(err.response?.data ?? "Error"));
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3>Entregar tarea</h3><button className="modal-cerrar" onClick={onCerrar}>×</button></div>
        <form onSubmit={guardar}>
          <div className="modal-body">
            <div style={{ padding: 12, background: "var(--slate-50)", borderRadius: 8, marginBottom: 12 }}>
              <strong>{tarea.titulo}</strong>
              <p style={{ fontSize: 12, marginTop: 4 }}><TextoExpandible texto={tarea.descripcion} maxChars={120} /></p>
            </div>
            {tarea.permite_texto && (
              <div className="form-group">
                <label className="form-label">Respuesta escrita</label>
                <textarea className="form-input" rows={6} value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Escribí acá tu respuesta o comentario..." />
              </div>
            )}
            {tarea.permite_archivo && (
              <div className="form-group">
                <label className="form-label">Archivo adjunto</label>
                <input type="file" className="form-input"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primario btn-icono" disabled={enviando}>
              <Icon name="subir" size={14} /> {enviando ? "Enviando..." : "Entregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NuevoAvisoModal({ cursoId, onCerrar, onCreado }: {
  cursoId: number; onCerrar: () => void; onCreado: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [fijado, setFijado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await crearAviso({ curso: cursoId, titulo, contenido, fijado });
      onCreado();
    } finally { setEnviando(false); }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nuevo aviso</h3>
          <button className="modal-cerrar" onClick={onCerrar}>×</button>
        </div>
        <form onSubmit={guardar}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Título *</label>
              <input className="form-input" required maxLength={200}
                value={titulo} onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Práctica pospuesta al viernes" />
            </div>
            <div className="form-group">
              <label className="form-label">Mensaje *</label>
              <textarea className="form-input" required rows={4}
                value={contenido} onChange={(e) => setContenido(e.target.value)}
                placeholder="Escribe el mensaje para tus estudiantes..." />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={fijado} onChange={(e) => setFijado(e.target.checked)} />
              Fijar este aviso (aparece siempre arriba)
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn btn-primario" disabled={enviando || !titulo || !contenido}>
              {enviando ? "Publicando..." : "Publicar aviso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
