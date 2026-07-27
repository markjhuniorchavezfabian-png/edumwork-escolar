import { useCallback, useEffect, useMemo, useState } from "react";
import type { RolInfo, UsuarioLista, UsuarioNuevo } from "../../types/gestion";
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
  reactivarUsuario,
  resetPassword,
  catalogoRoles,
} from "../../services/gestion";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";
import { EmptyState, Cargando } from "../../components/ui/Spinner";
import VincularHijosModal from "./VincularHijosModal";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { KeyRound, Key, Copy, MessageCircle, Users, Check } from "lucide-react";

export default function UsuariosView() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [roles, setRoles] = useState<RolInfo[]>([]);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activos" | "inactivos">("activos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<UsuarioLista | null>(null);
  const [creando, setCreando] = useState(false);
  const [vinculando, setVinculando] = useState<UsuarioLista | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const activo = filtroActivo === "activos" ? true : filtroActivo === "inactivos" ? false : undefined;
      const [ul, rl] = await Promise.all([
        listarUsuarios({ rol: filtroRol || undefined, q: busqueda || undefined, activo }),
        catalogoRoles(),
      ]);
      setUsuarios(ul);
      setRoles(rl);
    } finally {
      setCargando(false);
    }
  }, [filtroRol, filtroActivo, busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  async function desactivar(u: UsuarioLista) {
    const ok = await confirmar({
      titulo: "Desactivar usuario",
      mensaje: `¿Desactivar la cuenta de ${u.nombre_completo}? El usuario no podrá iniciar sesión, pero sus datos se conservan.`,
      textoConfirmar: "Desactivar",
      variante: "peligro",
    });
    if (!ok) return;
    try {
      await desactivarUsuario(u.id);
      toast.ok("Cuenta desactivada.");
      cargar();
    } catch {
      toast.error("Error al desactivar.");
    }
  }

  async function reactivar(u: UsuarioLista) {
    const ok = await confirmar({
      titulo: "Reactivar cuenta",
      mensaje: `¿Reactivar la cuenta de ${u.nombre_completo}? Volverá a tener acceso al sistema.`,
      textoConfirmar: "Reactivar",
    });
    if (!ok) return;
    try {
      await reactivarUsuario(u.id);
      toast.ok("Cuenta reactivada.");
      cargar();
    } catch {
      toast.error("Error al reactivar.");
    }
  }

  const [codigoRec, setCodigoRec] = useState<{ codigo: string; usuario: string; nombre: string; expira_minutos: number } | null>(null);

  async function resetear(u: UsuarioLista) {
    const ok = await confirmar({
      titulo: "Restablecer contraseña",
      mensaje: `Se generará una contraseña temporal para ${u.nombre_completo}. Debes comunicársela personalmente.`,
      textoConfirmar: "Generar contraseña temporal",
    });
    if (!ok) return;
    try {
      const r = await resetPassword(u.id);
      navigator.clipboard.writeText(r.password_temporal).catch(() => {});
      toast.info(`Contraseña temporal: ${r.password_temporal} (copiada al portapapeles)`, 12000);
    } catch {
      toast.error("Error al resetear.");
    }
  }

  async function generarCodigo(u: UsuarioLista) {
    try {
      const { data } = await api.post("/usuarios/reset-password/generar-codigo/", { usuario_id: u.id });
      setCodigoRec(data);
    } catch {
      toast.error("No se pudo generar el código.");
    }
  }

  // Grupos de roles para la vista agrupada
  const GRUPOS_ROL = useMemo(() => [
    {
      key: "directivos",
      label: "Directivos y personal",
      roles: ["director", "subdirector", "admin_tic", "secretaria", "auxiliar", "psicologa", "conserje"],
      color: "#6366F1",
    },
    {
      key: "docentes",
      label: "Docentes",
      roles: ["docente"],
      color: "#0EA5E9",
    },
    {
      key: "padres",
      label: "Padres / Apoderados",
      roles: ["padre"],
      color: "#10B981",
    },
    {
      key: "estudiantes",
      label: "Estudiantes",
      roles: ["estudiante"],
      color: "#F59E0B",
    },
    {
      key: "ugel",
      label: "UGEL / Externo",
      roles: ["ugel"],
      color: "#8B5CF6",
    },
  ], []);

  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("usuarios.grupos") ?? "{}"); } catch { return {}; }
  });
  const toggleGrupo = (key: string) => {
    setGruposAbiertos(prev => {
      const next = { ...prev, [key]: !(prev[key] ?? true) };
      try { localStorage.setItem("usuarios.grupos", JSON.stringify(next)); } catch { /* empty */ }
      return next;
    });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>Usuarios</h2>
        <button className="btn btn-primario" onClick={() => setCreando(true)} style={{ padding: "8px 14px", width: "auto" }}>
          + Nuevo usuario
        </button>
      </div>

      {/* Barra de filtros compacta */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <input
          className="form-input"
          style={{ flex: 1, minWidth: 180, maxWidth: 280 }}
          placeholder="Buscar por nombre, usuario o DNI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select className="form-input" style={{ width: "auto" }} value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
          <option value="">Todos los roles</option>
          {roles.map((r) => <option key={r.codigo} value={r.codigo}>{r.etiqueta}</option>)}
        </select>
        <select className="form-input" style={{ width: "auto" }} value={filtroActivo} onChange={(e) => setFiltroActivo(e.target.value as typeof filtroActivo)}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
          <option value="todos">Todos</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
          {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Lista agrupada */}
      {cargando ? (
        <Cargando inline />
      ) : usuarios.length === 0 ? (
        <EmptyState icono="usuarios" titulo="Sin usuarios" descripcion="No hay usuarios que coincidan con los filtros." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {GRUPOS_ROL.map((grupo) => {
            const miembros = usuarios.filter((u) => grupo.roles.includes(u.rol));
            if (miembros.length === 0) return null;
            const abierto = gruposAbiertos[grupo.key] ?? true;
            return (
              <div key={grupo.key} style={{
                border: "1px solid var(--borde)", borderRadius: 10, overflow: "hidden",
              }}>
                {/* Cabecera del grupo */}
                <button
                  type="button"
                  onClick={() => toggleGrupo(grupo.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px", background: "var(--fondo-secundario, var(--fondo))",
                    border: "none", cursor: "pointer", textAlign: "left",
                    borderBottom: abierto ? "1px solid var(--borde)" : "none",
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: grupo.color, flexShrink: 0,
                  }} />
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>
                    {grupo.label}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: grupo.color,
                    background: `${grupo.color}18`, borderRadius: 12,
                    padding: "2px 8px",
                  }}>
                    {miembros.length}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: 4 }}>
                    {abierto ? "▲" : "▼"}
                  </span>
                </button>

                {/* Filas */}
                {abierto && (
                  <div style={{ overflowX: "auto" }}>
                    <table className="tabla-incidencias" style={{ minWidth: 600 }}>
                      <thead>
                        <tr>
                          <th style={{ width: "25%" }}>Nombre</th>
                          <th>Usuario</th>
                          {grupo.key === "directivos" && <th>Cargo</th>}
                          {grupo.key === "docentes" && <th>DNI</th>}
                          {grupo.key === "padres" && <th>Teléfono</th>}
                          {grupo.key === "estudiantes" && <th>DNI</th>}
                          {grupo.key === "ugel" && <th>Email</th>}
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {miembros.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{
                                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                                  background: `${grupo.color}20`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 11, fontWeight: 700, color: grupo.color,
                                }}>
                                  {(u.first_name?.[0] ?? "") + (u.last_name?.[0] ?? "") || "?"}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nombre_completo}</div>
                                  {u.email && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{u.email}</div>}
                                </div>
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: 11 }}>{u.username}</code>
                            </td>
                            {grupo.key === "directivos" && (
                              <td>
                                <span style={{ fontSize: 12 }}>{u.rol_label}</span>
                                {u.es_docente && (
                                  <span style={{
                                    marginLeft: 6, fontSize: 10, fontWeight: 600,
                                    background: "#0EA5E920", color: "#0369A1",
                                    borderRadius: 10, padding: "1px 6px",
                                  }}>
                                    + docente
                                  </span>
                                )}
                              </td>
                            )}
                            {grupo.key === "docentes" && <td style={{ fontSize: 12 }}>{u.dni || "—"}</td>}
                            {grupo.key === "padres" && <td style={{ fontSize: 12 }}>{u.telefono || "—"}</td>}
                            {grupo.key === "estudiantes" && <td style={{ fontSize: 12 }}>{u.dni || "—"}</td>}
                            {grupo.key === "ugel" && <td style={{ fontSize: 12 }}>{u.email || "—"}</td>}
                            <td>
                              {u.activo ? (
                                <span style={{ fontSize: 10, fontWeight: 600, color: "#16A34A", background: "#DCFCE7", borderRadius: 10, padding: "2px 7px" }}>
                                  activo
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", borderRadius: 10, padding: "2px 7px" }}>
                                  inactivo
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                <button className="btn-mini" onClick={() => setEditando(u)}>Editar</button>
                                {u.rol === "padre" && (
                                  <button className="btn-mini" style={{ color: "var(--azul-600)", display: "inline-flex", alignItems: "center", gap: 3 }} onClick={() => setVinculando(u)}>
                                    <Users size={11} /> Hijos
                                  </button>
                                )}
                                <button className="btn-mini" onClick={() => generarCodigo(u)} title="Código de recuperación" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <KeyRound size={11} /> Código
                                </button>
                                <button className="btn-mini" onClick={() => resetear(u)} title="Reset directo de contraseña" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <Key size={11} /> Reset
                                </button>
                                {u.activo ? (
                                  <button className="btn-mini" style={{ color: "var(--rojo-600)" }} onClick={() => desactivar(u)}>Desactivar</button>
                                ) : (
                                  <button className="btn-mini" style={{ color: "var(--verde-600)" }} onClick={() => reactivar(u)}>Reactivar</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(creando || editando) && (
        <UsuarioModal
          usuario={editando}
          roles={roles}
          onCerrar={() => { setCreando(false); setEditando(null); }}
          onGuardado={() => { setCreando(false); setEditando(null); cargar(); }}
        />
      )}

      {vinculando && (
        <VincularHijosModal
          idPadre={vinculando.id}
          nombrePadre={vinculando.nombre_completo}
          onCerrar={() => setVinculando(null)}
          onGuardado={() => setVinculando(null)}
        />
      )}

      {codigoRec && (
        <CodigoRecuperacionModal data={codigoRec} onCerrar={() => setCodigoRec(null)} />
      )}
    </div>
  );
}

function CodigoRecuperacionModal({ data, onCerrar }: {
  data: { codigo: string; usuario: string; nombre: string; expira_minutos: number };
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const mensajeWA = `Hola ${data.nombre.split(" ")[0]}, tu código de recuperación es ${data.codigo}. Ingresa con tu usuario "${data.usuario}" en la pantalla de recuperar contraseña y elige una nueva. El código expira en ${data.expira_minutos} minutos.`;

  function copiarCodigo() {
    navigator.clipboard.writeText(data.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16,
    }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--bg-panel)", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Código de recuperación</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6B7280" }}>
              Para: <strong>{data.nombre}</strong> (@{data.usuario})
            </p>
          </div>
          <button onClick={onCerrar} style={{
            background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6B7280",
          }}>×</button>
        </div>

        <div style={{
          background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", color: "white",
          padding: "24px 16px", borderRadius: 12, textAlign: "center", marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, opacity: 0.9, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
            Código temporal
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 6, fontFamily: "monospace" }}>
            {data.codigo}
          </div>
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
            Válido por {data.expira_minutos} minutos
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={copiarCodigo} style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #E5E7EB",
            background: copiado ? "#D1FAE5" : "var(--bg-panel)", cursor: "pointer",
            fontSize: 13, fontWeight: 500, color: copiado ? "#065F46" : "var(--texto)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar código</>}
          </button>
          <button onClick={() => { navigator.clipboard.writeText(mensajeWA); }} style={{
            flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #10B981",
            background: "#10B981", color: "white", cursor: "pointer",
            fontSize: 13, fontWeight: 500,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <MessageCircle size={14} /> Copiar mensaje WhatsApp
          </button>
        </div>

        <div style={{
          background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 8,
          padding: 12, fontSize: 12, color: "#0C4A6E",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Instrucciones para {data.nombre.split(" ")[0]}:</div>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Comunicale el código por WhatsApp o teléfono</li>
            <li>Que abra <code style={{ background: "var(--bg-panel)", padding: "1px 4px", borderRadius: 3 }}>/recuperar-con-codigo</code></li>
            <li>Ingrese usuario, código y nueva contraseña</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ── Modal crear/editar ──────────────────────────────────────────────────────
function UsuarioModal({
  usuario, roles, onCerrar, onGuardado,
}: {
  usuario: UsuarioLista | null;
  roles: RolInfo[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const toast = useToast();
  const { usuario: usuarioActual, refreshUsuario } = useAuth();
  const esNuevo = usuario === null;

  const [datos, setDatos] = useState<UsuarioNuevo>({
    username: usuario?.username ?? "",
    first_name: usuario?.first_name ?? "",
    last_name: usuario?.last_name ?? "",
    email: usuario?.email ?? "",
    rol: usuario?.rol ?? "docente",
    dni: usuario?.dni ?? "",
    telefono: usuario?.telefono ?? "",
    especialidad: "",
    grado: "",
    seccion: "",
    codigo_matricula: "",
  });
  const [esDocente, setEsDocente] = useState<boolean>(usuario?.es_docente ?? false);
  const [advertenciaAsignaciones, setAdvertenciaAsignaciones] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setEnviando(true);
    try {
      if (esNuevo) {
        const r = await crearUsuario(datos);
        const pw = r.password_generado;
        if (pw) {
          toast.ok(`Usuario "${datos.username}" creado. Contraseña inicial: ${pw}`, 12000);
        } else {
          toast.ok(`Usuario "${datos.username}" creado.`);
        }
      } else {
        await actualizarUsuario(usuario!.id, {
          first_name: datos.first_name,
          last_name: datos.last_name,
          email: datos.email || undefined,
          rol: datos.rol,
          ...(datos.dni ? { dni: datos.dni } : {}),
          telefono: datos.telefono,
          es_docente: esDocente,
        });
        toast.ok(`Usuario actualizado.`);
        // Si el usuario editado es el mismo que está logueado, refrescar el contexto de auth
        if (usuarioActual?.id === usuario!.id) await refreshUsuario();
      }
      onGuardado();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data)}`);
    } finally {
      setEnviando(false);
    }
  }

  const mostrarEspecialidad = datos.rol === "docente";
  const mostrarEstudiante = datos.rol === "estudiante";

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{esNuevo ? "Crear usuario" : `Editar ${usuario?.nombre_completo}`}</h3>
          <button onClick={onCerrar} className="modal-cerrar">×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Nombres *</label>
              <input className="form-input" value={datos.first_name} onChange={(e) => setDatos({ ...datos, first_name: e.target.value })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Apellidos *</label>
              <input className="form-input" value={datos.last_name} onChange={(e) => setDatos({ ...datos, last_name: e.target.value })} />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Rol *</label>
            <select className="form-input" value={datos.rol} onChange={(e) => setDatos({ ...datos, rol: e.target.value })}>
              {roles.map((r) => <option key={r.codigo} value={r.codigo}>{r.etiqueta}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Usuario (login) *</label>
              <input className="form-input" value={datos.username} disabled={!esNuevo} onChange={(e) => setDatos({ ...datos, username: e.target.value.toLowerCase().replace(/\s/g, "") })} />
            </div>
            {esNuevo && (
              <div className="form-field" style={{ flex: 1 }}>
                <label className="form-label" style={{ color: "var(--slate-500)" }}>Contraseña inicial</label>
                <div style={{ padding: "8px 10px", background: "var(--slate-100)", borderRadius: 6, fontSize: 12, color: "var(--slate-500)", fontStyle: "italic" }}>
                  {datos.dni && datos.dni.length >= 6
                    ? <>Auto-generada: <strong style={{ fontStyle: "normal", color: "var(--slate-700)" }}>{datos.dni.slice(0, 6)}2026</strong></>
                    : "Auto-generada del DNI (primeros 6 dígitos + 2026)"}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">DNI</label>
              <input className="form-input" maxLength={8} value={datos.dni} onChange={(e) => setDatos({ ...datos, dni: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Correo electrónico</label>
            <input className="form-input" type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} />
          </div>

          {["director", "subdirector", "secretaria", "admin_tic"].includes(datos.rol) && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", padding: "8px 0" }}>
              <input
                type="checkbox"
                checked={esDocente}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  // Si desactivan es_docente a alguien que ya lo tenía, revisar asignaciones
                  if (!checked && usuario?.es_docente && usuario.id) {
                    try {
                      const { data } = await api.get(`/notas/asignaciones/?docente=${usuario.id}`);
                      const count = Array.isArray(data) ? data.length : (data.results?.length ?? 0);
                      if (count > 0) { setAdvertenciaAsignaciones(count); return; }
                    } catch { /* continuar */ }
                  }
                  setEsDocente(checked);
                }}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <span>
                <strong>También es docente</strong>
                <span style={{ color: "var(--muted-foreground)", marginLeft: 6 }}>
                  — puede tener asignaciones de área, registrar notas y ver horario docente
                </span>
              </span>
            </label>
          )}

          {esNuevo && mostrarEspecialidad && (
            <>
              <div className="form-field">
                <label className="form-label">Nivel que enseña</label>
                <select
                  className="form-input"
                  value={datos.especialidad === "Docente de aula" ? "aula" : datos.especialidad === "" ? "" : "secundaria"}
                  onChange={(e) => {
                    if (e.target.value === "aula") setDatos({ ...datos, especialidad: "Docente de aula" });
                    else if (e.target.value === "secundaria") setDatos({ ...datos, especialidad: "" });
                    else setDatos({ ...datos, especialidad: "" });
                  }}
                >
                  <option value="">— seleccionar —</option>
                  <option value="aula">Inicial o Primaria (docente de aula — enseña todo)</option>
                  <option value="secundaria">Secundaria (área específica)</option>
                </select>
              </div>
              {datos.especialidad !== "Docente de aula" && (
                <div className="form-field">
                  <label className="form-label">Área / Especialidad</label>
                  <input
                    className="form-input"
                    placeholder="Ej: Matemáticas, Comunicación, Educación Física"
                    value={datos.especialidad}
                    onChange={(e) => setDatos({ ...datos, especialidad: e.target.value })}
                  />
                </div>
              )}
            </>
          )}
          {esNuevo && mostrarEstudiante && (
            <>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="form-field" style={{ flex: 1 }}>
                  <label className="form-label">Grado</label>
                  <input className="form-input" placeholder="Ej: 5to" value={datos.grado} onChange={(e) => setDatos({ ...datos, grado: e.target.value })} />
                </div>
                <div className="form-field" style={{ flex: 1 }}>
                  <label className="form-label">Sección</label>
                  <input className="form-input" placeholder="Ej: A" value={datos.seccion} onChange={(e) => setDatos({ ...datos, seccion: e.target.value })} />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Código de matrícula</label>
                <input className="form-input" value={datos.codigo_matricula} onChange={(e) => setDatos({ ...datos, codigo_matricula: e.target.value })} />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" onClick={guardar} disabled={enviando}>
            {enviando ? "Guardando..." : (esNuevo ? "Crear cuenta" : "Guardar cambios")}
          </button>
        </div>
      </div>

      {/* Modal advertencia: desactivar es_docente con asignaciones activas */}
      {advertenciaAsignaciones !== null && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100,
        }}>
          <div style={{
            background: "var(--fondo)", borderRadius: 14, padding: 24, maxWidth: 400,
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)", margin: 16,
          }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>
              ¿Quitar rol docente?
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              Este usuario tiene <strong>{advertenciaAsignaciones} asignación{advertenciaAsignaciones !== 1 ? "es" : ""} de docente</strong> activas.
              <br /><br />
              Al desactivar el rol docente ya no podrá registrar notas en esas secciones, pero las asignaciones y las notas ya ingresadas <strong>no se eliminan</strong>.
              <br /><br />
              Si necesitas reasignar esas secciones a otro docente, ve a <em>Asignaciones de docentes</em>.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setAdvertenciaAsignaciones(null)}
                style={{
                  padding: "7px 16px", borderRadius: 8, fontSize: 13,
                  background: "var(--fondo)", border: "1px solid var(--borde)",
                  color: "var(--texto)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => { setEsDocente(false); setAdvertenciaAsignaciones(null); }}
                style={{
                  padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: "#DC2626", border: "none", color: "white", cursor: "pointer",
                }}
              >
                Sí, quitar rol docente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
