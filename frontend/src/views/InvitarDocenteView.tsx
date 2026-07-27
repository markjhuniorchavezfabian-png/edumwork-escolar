/**
 * Integrar docentes a la I.E.
 * Patrón: header + filtros + lista plana (como UsuariosView).
 * Acciones primarias en modales, no cards apiladas.
 */
import { useEffect, useRef, useState } from "react";
import { Mail, Send, Copy, CheckCircle2, Clock, XCircle, Upload, Loader2, X, Info } from "lucide-react";
import api from "../services/api";
import { useToast } from "../components/ui/Toast";

interface Invitacion {
  id: number;
  email: string;
  estado: "pendiente" | "aceptada" | "expirada" | "rechazada";
  token: string;
  existe_cuenta_previa: boolean;
  expira_en: string;
  aceptada_en: string | null;
  creado_en: string;
}

const ESTADO_INFO = {
  pendiente: { icon: Clock,        color: "#F59E0B", label: "Pendiente" },
  aceptada:  { icon: CheckCircle2, color: "#10B981", label: "Aceptada" },
  expirada:  { icon: XCircle,      color: "#6B7280", label: "Expirada" },
  rechazada: { icon: XCircle,      color: "#EF4444", label: "Rechazada" },
};

type FiltroEstado = "todos" | "pendiente" | "aceptada" | "expirada";

