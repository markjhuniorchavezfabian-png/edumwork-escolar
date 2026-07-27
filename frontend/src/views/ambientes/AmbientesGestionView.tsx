import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  DoorOpen, Search, Plus, Eye, X, Loader2, Info, QrCode,
  School, Beaker, BookMarked, Users, Music, LayoutGrid,
} from "lucide-react";
import api from "../../services/api";
import { useToast } from "../../components/ui/Toast";
import { useConfirm } from "../../components/ui/Confirm";
import { cn } from "../../lib/utils";
import { Trash2 } from "lucide-react";

interface Ambiente {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  tipo_label?: string;
  edificio: string;
  piso: string;
  capacidad?: number | null;
  reservable?: boolean;
  activo: boolean;
}

const TIPOS = [
  { id: "aula_regular", label: "Aula regular", icon: School, color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  { id: "aip", label: "Aula de Innovación (AIP)", icon: LayoutGrid, color: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  { id: "laboratorio", label: "Laboratorio", icon: Beaker, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  { id: "biblioteca", label: "Biblioteca", icon: BookMarked, color: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  { id: "sala_musica", label: "Sala de música / arte", icon: Music, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  { id: "sala_docentes", label: "Sala de docentes", icon: Users, color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400" },
  { id: "direccion", label: "Dirección", icon: DoorOpen, color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  { id: "secretaria", label: "Secretaría", icon: DoorOpen, color: "bg-slate-500/10 text-slate-700 dark:text-slate-400" },
  { id: "administrativo", label: "Otro administrativo", icon: DoorOpen, color: "bg-slate-500/10 text-slate-700 dark:text-slate-400" },
  { id: "patio", label: "Patio / Losa deportiva", icon: DoorOpen, color: "bg-lime-500/10 text-lime-700 dark:text-lime-400" },
  { id: "auditorio", label: "Auditorio", icon: DoorOpen, color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  { id: "almacen", label: "Almacén", icon: DoorOpen, color: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400" },
  { id: "ss_hh", label: "Servicios higiénicos", icon: DoorOpen, color: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400" },
  { id: "otro", label: "Otro", icon: DoorOpen, color: "bg-neutral-500/10 text-neutral-700 dark:text-neutral-400" },
];

function tipoCfg(tipo: string) {
  return TIPOS.find((t) => t.id === tipo) ?? TIPOS[TIPOS.length - 1];
}

export default function AmbientesGestionView() {
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [creando, setCreando] = useState(false);
  const toast = useToast();
  const confirmar = useConfirm();

  async function cargar() {
    setCargando(true);
    try {
      const { data } = await api.get<{ results?: Ambiente[] } | Ambiente[]>(`/ambientes/${q ? `?q=${q}` : ""}`);
      const lista = Array.isArray(data) ? data : (data.results ?? []);
      setAmbientes(lista.filter((a) => a.activo));
    } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [q]);

  async function descargarQR(a: Ambiente) {
    try {
      const { data } = await api.get(`/ambientes/${a.id}/etiqueta-qr/`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `qr-${a.codigo}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.ok("QR descargado.");
    } catch {
      toast.error("No se pudo descargar el QR.");
    }
  }

  async function eliminarAmbiente(a: Ambiente) {
    const ok = await confirmar({
      titulo: "Eliminar ambiente",
      mensaje: `¿Eliminar "${a.nombre}"? Se perderán el QR y el historial de uso.`,
      variante: "peligro",
      textoConfirmar: "Eliminar",
    });
    if (!ok) return;
    try {
      await api.delete(`/ambientes/${a.id}/`);
      setAmbientes((prev) => prev.filter((x) => x.id !== a.id));
      toast.ok("Ambiente eliminado.");
    } catch {
      toast.error("No se pudo eliminar. Puede tener sesiones o reservas activas.");
    }
  }

  const filtrados = filtroTipo
    ? ambientes.filter((a) => a.tipo === filtroTipo)
    : ambientes;

  const conteoPorTipo = TIPOS.map((t) => ({
    ...t,
    n: ambientes.filter((a) => a.tipo === t.id).length,
  })).filter((t) => t.n > 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header + acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ambientes de la I.E.</h1>
          <p className="text-sm text-muted-foreground">
            Espacios físicos del colegio (aulas, labs, biblioteca...) con QR imprimible.
          </p>
        </div>
        <button
          onClick={() => setCreando(true)}
          className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center gap-2 shrink-0"
        >
          <Plus size={16} /> Nuevo ambiente
        </button>
      </div>

      {/* Banner explicativo */}
      <div className="rounded-2xl border border-blue-500/40 bg-blue-500/5 p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Info size={20} />
        </div>
        <div className="flex-1 text-sm space-y-1.5">
          <div className="font-semibold text-foreground">¿Qué son los ambientes?</div>
          <p className="text-muted-foreground">
            Son los <strong>espacios físicos</strong> de tu colegio: aulas, laboratorios, biblioteca, sala de docentes, etc.
            Diferente de las <strong>Secciones</strong> (que son grupos de estudiantes). Registrar los ambientes te permite:
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5 mt-2">
            <li>Descargar un <strong>QR imprimible</strong> por ambiente para pegar en la puerta</li>
            <li>Docentes escanean el QR para registrar sesiones de clase (AIP, labs)</li>
            <li>Sistema de <strong>reservas</strong> para labs/biblioteca/sala de música</li>
            <li>Bitácora automática de "¿quién usó qué ambiente y cuándo?"</li>
          </ul>
        </div>
      </div>

      {/* Filtros: búsqueda + chips por tipo */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {conteoPorTipo.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFiltroTipo("")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                !filtroTipo ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              )}
            >
              Todos · {ambientes.length}
            </button>
            {conteoPorTipo.map((t) => (
              <button
                key={t.id}
                onClick={() => setFiltroTipo(t.id === filtroTipo ? "" : t.id)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
                  filtroTipo === t.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                )}
              >
                <t.icon size={11} /> {t.label} · {t.n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-muted-foreground" size={28} />
        </div>
      ) : filtrados.length === 0 ? (
        ambientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <DoorOpen size={48} className="mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Aún no registraste ningún ambiente</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Empezá por lo principal: <strong>aulas del 1er piso, sala de docentes, dirección</strong>.
              Los demás los podés ir agregando con el tiempo.
            </p>
            <button
              onClick={() => setCreando(true)}
              className="mt-4 h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 inline-flex items-center gap-2"
            >
              <Plus size={16} /> Crear mi primer ambiente
            </button>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            No se encontraron ambientes con ese filtro.
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((a) => {
            const cfg = tipoCfg(a.tipo);
            const Icono = cfg.icon;
            return (
              <div key={a.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", cfg.color)}>
                    <Icono size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{a.nombre}</div>
                    <div className="text-[11px] text-muted-foreground">
                      <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{a.codigo}</code>
                      {a.edificio && <span> · {a.edificio}</span>}
                      {a.piso && <span> · {a.piso}</span>}
                    </div>
                  </div>
                </div>
                <div className={cn("inline-block text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide", cfg.color)}>
                  {a.tipo_label || cfg.label}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => descargarQR(a)}
                    className="flex-1 h-8 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                  >
                    <QrCode size={11} /> QR PDF
                  </button>
                  <Link
                    to={`/ambiente/${a.codigo}`}
                    className="flex-1 h-8 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Eye size={11} /> Bitácora
                  </Link>
                  <button
                    onClick={() => eliminarAmbiente(a)}
                    title="Eliminar ambiente"
                    className="h-8 w-8 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creando && (
        <NuevoAmbienteModal
          onCerrar={() => setCreando(false)}
          onCreado={() => { setCreando(false); cargar(); toast.ok("Ambiente creado."); }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ MODAL NUEVO ═══ */
function NuevoAmbienteModal({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [f, setF] = useState({
    nombre: "", codigo: "", tipo: "aula_regular",
    edificio: "", piso: "", capacidad: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState("");

  async function crear() {
    if (!f.nombre.trim() || !f.codigo.trim()) {
      setErr("Nombre y código son obligatorios."); return;
    }
    setErr(""); setEnviando(true);
    try {
      await api.post("/ambientes/", {
        ...f,
        capacidad: f.capacidad ? Number(f.capacidad) : null,
      });
      onCreado();
    } catch (e: unknown) {
      const ee = e as { response?: { data?: unknown } };
      setErr(`Error: ${JSON.stringify(ee.response?.data)}`.slice(0, 200));
    } finally { setEnviando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">Nuevo ambiente</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Registrá un espacio físico de tu colegio.</p>
          </div>
          <button onClick={onCerrar} className="p-1 rounded-md hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nombre *" value={f.nombre} onChange={(v) => setF({ ...f, nombre: v })} placeholder="Ej: Aula 5to A" span={2} />
            <Campo label="Código único *" value={f.codigo} onChange={(v) => setF({ ...f, codigo: v.toUpperCase() })} placeholder="Ej: A-5A" />

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Tipo</label>
              <select
                value={f.tipo}
                onChange={(e) => setF({ ...f, tipo: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <Campo label="Edificio" value={f.edificio} onChange={(v) => setF({ ...f, edificio: v })} placeholder="Ej: Principal" />
            <Campo label="Piso" value={f.piso} onChange={(v) => setF({ ...f, piso: v })} placeholder="Ej: 2do piso" />
            <Campo label="Capacidad estimada" type="number" value={f.capacidad} onChange={(v) => setF({ ...f, capacidad: v })} placeholder="35" span={2} />
          </div>

          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onCerrar} className="h-9 px-4 rounded-md text-sm font-medium hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={crear}
            disabled={enviando}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
            {enviando ? "Creando..." : "Crear ambiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, placeholder, type, span }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; span?: number;
}) {
  return (
    <div className={cn("space-y-1.5", span === 2 && "col-span-2")}>
      <label className="text-xs font-medium">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
