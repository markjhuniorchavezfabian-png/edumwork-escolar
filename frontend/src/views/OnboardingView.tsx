import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  GraduationCap, Users, UserSquare2, CheckCircle2, Loader2,
  ArrowRight, ArrowLeft, FileSpreadsheet, Plus, Trash2, Sparkles,
  Building2, LayoutGrid, type LucideIcon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  getOnboardingStatus, patchConfig, crearSeccion, crearDocente,
  descargarTemplateDocentes, importarDocentesExcel,
  type OnboardingStatus, type ResultadoImport,
} from "../services/onboarding";
import { cn } from "../lib/utils";

type StepId = "config" | "modulos" | "secciones" | "docentes" | "estudiantes" | "listo";

interface Step {
  id: StepId;
  label: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  { id: "config", label: "Institución", icon: Building2 },
  { id: "modulos", label: "Módulos", icon: LayoutGrid },
  { id: "secciones", label: "Secciones", icon: GraduationCap },
  { id: "docentes", label: "Docentes", icon: UserSquare2 },
  { id: "estudiantes", label: "Estudiantes", icon: Users },
  { id: "listo", label: "Listo", icon: CheckCircle2 },
];

// Definición de todos los módulos disponibles
interface ModuloDef {
  codigo: string;
  nombre: string;
  descripcion: string;
  icono: string;
  base: boolean; // true = siempre activo, no se puede desactivar
}

const MODULOS_DISPONIBLES: ModuloDef[] = [
  // Base (siempre activos — informativo)
  { codigo: "_notas",      nombre: "Registro de notas",     descripcion: "Calificaciones por área y bimestre. SIAGIE-compatible.", icono: "📝", base: true },
  { codigo: "_asistencia", nombre: "Asistencia",            descripcion: "Control diario de asistencia de estudiantes.",           icono: "📋", base: true },
  { codigo: "_comunicados",nombre: "Comunicados",           descripcion: "Avisos y circulares para padres, docentes y dirección.", icono: "📢", base: true },
  { codigo: "_tic",        nombre: "Incidencias TI",        descripcion: "Mesa de ayuda para equipos y red del colegio.",         icono: "🖥️", base: true },
  // Opcionales
  { codigo: "convivencia",         nombre: "Convivencia (SíseVe)",   descripcion: "Protocolos MINEDU para casos de convivencia escolar.", icono: "🤝", base: false },
  { codigo: "aula_virtual",        nombre: "Aula virtual",           descripcion: "Cursos, lecciones y tareas. Alumnos y padres pueden verlo.", icono: "💻", base: false },
  { codigo: "sesiones_clase",      nombre: "Sesiones de clase",      descripcion: "Docentes registran sesiones en ambientes especiales.", icono: "🏫", base: false },
  { codigo: "reservas",            nombre: "Reservas de ambientes",  descripcion: "Reservar aulas y laboratorios para actividades.", icono: "📅", base: false },
  { codigo: "inventario",          nombre: "Inventario TI",          descripcion: "Control de equipos: PCs, proyectores, impresoras.", icono: "📦", base: false },
  { codigo: "visitas",             nombre: "Control de visitas",     descripcion: "Registro de portería y gafetes QR.",               icono: "🚪", base: false },
  { codigo: "asistencia_personal", nombre: "Asistencia del personal",descripcion: "Entrada/salida del staff: docentes, admin, conserje.", icono: "👤", base: false },
  { codigo: "laboratorio",         nombre: "Laboratorio",            descripcion: "Reserva y control del laboratorio de cómputo.",   icono: "🔬", base: false },
  { codigo: "biblioteca",          nombre: "Biblioteca",             descripcion: "Préstamo y devolución de libros.",                 icono: "📚", base: false },
  { codigo: "tutoria",             nombre: "Tutoría",                descripcion: "Seguimiento de tutoría y orientación por sección.", icono: "🎓", base: false },
  { codigo: "ia",                  nombre: "Asistente de IA",        descripcion: "Análisis de informes e incidencias con IA. Requiere API key.", icono: "✨", base: false },
];