export default function InvitarDocenteView() {
  const toast = useToast();
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [modalInvitar, setModalInvitar] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);

  async function refetch() {
    try {
      const { data } = await api.get<{ invitaciones: Invitacion[] }>("/auth/invitaciones/");
      setInvitaciones(data.invitaciones);
    } catch { /* empty */ }
    setCargando(false);
  }

  useEffect(() => { refetch(); }, []);

  function copiarLink(token: string) {
    const url = `${window.location.origin}/aceptar-invitacion/${token}`;
    navigator.clipboard.writeText(url);
    toast.ok("Link copiado al portapapeles");
  }

  const filtradas = invitaciones.filter(i => {
    if (filtroEstado !== "todos" && i.estado !== filtroEstado) return false;
    if (busqueda && !i.email.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 2 }}>Integrar docentes</h2>
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: 0 }}>
            Invita docentes que ya usan la sub-app o importa sus datos vía backup JSON.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secundario" onClick={() => setModalImportar(true)}
            style={{ padding: "8px 12px", width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} /> Importar backup
          </button>
          <button className="btn btn-primario" onClick={() => setModalInvitar(true)}
            style={{ padding: "8px 14px", width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Send size={14} /> Nueva invitación
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <input className="form-input" style={{ flex: 1, minWidth: 180, maxWidth: 280 }}
          placeholder="Buscar por email..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="form-input" style={{ width: "auto" }}
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as FiltroEstado)}>
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="aceptada">Aceptadas</option>
          <option value="expirada">Expiradas</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
          {filtradas.length} invitación{filtradas.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto", color: "var(--muted-foreground)" }} />
        </div>
      ) : filtradas.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
          {invitaciones.length === 0
            ? "No has enviado invitaciones. Haz clic en 'Nueva invitación' para empezar."
            : "No hay invitaciones que coincidan con los filtros."}
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          {filtradas.map((inv, idx) => {
            const E = ESTADO_INFO[inv.estado];
            return (
              <div key={inv.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                borderBottom: idx < filtradas.length - 1 ? "1px solid var(--border)" : "none",
                background: idx % 2 ? "transparent" : "var(--muted)",
              }}>
                <Mail size={16} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {inv.email}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                    Enviada: {new Date(inv.creado_en).toLocaleDateString()}
                    {inv.existe_cuenta_previa && " · Cuenta personal detectada"}
                    {inv.aceptada_en && ` · Aceptada: ${new Date(inv.aceptada_en).toLocaleDateString()}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: E.color, fontWeight: 600, whiteSpace: "nowrap" }}>
                  <E.icon size={12} /> {E.label}
                </div>
                {inv.estado === "pendiente" && (
                  <button onClick={() => copiarLink(inv.token)} title="Copiar link"
                    style={{ padding: 6, borderRadius: 4, border: "1px solid var(--border)",
                      background: "var(--background)", cursor: "pointer" }}>
                    <Copy size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      <div style={{ marginTop: 16, padding: 10, background: "var(--muted)", borderRadius: 6, fontSize: 11, color: "var(--muted-foreground)", display: "flex", gap: 8 }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Invitación por email:</strong> el docente conserva su cuenta y datos, todo se enlaza a la I.E.
          {" "}<strong>Import backup:</strong> subes un JSON estático, se crean copias en la I.E. (el docente sigue con su cuenta aparte).
        </span>
      </div>

      {modalInvitar && <ModalInvitar onCerrar={() => setModalInvitar(false)} onEnviada={() => { setModalInvitar(false); refetch(); }} />}
      {modalImportar && <ModalImportar onCerrar={() => setModalImportar(false)} onImportado={() => { setModalImportar(false); refetch(); }} />}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════ MODALES ═══ */

function ModalInvitar({ onCerrar, onEnviada }: { onCerrar: () => void; onEnviada: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ email: "", area_sugerida: "", mensaje: "" });
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!form.email.trim()) return;
    setEnviando(true);
    try {
      await api.post("/auth/invitar-docente/", form);
      toast.ok("Invitación enviada. El docente recibirá un email.");
      onEnviada();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Error al enviar.";
      toast.error(msg);
    } finally {
      setEnviando(false);
    }
  }

  return <ModalShell titulo="Nueva invitación" onCerrar={onCerrar}>
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Email del docente *</span>
        <input type="email" value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="juan.perez@ejemplo.com" className="form-input" />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Área sugerida (opcional)</span>
        <input value={form.area_sugerida}
          onChange={e => setForm({ ...form, area_sugerida: e.target.value })}
          placeholder="Matemática" className="form-input" />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Mensaje (opcional)</span>
        <textarea value={form.mensaje} rows={3}
          onChange={e => setForm({ ...form, mensaje: e.target.value })}
          placeholder="Hola Juan, te invito a unirte al sistema del colegio..."
          className="form-input" style={{ resize: "vertical" }} />
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button className="btn btn-secundario" onClick={onCerrar} style={{ width: "auto" }}>Cancelar</button>
        <button className="btn btn-primario" onClick={enviar} disabled={enviando || !form.email.trim()} style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {enviando ? "Enviando..." : "Enviar invitación"}
        </button>
      </div>
    </div>
  </ModalShell>;
}

function ModalImportar({ onCerrar, onImportado }: { onCerrar: () => void; onImportado: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  async function importar(file: File) {
    setImportando(true);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const { data } = await api.post<{ importado: { secciones: number; estudiantes: number; notas: number; duplicados_dni: string[] } }>(
        "/auth/importar-backup-docente/", fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const r = data.importado;
      toast.ok(
        `Importado: ${r.secciones} secciones, ${r.estudiantes} estudiantes, ${r.notas} notas.` +
        (r.duplicados_dni.length > 0 ? ` (${r.duplicados_dni.length} DNIs ya existían)` : "")
      );
      onImportado();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Error al importar.";
      toast.error(msg);
    } finally {
      setImportando(false);
    }
  }

  return <ModalShell titulo="Importar backup de docente" onCerrar={onCerrar}>
    <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 14 }}>
      Sube el archivo <code>mi_backup_*.json</code> que el docente descargó desde su sub-app.
      Se crearán copias de sus secciones, estudiantes y notas dentro del colegio.
    </p>
    <div onClick={() => inputRef.current?.click()}
      style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: 32, textAlign: "center", cursor: "pointer" }}>
      {importando ? (
        <>
          <Loader2 size={28} className="animate-spin" style={{ margin: "0 auto 8px", color: "var(--primary)" }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Importando...</div>
        </>
      ) : (
        <>
          <Upload size={28} style={{ color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Haz clic para seleccionar archivo JSON</div>
        </>
      )}
      <input ref={inputRef} type="file" accept=".json,application/json" style={{ display: "none" }}
        onChange={e => e.target.files?.[0] && importar(e.target.files[0])} />
    </div>
  </ModalShell>;
}

function ModalShell({ titulo, children, onCerrar }: { titulo: string; children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--background)", borderRadius: 12, width: "100%", maxWidth: 520,
        boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{titulo}</span>
          <button onClick={onCerrar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}