export default function OnboardingView() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [current, setCurrent] = useState<StepId>("config");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOnboardingStatus()
      .then((s) => {
        setStatus(s);
        if (!s.pasos.config.completo) setCurrent("config");
        else if (!s.pasos.secciones.completo) setCurrent("secciones");
        else if (!s.pasos.docentes.completo) setCurrent("docentes");
        else if (!s.pasos.estudiantes.completo) setCurrent("estudiantes");
        else setCurrent("listo");
      })
      .catch(() => { /* no crítico */ })
      .finally(() => setLoading(false));
  }, []);

  async function refetch() {
    const s = await getOnboardingStatus();
    setStatus(s);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-base font-semibold">Configuración inicial</h1>
              <p className="text-xs text-muted-foreground">
                {usuario?.first_name}, vamos a preparar tu colegio en pocos pasos.
              </p>
            </div>
          </div>
          {status?.completado && (
            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Saltar por ahora →
            </button>
          )}
        </div>

        {/* Stepper */}
        <div className="max-w-4xl mx-auto px-6 pb-4">
          <div className="flex items-center justify-between gap-1">
            {STEPS.map((s, i) => {
              const isDone = status && i < currentIdx;
              const isActive = s.id === current;
              const isFuture = i > currentIdx;
              return (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      disabled={isFuture}
                      onClick={() => !isFuture && setCurrent(s.id)}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                        isDone && "bg-emerald-500 text-white",
                        isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                        isFuture && "bg-muted text-muted-foreground cursor-not-allowed",
                      )}
                    >
                      {isDone ? <CheckCircle2 size={16} /> : <s.icon size={16} />}
                    </button>
                    <span className={cn(
                      "text-[10px] font-medium",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-2 rounded transition-colors",
                      isDone ? "bg-emerald-500" : "bg-border"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-6 py-10">
        {current === "config" && <StepConfig onDone={() => { refetch(); setCurrent("modulos"); }} />}
        {current === "modulos" && <StepModulos onDone={() => setCurrent("secciones")} onBack={() => setCurrent("config")} />}
        {current === "secciones" && <StepSecciones status={status}
          onDone={() => { refetch(); setCurrent("docentes"); }}
          onBack={() => setCurrent("modulos")} />}
        {current === "docentes" && <StepDocentes status={status} onDone={() => { refetch(); setCurrent("estudiantes"); }} onBack={() => setCurrent("secciones")} />}
        {current === "estudiantes" && <StepEstudiantes status={status}
          onDone={() => { refetch(); setCurrent("listo"); }}
          onBack={() => setCurrent("docentes")} />}
        {current === "listo" && <StepListo onFinish={() => navigate("/")} />}
      </main>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ STEP: CONFIG ═════ */
function StepConfig({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    nombre_institucion: "", codigo_modular: "", direccion: "",
    ugel: "", dre: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    import("../services/onboarding").then((m) => m.getConfig())
      .then((cfg) => setForm({
        nombre_institucion: cfg.nombre_institucion,
        codigo_modular: cfg.codigo_modular,
        direccion: cfg.direccion, ugel: cfg.ugel, dre: cfg.dre,
      })).catch(() => { /* no crítico */ });
  }, []);

  async function submit() {
    setErr(""); setSaving(true);
    try {
      await patchConfig(form);
      onDone();
    } catch {
      setErr("No se pudo guardar. Verifica que estás autenticado como director/admin_tic.");
    } finally { setSaving(false); }
  }

  return (
    <StepShell
      icon={Building2}
      title="Datos de tu institución"
      subtitle="Estos datos aparecerán en boletas, comunicados y la cabecera del sistema."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre completo" required span={2}
          value={form.nombre_institucion}
          onChange={(v) => setForm({ ...form, nombre_institucion: v })}
          placeholder="Ej: I.E. Nombre de tu institución"
        />
        <Field label="Código modular" required
          value={form.codigo_modular}
          onChange={(v) => setForm({ ...form, codigo_modular: v })}
          placeholder="0712885"
        />
        <Field label="Dirección" span={2}
          value={form.direccion}
          onChange={(v) => setForm({ ...form, direccion: v })}
          placeholder="Av. ... - Distrito, Provincia"
        />
        <Field label="UGEL"
          value={form.ugel}
          onChange={(v) => setForm({ ...form, ugel: v })}
          placeholder="UGEL Huánuco"
        />
        <Field label="DRE"
          value={form.dre}
          onChange={(v) => setForm({ ...form, dre: v })}
          placeholder="DRE Huánuco"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Podrás ajustar horarios y geolocalización después en <strong>Administración → Configuración</strong>.
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <StepFooter
        canContinue={!!(form.nombre_institucion && form.codigo_modular)}
        onNext={submit}
        loading={saving}
      />
    </StepShell>
  );
}

/* ═══════════════════════════════════════════════════════ STEP: SECCIONES ════ */
type NivelId = "inicial" | "primaria" | "secundaria";

const NIVELES: { id: NivelId; label: string; grados: string[] }[] = [
  { id: "inicial", label: "Inicial", grados: ["3 años", "4 años", "5 años"] },
  { id: "primaria", label: "Primaria", grados: ["1ro", "2do", "3ro", "4to", "5to", "6to"] },
  { id: "secundaria", label: "Secundaria", grados: ["1ro", "2do", "3ro", "4to", "5to"] },
];

/* ══════════════════════════════════════════════════════ STEP: MÓDULOS ══════ */
function StepModulos({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  // Solo los módulos opcionales se guardan (los base son siempre activos)
  const OPCIONALES = MODULOS_DISPONIBLES.filter(m => !m.base);
  const [seleccionados, setSeleccionados] = useState<string[]>(() =>
    OPCIONALES.filter(m => ["convivencia", "aula_virtual", "inventario", "asistencia_personal", "ia"].includes(m.codigo)).map(m => m.codigo)
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Cargar selección previa si ya fue configurada
  useEffect(() => {
    import("../services/onboarding").then(m => m.getConfig())
      .then(cfg => {
        if (cfg.modulos_activos && cfg.modulos_activos.length > 0) {
          // Solo mostrar los que son opcionales (sin prefijo _)
          setSeleccionados(cfg.modulos_activos.filter((c: string) => !c.startsWith("_")));
        }
      }).catch(() => {});
  }, []);

  function toggle(codigo: string, base: boolean) {
    if (base) return;
    setSeleccionados(prev =>
      prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]
    );
  }

  async function submit() {
    setSaving(true); setErr("");
    try {
      await patchConfig({ modulos_activos: seleccionados });
      onDone();
    } catch {
      setErr("No se pudo guardar la selección de módulos.");
    } finally { setSaving(false); }
  }

  return (
    <StepShell
      icon={LayoutGrid}
      title="¿Qué módulos usa tu institución?"
      subtitle="Activa solo lo que necesitas. Puedes cambiar esto después en Configuración."
    >
      <div className="grid grid-cols-1 gap-3">
        {MODULOS_DISPONIBLES.map(mod => {
          const activo = seleccionados.includes(mod.codigo);
          return (
            <button
              key={mod.codigo}
              type="button"
              onClick={() => toggle(mod.codigo, mod.base)}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                activo
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground/40",
                mod.base && "opacity-80 cursor-default"
              )}
            >
              <span className="text-2xl leading-none mt-0.5">{mod.icono}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{mod.nombre}</span>
                  {mod.base && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Incluido
                    </span>
                  )}
                  {!mod.base && activo && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                      Activado
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.descripcion}</p>
              </div>
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                activo ? "border-primary bg-primary" : "border-border"
              )}>
                {activo && <CheckCircle2 size={12} className="text-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>

      {err && <p className="text-sm text-destructive mt-2">{err}</p>}

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          <ArrowLeft size={16} /> Atrás
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {saving ? "Guardando..." : "Continuar"}
        </button>
      </div>
    </StepShell>
  );
}

function StepSecciones({ status, onDone, onBack }:
  { status: OnboardingStatus | null; onDone: () => void; onBack: () => void }) {

  const [nivelesActivos, setNivelesActivos] = useState<Set<NivelId>>(new Set(["primaria"]));
  // Key: "nivel|grado", value: letras seleccionadas string (ej "ABC")
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const yaCreadas = status?.pasos.secciones.total ?? 0;

  function toggleNivel(nivel: NivelId) {
    setNivelesActivos((prev) => {
      const next = new Set(prev);
      if (next.has(nivel)) next.delete(nivel);
      else next.add(nivel);
      return next;
    });
  }

  function toggleLetra(clave: string, letra: string) {
    setSelecciones((prev) => {
      const actuales = (prev[clave] || "").split("").filter(Boolean);
      const idx = actuales.indexOf(letra);
      if (idx >= 0) actuales.splice(idx, 1);
      else actuales.push(letra);
      return { ...prev, [clave]: actuales.sort().join("") };
    });
  }

  async function submit() {
    setErr(""); setSaving(true);
    try {
      const promesas: Promise<unknown>[] = [];
      for (const [clave, letras] of Object.entries(selecciones)) {
        const [nivel, grado] = clave.split("|");
        const nivelId = nivel as "inicial" | "primaria" | "secundaria";
        for (const letra of letras) {
          const nombre = nivel === "inicial"
            ? `Inicial ${grado} ${letra}`
            : `${grado} ${letra} (${NIVELES.find(n => n.id === nivelId)!.label.charAt(0)})`;
          promesas.push(crearSeccion({ grado, letra, nombre, nivel: nivelId }));
        }
      }
      await Promise.all(promesas);
      onDone();
    } catch {
      setErr("Hubo un problema creando algunas secciones. Puedes editarlas después en /secciones.");
    } finally { setSaving(false); }
  }

  const totalNuevas = Object.values(selecciones).reduce((s, l) => s + l.length, 0);

  return (
    <StepShell
      icon={GraduationCap}
      title="Crea tus secciones"
      subtitle="Primero indica qué niveles atiende tu colegio. Luego marca los grados y letras (A, B, C...) de cada uno."
    >
      {yaCreadas > 0 && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          Ya tienes <strong>{yaCreadas}</strong> secciones creadas. Puedes agregar más o continuar.
        </div>
      )}

      {/* Selector de niveles */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          ¿Qué niveles atiende tu colegio?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {NIVELES.map((n) => {
            const activo = nivelesActivos.has(n.id);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => toggleNivel(n.id)}
                className={cn(
                  "rounded-xl border-2 p-3 text-sm font-semibold transition-colors",
                  activo
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grados por nivel activo */}
      {NIVELES.filter((n) => nivelesActivos.has(n.id)).map((n) => (
        <div key={n.id} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {n.label}
          </div>
          {n.grados.map((g) => {
            const clave = `${n.id}|${g}`;
            return (
              <div key={clave} className="flex items-center gap-3 rounded-md border border-border p-3">
                <span className="text-sm font-semibold w-20 text-foreground shrink-0">{g}</span>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {["A", "B", "C", "D", "E", "F"].map((l) => {
                    const activo = selecciones[clave]?.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => toggleLetra(clave, l)}
                        className={cn(
                          "w-9 h-9 rounded-md border text-sm font-medium transition-colors",
                          activo
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted"
                        )}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {nivelesActivos.size === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Marca al menos un nivel para ver los grados disponibles.
        </div>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}

      <StepFooter
        canContinue={yaCreadas > 0 || totalNuevas > 0}
        onNext={submit}
        onBack={onBack}
        loading={saving}
        continueLabel={totalNuevas > 0 ? `Crear ${totalNuevas} sección(es) y continuar` : "Continuar"}
      />
    </StepShell>
  );
}

/* ═══════════════════════════════════════════════════════ STEP: DOCENTES ═════ */
function StepDocentes({ status, onDone, onBack }:
  { status: OnboardingStatus | null; onDone: () => void; onBack: () => void }) {

  interface DocForm {
    id: string; username: string; first_name: string; last_name: string;
    dni: string; especialidad: string;
  }
  const [docentes, setDocentes] = useState<DocForm[]>([
    { id: "1", username: "", first_name: "", last_name: "", dni: "", especialidad: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const yaCreados = status?.pasos.docentes.total ?? 0;

  function update(id: string, patch: Partial<DocForm>) {
    setDocentes((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function addRow() {
    setDocentes((prev) => [...prev, {
      id: String(Date.now()), username: "", first_name: "", last_name: "", dni: "", especialidad: "",
    }]);
  }
  function removeRow(id: string) {
    setDocentes((prev) => prev.filter((d) => d.id !== id));
  }

  async function submit() {
    setErr(""); setSaving(true);
    try {
      const validos = docentes.filter((d) => d.username && d.first_name && d.last_name);
      await Promise.all(validos.map((d) => crearDocente(d)));
      onDone();
    } catch {
      setErr("Algún docente no pudo crearse. Verifica que los usernames no estén repetidos.");
    } finally { setSaving(false); }
  }

  const validos = docentes.filter((d) => d.username && d.first_name && d.last_name).length;

  return (
    <StepShell
      icon={UserSquare2}
      title="Agrega tus docentes"
      subtitle="Puedes crear los primeros aquí, o subirlos masivamente por Excel más tarde en Administración > Importar."
    >
      {yaCreados > 0 && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          Ya tienes <strong>{yaCreados}</strong> docentes registrados.
        </div>
      )}

      <div className="space-y-3">
        {docentes.map((d, i) => (
          <div key={d.id} className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Docente #{i + 1}</span>
              {docentes.length > 1 && (
                <button type="button" onClick={() => removeRow(d.id)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nombres" value={d.first_name} onChange={(v) => update(d.id, { first_name: v })} placeholder="Ana María" />
              <Field label="Apellidos" value={d.last_name} onChange={(v) => update(d.id, { last_name: v })} placeholder="García Pérez" />
              <Field label="Usuario" value={d.username} onChange={(v) => update(d.id, { username: v })} placeholder="agarcia" />
              <Field label="DNI" value={d.dni} onChange={(v) => update(d.id, { dni: v })} placeholder="12345678" />
              <Field label="Especialidad" span={2} value={d.especialidad} onChange={(v) => update(d.id, { especialidad: v })} placeholder="Matemática" />
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow}
        className="w-full py-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-2">
        <Plus size={14} /> Agregar otro docente
      </button>

      {/* Import Excel masivo aquí mismo */}
      <ImportarDocentesExcel onDone={() => afterExcel()} />

      {err && <p className="text-xs text-destructive">{err}</p>}

      <StepFooter
        canContinue={validos > 0 || yaCreados > 0}
        onNext={submit}
        onBack={onBack}
        loading={saving}
        continueLabel={validos > 0 ? `Crear ${validos} docente(s) y continuar` : "Continuar"}
      />
    </StepShell>
  );

  function afterExcel() { /* recarga status más adelante si es necesario */ }
}

/* ─── Sub-componente: import Excel dentro del paso Docentes ───────────────── */
function ImportarDocentesExcel({ onDone }: { onDone?: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [err, setErr] = useState("");

  async function bajar() {
    try { await descargarTemplateDocentes(); }
    catch { setErr("No se pudo descargar la plantilla."); }
  }

  async function subir() {
    if (!archivo) return;
    setErr(""); setEnviando(true);
    try {
      const r = await importarDocentesExcel(archivo);
      setResultado(r);
      if (r.creados > 0) onDone?.();
    } catch (e: unknown) {
      const ee = e as { response?: { data?: { error?: string } } };
      setErr(ee.response?.data?.error ?? "Error al importar. Revisa el formato del Excel.");
    } finally { setEnviando(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={20} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold">Cargar muchos docentes desde Excel</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Descarga la plantilla, llénala con los docentes de tu colegio y súbela aquí.
            Se crearán los usuarios automáticamente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={bajar}
          className="h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <FileSpreadsheet size={14} /> Descargar plantilla
        </button>
        <label className="h-10 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2 cursor-pointer">
          <Plus size={14} /> {archivo ? archivo.name.slice(0, 20) + "..." : "Elegir Excel lleno"}
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setResultado(null); }}
          />
        </label>
      </div>

      {archivo && !resultado && (
        <button
          type="button"
          onClick={subir}
          disabled={enviando}
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
          {enviando ? "Procesando..." : "Importar Excel"}
        </button>
      )}

      {err && <p className="text-xs text-destructive">{err}</p>}

      {resultado && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs space-y-1 text-emerald-900 dark:text-emerald-100">
          <div><strong>{resultado.creados}</strong> docentes creados</div>
          {(resultado.omitidos_por_dni_repetido ?? 0) > 0 && (
            <div>{resultado.omitidos_por_dni_repetido} omitidos (DNI ya existía)</div>
          )}
          {resultado.errores.length > 0 && (
            <div className="text-amber-800 dark:text-amber-200">
              {resultado.errores.length} filas con error:
              <ul className="mt-1 space-y-0.5">
                {resultado.errores.slice(0, 3).map((er, i) => (
                  <li key={i}>· Fila {er.fila}: {er.mensaje || er.error}</li>
                ))}
                {resultado.errores.length > 3 && <li>...y {resultado.errores.length - 3} más</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ═════════════════════════════════════════════════════ STEP: ESTUDIANTES ════ */
function StepEstudiantes({ status, onDone, onBack }:
  { status: OnboardingStatus | null; onDone: () => void; onBack: () => void }) {
  const yaCreados = status?.pasos.estudiantes.total ?? 0;

  return (
    <StepShell
      icon={Users}
      title="Matricula a tus estudiantes"
      subtitle="Recomendado: descarga la plantilla Excel, llénala con la nómina de tu SIAGIE y súbela. Es lo más rápido."
    >
      {yaCreados > 0 && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          Ya tienes <strong>{yaCreados}</strong> estudiantes matriculados.
        </div>
      )}

      <div className="rounded-lg border border-border p-6 space-y-4 bg-card">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Importar por Excel</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Descarga la plantilla, llénala con los datos SIAGIE y súbela.
              Se crearán usuarios y fichas automáticamente.
            </p>
          </div>
        </div>
        <Link
          to="/importar"
          className="block w-full text-center py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Ir a importar Excel →
        </Link>
      </div>

      <div className="text-xs text-center text-muted-foreground">
        Puedes también agregar estudiantes uno a uno desde <Link to="/estudiantes" className="text-primary hover:underline">Fichas de estudiantes</Link> más tarde.
      </div>

      <StepFooter
        canContinue={true}
        onNext={onDone}
        onBack={onBack}
        continueLabel={yaCreados > 0 ? "Continuar" : "Continuar (haré esto después)"}
      />
    </StepShell>
  );
}

/* ═════════════════════════════════════════════════════════ STEP: LISTO ══════ */
function StepListo({ onFinish }: { onFinish: () => void }) {
  return (
    <StepShell
      icon={CheckCircle2}
      title="Todo listo"
      subtitle="Tu colegio está configurado. Puedes empezar a usar el sistema."
      iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <div className="rounded-lg border border-border p-6 bg-card space-y-3">
        <p className="text-sm text-foreground">
          <strong>Próximos pasos sugeridos:</strong>
        </p>
        <ul className="text-sm space-y-2 text-muted-foreground">
          <li>• Asigna tutores a cada sección en <Link to="/secciones" className="text-primary hover:underline">Administración → Secciones</Link></li>
          <li>• Envía las credenciales a los docentes (usuario + contraseña temporal)</li>
          <li>• Configura hora tope de entrada en <Link to="/config" className="text-primary hover:underline">Configuración</Link></li>
          <li>• Prueba marcar asistencia en un día de clase</li>
        </ul>
      </div>
      <button
        onClick={onFinish}
        className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        Ir al dashboard <ArrowRight size={16} />
      </button>
    </StepShell>
  );
}

/* ══════════════════════════════════════════════════════════ HELPERS ═════════ */
function StepShell({ icon: Icon, title, subtitle, children, iconClass }: {
  icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode; iconClass?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
          iconClass ?? "bg-primary/10 text-primary"
        )}>
          <Icon size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, span, type }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; span?: number; type?: string;
}) {
  return (
    <div className={cn("space-y-1", span === 2 && "md:col-span-2")}>
      <label className="text-xs font-medium text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
      />
    </div>
  );
}

function StepFooter({ canContinue, onNext, onBack, loading, continueLabel }: {
  canContinue: boolean; onNext: () => void; onBack?: () => void;
  loading?: boolean; continueLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-border">
      {onBack ? (
        <button onClick={onBack} type="button"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <ArrowLeft size={14} /> Atrás
        </button>
      ) : <span />}
      <button
        onClick={onNext}
        disabled={!canContinue || loading}
        className="px-5 h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        {continueLabel ?? "Continuar"}
        {!loading && <ArrowRight size={14} />}
      </button>
    </div>
  );
}
