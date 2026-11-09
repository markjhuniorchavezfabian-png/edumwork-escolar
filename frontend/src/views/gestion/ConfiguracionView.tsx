import { useEffect, useState } from "react";
import {
  Building2, Clock, MapPin, Save, Loader2, CheckCircle2, School, Mail, AlertTriangle,
  Database, Download, Upload, ShieldAlert, Puzzle, Info, BookOpen, Landmark, FileText,
} from "lucide-react";
import { MODULOS_OPCIONALES, moduloActivo } from "../../lib/modulos";
import {
  getConfig, patchConfig, descargarBackup, restaurarBackup,
  type ConfigInstitucional,
} from "../../services/onboarding";
import { cn } from "../../lib/utils";
import { useInstitucion } from "../../context/InstitucionContext";

type SecId = "datos" | "horarios" | "geoloc" | "email" | "notas" | "finanzas" | "modulos" | "backup";

const SECCIONES: { id: SecId; label: string; icon: typeof Building2; desc: string }[] = [
  { id: "datos",    label: "Datos institucionales", icon: Building2, desc: "Nombre, código modular, dirección, UGEL, DRE" },
  { id: "horarios", label: "Horarios y tolerancia", icon: Clock,     desc: "Hora tope de entrada para personal y estudiantes" },
  { id: "geoloc",   label: "Geolocalización",       icon: MapPin,    desc: "Ubicación GPS del colegio y radio de asistencia" },
  { id: "email",    label: "Envío de correos",      icon: Mail,      desc: "SMTP para reset, alertas y notificaciones" },
  { id: "notas",    label: "Notas y calificación",  icon: BookOpen,  desc: "Escala de notas: letras AD/A/B/C o numérica 0-20" },
  { id: "finanzas", label: "Facturación y cobranzas", icon: Landmark, desc: "Bloqueo por deuda, emisión SUNAT PSE y cuentas bancarias" },
  { id: "modulos",  label: "Módulos activos",       icon: Puzzle,    desc: "Prender o apagar módulos según lo que usa tu I.E." },
  { id: "backup",   label: "Backup y restauración", icon: Database,  desc: "Descarga una copia de seguridad o restaura una anterior" },
];

const CFG_VACIO: ConfigInstitucional = {
  nombre_institucion: "", sigla: "", codigo_modular: "", direccion: "", ugel: "", dre: "",
  email_institucional: "",
  hora_tope_entrada_personal: "", hora_tope_entrada_estudiantes: "",
  tolerancia_minutos: 10,
  latitud_ie: "", longitud_ie: "", radio_permitido_metros: 100,
  exigir_geolocalizacion: false,
  modulos_activos: [],
  escala_calificacion: "letras",
  plantilla_informe: "",
  anio_lectivo_activo: new Date().getFullYear(),
  smtp_host: "", smtp_port: 587, smtp_user: "",
  smtp_password: "", smtp_use_tls: true, smtp_from_email: "",
  smtp_configurado: false,
  email_comunicados_habilitado: false,
  primer_anio_lectivo: new Date().getFullYear(),
  bloquear_boleta_por_deuda: false,
  max_cuotas_vencidas_bloqueo: 1,
  facturacion_sunat_habilitada: false,
  sunat_api_url: "",
  sunat_api_token: "",
  sunat_serie_boleta: "B001",
  sunat_serie_factura: "F001",
  cuenta_recaudacion_bcp: "",
  cuenta_recaudacion_bbva: "",
};

export default function ConfiguracionView() {
  const [cfg, setCfg] = useState<ConfigInstitucional>(CFG_VACIO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [sec, setSec] = useState<SecId>("datos");

  useEffect(() => {
    getConfig()
      .then(setCfg)
      .catch(() => setErr("No se pudo cargar la configuración."))
      .finally(() => setLoading(false));
  }, []);

  async function guardar(patch: Partial<ConfigInstitucional>) {
    setErr(""); setOk(false); setSaving(true);
    try {
      const nuevo = await patchConfig(patch);
      setCfg(nuevo);
      setOk(true);
      setTimeout(() => setOk(false), 3000);
    } catch {
      setErr("No se pudo guardar. Verifica que estás autenticado como director/admin_tic.");
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <School size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuración institucional</h1>
          <p className="text-sm text-muted-foreground">
            Ajusta los datos del colegio, horarios y geolocalización usados por asistencia y boletas.
          </p>
        </div>
      </div>

      {/* Grid: sidebar tabs + contenido */}
      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar secciones */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto">
          {SECCIONES.map((s) => {
            const activo = sec === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSec(s.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors shrink-0",
                  activo
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <s.icon size={16} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="hidden lg:block text-[11px] text-muted-foreground/80 leading-tight mt-0.5">
                    {s.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card space-y-6">
          {sec === "datos" && (
            <SeccionDatos cfg={cfg} onSave={guardar} saving={saving} />
          )}
          {sec === "horarios" && (
            <SeccionHorarios cfg={cfg} onSave={guardar} saving={saving} />
          )}
          {sec === "geoloc" && (
            <SeccionGeoloc cfg={cfg} onSave={guardar} saving={saving} />
          )}
          {sec === "email" && (
            <SeccionEmail cfg={cfg} onSave={guardar} saving={saving} />
          )}
          {sec === "notas" && (
            <SeccionNotas cfg={cfg} onSave={guardar} saving={saving} />
          )}
          {sec === "finanzas" && (
            <SeccionFinanzas cfg={cfg} onSave={guardar} saving={saving} />
          )}
          {sec === "modulos" && (
            <SeccionModulos cfg={cfg} onSave={guardar} saving={saving} />
          )}
          {sec === "backup" && (
            <SeccionBackup />
          )}

          {ok && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={16} /> Cambios guardados.
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ SECCIÓN DATOS ═══ */
function SeccionDatos({ cfg, onSave, saving }: {
  cfg: ConfigInstitucional;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const institucion = useInstitucion();
  const [f, setF] = useState({
    nombre_institucion: cfg.nombre_institucion,
    sigla: cfg.sigla,
    codigo_modular: cfg.codigo_modular,
    direccion: cfg.direccion,
    ugel: cfg.ugel,
    dre: cfg.dre,
    email_institucional: cfg.email_institucional,
  });
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(institucion.logo_url);

  async function subirLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoLogo(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const { default: api } = await import("../../services/api");
      const { data } = await api.post<{ logo_url: string }>("/core/logo/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLogoUrl(data.logo_url);
      window.location.reload();
    } catch { alert("Error al subir logo."); }
    finally { setSubiendoLogo(false); }
  }

  async function quitarLogo() {
    const { default: api } = await import("../../services/api");
    await api.delete("/core/logo/");
    setLogoUrl(null);
    window.location.reload();
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Datos institucionales</h2>
        <p className="text-sm text-muted-foreground">Aparecen en la cabecera del sistema, boletas y comunicados.</p>
      </div>

      {/* Logo institucional */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-muted/20">
        <div className="w-16 h-16 rounded-lg border border-border/60 bg-background flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground">{institucion.sigla || "IE"}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold mb-1">Logo institucional</div>
          <div className="text-xs text-muted-foreground mb-2">PNG o JPG, máx 2 MB. Se muestra en sidebar, login y boletas.</div>
          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
              {subiendoLogo ? "Subiendo..." : "Cambiar logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={subirLogo} disabled={subiendoLogo} />
            </label>
            {logoUrl && (
              <button onClick={quitarLogo} className="h-8 px-3 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/5">
                Quitar logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Campo label="Nombre completo" span={2}
          value={f.nombre_institucion}
          onChange={(v) => setF({ ...f, nombre_institucion: v })}
          placeholder="I.E. Nombre de tu institución" />
        <Campo label="Sigla (opcional)"
          value={f.sigla}
          onChange={(v) => setF({ ...f, sigla: v.toUpperCase() })}
          placeholder="INS"
          hint="Si la dejas vacía se genera automáticamente desde el nombre." />
        <Campo label="Email institucional" type="email"
          value={f.email_institucional}
          onChange={(v) => setF({ ...f, email_institucional: v })}
          placeholder="sistema@tucolegio.edu.pe"
          hint="Se usa como remitente de notificaciones y contacto visible." />
        <Campo label="Código modular"
          value={f.codigo_modular}
          onChange={(v) => setF({ ...f, codigo_modular: v })}
          placeholder="0712885" />
        <Campo label="Dirección"
          value={f.direccion}
          onChange={(v) => setF({ ...f, direccion: v })}
          placeholder="Av. ..." />
        <Campo label="UGEL"
          value={f.ugel}
          onChange={(v) => setF({ ...f, ugel: v })}
          placeholder="UGEL Huánuco" />
        <Campo label="DRE"
          value={f.dre}
          onChange={(v) => setF({ ...f, dre: v })}
          placeholder="DRE Huánuco" />
      </div>
      <BotonGuardar onClick={() => onSave(f)} saving={saving} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════ SECCIÓN HORARIOS ═══ */
function SeccionHorarios({ cfg, onSave, saving }: {
  cfg: ConfigInstitucional;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    hora_tope_entrada_personal: cfg.hora_tope_entrada_personal,
    hora_tope_entrada_estudiantes: cfg.hora_tope_entrada_estudiantes,
    tolerancia_minutos: cfg.tolerancia_minutos,
  });

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Horarios y tolerancia</h2>
        <p className="text-sm text-muted-foreground">
          Después del horario tope + tolerancia se marca automáticamente como tardanza.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Campo label="Hora tope entrada — Personal (docentes, staff)"
          type="time"
          value={f.hora_tope_entrada_personal}
          onChange={(v) => setF({ ...f, hora_tope_entrada_personal: v })} />
        <Campo label="Hora tope entrada — Estudiantes"
          type="time"
          value={f.hora_tope_entrada_estudiantes}
          onChange={(v) => setF({ ...f, hora_tope_entrada_estudiantes: v })} />
        <Campo label="Tolerancia (minutos)"
          type="number"
          value={String(f.tolerancia_minutos)}
          onChange={(v) => setF({ ...f, tolerancia_minutos: parseInt(v || "0", 10) })}
          placeholder="10" />
      </div>
      <BotonGuardar onClick={() => onSave(f)} saving={saving} />
    </>
  );
}

/* ════════════════════════════════════════════════════════ SECCIÓN GEOLOC ════ */
function SeccionGeoloc({ cfg, onSave, saving }: {
  cfg: ConfigInstitucional;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    exigir_geolocalizacion: cfg.exigir_geolocalizacion,
    latitud_ie: cfg.latitud_ie,
    longitud_ie: cfg.longitud_ie,
    radio_permitido_metros: cfg.radio_permitido_metros,
  });
  const [pidiendo, setPidiendo] = useState(false);

  function pedirUbicacion() {
    if (!navigator.geolocation) return;
    setPidiendo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setF({
          ...f,
          latitud_ie: pos.coords.latitude.toFixed(6),
          longitud_ie: pos.coords.longitude.toFixed(6),
        });
        setPidiendo(false);
      },
      () => { setPidiendo(false); alert("No se pudo obtener la ubicación del navegador."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Geolocalización de asistencia personal</h2>
        <p className="text-sm text-muted-foreground">
          Control de perímetro GPS para la marcación laboral de asistencia del personal. La toma de asistencia de estudiantes en aula y por escáner QR queda exenta de esta regla.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border p-4 cursor-pointer hover:bg-muted/50">
        <input
          type="checkbox"
          checked={f.exigir_geolocalizacion}
          onChange={(e) => setF({ ...f, exigir_geolocalizacion: e.target.checked })}
          className="mt-0.5 w-4 h-4 accent-primary"
        />
        <div>
          <div className="text-sm font-medium">Exigir verificación GPS al personal</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Si está activado, el personal debe autorizar su ubicación para marcar entrada. Si está desactivado, pueden marcar registrándose como excepción justificada en caso de falla de señal.
          </div>
        </div>
      </label>

      {f.exigir_geolocalizacion && (!f.latitud_ie || !f.longitud_ie) && (
        <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
          ⚠️ <strong>Atención:</strong> Las coordenadas de la I.E. están vacías. Debes definir o capturar la latitud y longitud del colegio para que el radio de asistencia funcione sin rechazar marcas válidas.
        </div>
      )}

      <div className={cn(
        "grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity",
        !f.exigir_geolocalizacion && "opacity-75"
      )}>
        <Campo label="Latitud"
          value={f.latitud_ie}
          onChange={(v) => setF({ ...f, latitud_ie: v })}
          placeholder="-9.9306" />
        <Campo label="Longitud"
          value={f.longitud_ie}
          onChange={(v) => setF({ ...f, longitud_ie: v })}
          placeholder="-76.2422" />
        <Campo label="Radio permitido (metros)"
          type="number"
          value={String(f.radio_permitido_metros)}
          onChange={(v) => setF({ ...f, radio_permitido_metros: parseInt(v || "0", 10) })}
          placeholder="150" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={pedirUbicacion}
          disabled={pidiendo}
          className="h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-2"
        >
          {pidiendo ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          Capturar ubicación de la I.E. desde este equipo
        </button>
        {f.latitud_ie && f.longitud_ie && (
          <a
            href={`https://www.google.com/maps?q=${f.latitud_ie},${f.longitud_ie}`}
            target="_blank" rel="noopener noreferrer"
            className="h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted flex items-center gap-2"
          >
            Ver en Google Maps →
          </a>
        )}
      </div>

      <BotonGuardar onClick={() => onSave(f)} saving={saving} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════ SECCIÓN EMAIL ═══ */
function SeccionEmail({ cfg, onSave, saving }: {
  cfg: ConfigInstitucional;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    smtp_host: cfg.smtp_host ?? "",
    smtp_port: cfg.smtp_port ?? 587,
    smtp_user: cfg.smtp_user ?? "",
    smtp_password: "",            // siempre vacío — el usuario escribe si quiere cambiarla
    smtp_use_tls: cfg.smtp_use_tls ?? true,
    smtp_from_email: cfg.smtp_from_email ?? "",
    email_comunicados_habilitado: cfg.email_comunicados_habilitado ?? false,
  });
  const [enviando, setEnviando] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const configurado = cfg.smtp_configurado;

  async function enviarPrueba() {
    setEnviando(true); setTestMsg(null);
    try {
      const { data } = await import("../../services/api").then(m => m.default.post("/core/email-test/"));
      setTestMsg({ ok: true, texto: (data as { mensaje: string }).mensaje });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setTestMsg({ ok: false, texto: err.response?.data?.error ?? "Error al enviar correo de prueba." });
    } finally { setEnviando(false); }
  }

  function guardar() {
    const patch: Partial<ConfigInstitucional> = {
      smtp_host: f.smtp_host,
      smtp_port: f.smtp_port,
      smtp_user: f.smtp_user,
      smtp_use_tls: f.smtp_use_tls,
      smtp_from_email: f.smtp_from_email,
      email_comunicados_habilitado: f.email_comunicados_habilitado,
    };
    if (f.smtp_password) patch.smtp_password = f.smtp_password; // solo enviar si cambió
    onSave(patch);
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Envío de correos (SMTP)</h2>
        <p className="text-sm text-muted-foreground">
          Para reset de contraseñas, alertas de convivencia y notificaciones a padres.
        </p>
      </div>

      {/* Badge de estado */}
      <div className={cn(
        "rounded-lg border p-3 flex items-center gap-2 text-sm font-semibold",
        configurado
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
          : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
      )}>
        {configurado ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        {configurado ? "SMTP configurado — los correos se enviarán." : "SMTP no configurado — completa los datos abajo."}
      </div>

      {/* Formulario SMTP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Campo label="Servidor SMTP" span={2}
          value={f.smtp_host}
          onChange={(v) => setF({ ...f, smtp_host: v })}
          placeholder="smtp.gmail.com" />
        <Campo label="Puerto"
          type="number"
          value={String(f.smtp_port)}
          onChange={(v) => setF({ ...f, smtp_port: Number(v) })}
          placeholder="587" />
        <div className="space-y-1.5 flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={f.smtp_use_tls}
              onChange={(e) => setF({ ...f, smtp_use_tls: e.target.checked })}
              className="w-4 h-4 accent-primary" />
            <span className="text-sm font-medium">Usar TLS (recomendado)</span>
          </label>
        </div>
        <Campo label="Usuario / correo"
          value={f.smtp_user}
          onChange={(v) => setF({ ...f, smtp_user: v })}
          placeholder="sistema@micolegio.edu.pe" />
        <div className="space-y-1.5">
          <label className="text-xs font-medium">
            Contraseña {configurado && <span className="text-muted-foreground">(dejar vacío = no cambiar)</span>}
          </label>
          <input type="password" value={f.smtp_password}
            onChange={(e) => setF({ ...f, smtp_password: e.target.value })}
            placeholder={configurado ? "••••••••" : "Contraseña o app-password"}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <Campo label="Correo remitente (From:)" span={2}
          value={f.smtp_from_email}
          onChange={(v) => setF({ ...f, smtp_from_email: v })}
          placeholder="sistema@micolegio.edu.pe" />
      </div>

      <div className="rounded-md bg-muted/50 border border-border/60 p-3 text-xs text-muted-foreground space-y-1">
        <div><strong className="text-foreground">Proveedores gratuitos:</strong></div>
        <div>• <strong>Gmail:</strong> usar <em>contraseña de aplicación</em> (no la contraseña normal) · smtp.gmail.com:587</div>
        <div>• <strong>Resend.com:</strong> 3,000 emails/mes gratis · smtp.resend.com:587</div>
        <div>• <strong>Brevo:</strong> 300 emails/día gratis · smtp-relay.brevo.com:587</div>
      </div>

      {/* ── Cuándo enviar emails ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">¿Cuándo enviar emails?</h3>
        <p className="text-xs text-muted-foreground">
          Controla qué eventos generan un correo para ahorrar cuota SMTP.
          Las <strong>emergencias</strong> siempre envían email, ignorando este ajuste.
        </p>

        {/* Reset de contraseña — siempre */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs">
            <div className="font-semibold text-foreground">Reset de contraseña</div>
            <div className="text-muted-foreground">Siempre activo — el usuario no puede recuperar su cuenta sin esto.</div>
          </div>
        </div>

        {/* SíseVe — siempre */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs">
            <div className="font-semibold text-foreground">Alertas SíseVe / Convivencia</div>
            <div className="text-muted-foreground">Siempre activo — plazo legal MINEDU de 7 días.</div>
          </div>
        </div>

        {/* Comunicados — configurable */}
        <label className="flex items-start gap-3 p-3 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/50 transition-colors">
          <input type="checkbox"
            checked={f.email_comunicados_habilitado}
            onChange={(e) => setF({ ...f, email_comunicados_habilitado: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-primary"
          />
          <div className="text-xs">
            <div className="font-semibold text-foreground">Enviar email cuando se publica un comunicado</div>
            <div className="text-muted-foreground mt-0.5">
              Desactivado por defecto para ahorrar cuota. Solo se envía a quienes tienen email registrado
              y no desactivaron las notificaciones de comunicados.
              <br/><span className="text-amber-600">⚠ En colegios con 200+ usuarios puede consumir mucha cuota de Gmail/Resend.</span>
            </div>
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={guardar} disabled={saving}
          className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Guardando..." : "Guardar configuración SMTP"}
        </button>
        {configurado && (
          <button onClick={enviarPrueba} disabled={enviando}
            className="h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-2">
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            {enviando ? "Enviando..." : "Enviar correo de prueba"}
          </button>
        )}
        {testMsg && (
          <span className={`text-xs ${testMsg.ok ? "text-emerald-700" : "text-destructive"}`}>
            {testMsg.texto}
          </span>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════ SECCIÓN MÓDULOS ═══ */
/* ══════════════ BOTÓN ABRIR AÑO ════════════════════════════════════════ */
function AbrirAnioButton({ anioActual, onSave, saving }: {
  anioActual: number;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const anioNuevo = anioActual + 1;
  const mes = new Date().getMonth() + 1; // 1-12
  const enVentana = mes === 12 || mes === 1 || mes === 2; // dic, ene, feb

  if (!enVentana) {
    return (
      <div className="text-xs text-muted-foreground italic" title="Solo disponible en diciembre, enero o febrero">
        Disponible en dic — feb
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="space-y-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 max-w-xs">
        <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">
          ¿Abrir año {anioNuevo}?
        </div>
        <div className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
          Los docentes empezarán a ver {anioNuevo} como año activo inmediatamente.
          Las notas de {anioActual} quedan intactas.
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { onSave({ anio_lectivo_activo: anioNuevo }); setConfirmando(false); setTimeout(() => window.location.reload(), 800); }}
            disabled={saving}
            className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Abriendo..." : `Confirmar — abrir ${anioNuevo}`}
          </button>
          <button onClick={() => setConfirmando(false)}
            className="h-7 px-2 rounded-md border border-border text-xs hover:bg-muted">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted flex items-center gap-1.5"
      title={`Cerrar ${anioActual} y abrir ${anioNuevo} — solo disponible en diciembre, enero o febrero`}
    >
      Abrir {anioNuevo} →
    </button>
  );
}

function SeccionModulos({ cfg, onSave, saving }: {
  cfg: ConfigInstitucional;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const [activos, setActivos] = useState<string[]>(
    cfg.modulos_activos.length ? cfg.modulos_activos : MODULOS_OPCIONALES.map((m) => m.id)
  );

  function toggle(id: string) {
    setActivos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Módulos activos</h2>
        <p className="text-sm text-muted-foreground">
          Prende o apaga los módulos según lo que use tu institución. Los que estén apagados
          desaparecen del menú lateral y no molestan a los usuarios.
        </p>
      </div>

      <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 flex items-start gap-2 text-xs text-blue-900 dark:text-blue-100">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div>
          <strong>Módulos core siempre activos:</strong> Usuarios, Secciones, Estudiantes, Docentes,
          Asistencia, Notas, Comunicados, Incidencias, Justificaciones. Estos no se pueden desactivar
          porque son la base del sistema.
        </div>
      </div>

      <div className="grid gap-2">
        {MODULOS_OPCIONALES.map((m) => {
          const on = moduloActivo(activos, m.id);
          return (
            <label
              key={m.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                on
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-border/60 opacity-70 hover:opacity-100"
              )}
            >
              {/* Switch */}
              <div className={cn(
                "relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5",
                on ? "bg-primary" : "bg-muted-foreground/30"
              )}>
                <div className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                  on ? "left-5" : "left-0.5"
                )} />
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(m.id)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.descripcion}</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                  rutas: {m.rutas.join(", ")}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border">
        <button
          onClick={() => onSave({ modulos_activos: activos })}
          disabled={saving}
          className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Guardando..." : "Guardar módulos"}
        </button>
        <p className="text-[11px] text-muted-foreground mt-2 flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>Los cambios se ven al recargar la página (F5). Los datos existentes de los módulos
          apagados NO se borran — solo se ocultan del menú.</span>
        </p>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════ SECCIÓN NOTAS ════ */
const PLANTILLA_DEFAULT = `Eres un especialista pedagógico del MINEDU con experiencia en análisis de resultados de aprendizaje en instituciones educativas públicas peruanas.

Tu tarea es redactar un informe pedagógico breve, claro y práctico a partir de datos de calificaciones por niveles de logro (AD/A/B/C) según la escala RVM 094-2020-MINEDU.

El informe debe:
1. Describir brevemente el panorama general de logros de la sección.
2. Identificar fortalezas por área (qué áreas tienen más AD/A).
3. Señalar áreas o competencias con mayor porcentaje en B/C (requieren atención).
4. Dar 2-3 recomendaciones pedagógicas concretas y accionables para el docente.
5. Usar lenguaje formal, directo, sin jerga ni relleno.

Estructura de salida en Markdown con estos encabezados:
## Panorama general
## Fortalezas
## Áreas de mejora
## Recomendaciones

Máximo 350 palabras. No uses emojis. Lenguaje español formal peruano.`;

function SeccionNotas({ cfg, onSave, saving }: {
  cfg: ConfigInstitucional;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const [escala, setEscala] = useState<"letras" | "numerica">(cfg.escala_calificacion ?? "letras");
  const [plantilla, setPlantilla] = useState(cfg.plantilla_informe ?? "");
  const [primerAnio, setPrimerAnio] = useState(cfg.primer_anio_lectivo ?? new Date().getFullYear());

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Notas y calificación</h2>
        <p className="text-sm text-muted-foreground">
          Define cómo los docentes ingresan las notas. En ambos casos, el export SIAGIE usa la escala oficial AD/A/B/C.
        </p>
      </div>

      {/* Años del sistema */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">

        {/* Año activo — solo informativo, no editable */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-semibold">Año lectivo activo</div>
            <div className="text-xs text-muted-foreground">
              Docentes trabajan en este año. Para abrir el siguiente, usa el botón.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">{cfg.anio_lectivo_activo || new Date().getFullYear()}</span>
            <AbrirAnioButton
              anioActual={cfg.anio_lectivo_activo || new Date().getFullYear()}
              onSave={onSave}
              saving={saving}
            />
          </div>
        </div>

        <div className="border-t border-primary/20 pt-3">
          <div className="text-sm font-semibold mb-1">Primer año con datos</div>
          <div className="text-xs text-muted-foreground mb-2">
            Define desde cuándo hay registros en el sistema.
            El selector histórico en Gestión de Notas e Informes mostrará desde este año.
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="number"
              min={2010}
              max={cfg.anio_lectivo_activo || new Date().getFullYear()}
              value={primerAnio}
              onChange={(e) => setPrimerAnio(Number(e.target.value))}
              className="w-24 h-9 px-3 rounded-md border border-input bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">
              → rango disponible: {primerAnio} — {cfg.anio_lectivo_activo || new Date().getFullYear()}
              {((cfg.anio_lectivo_activo || new Date().getFullYear()) - primerAnio + 1) >= 5 ? (
                <span className="ml-1 text-emerald-600 font-medium">✓ Cubre 5 años para certificados</span>
              ) : (
                <span className="ml-1 text-amber-600"> ({(cfg.anio_lectivo_activo || new Date().getFullYear()) - primerAnio + 1} años)</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {(["letras", "numerica"] as const).map((op) => {
          const sel = escala === op;
          return (
            <label
              key={op}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                sel ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/50"
              )}
            >
              <input
                type="radio"
                name="escala"
                value={op}
                checked={sel}
                onChange={() => setEscala(op)}
                className="mt-0.5 w-4 h-4 accent-primary"
              />
              <div>
                <div className="text-sm font-semibold">
                  {op === "letras" ? "Letras AD / A / B / C (MINEDU — recomendado)" : "Numérica 0 – 20"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {op === "letras"
                    ? "El docente elige directamente AD, A, B o C. Válido para inicial, primaria y secundaria."
                    : "El docente ingresa un número del 0 al 20. El sistema lo convierte a AD/A/B/C al guardar y al exportar SIAGIE. Tabla: 18-20=AD, 14-17=A, 11-13=B, 0-10=C."}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 flex items-start gap-2 text-xs text-blue-900 dark:text-blue-100">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div>
          El SIAGIE siempre recibe letras. Si usas escala numérica, la conversión es automática.
          Puedes cambiar esta opción en cualquier momento — las notas ya guardadas no se borran.
        </div>
      </div>

      {/* Separador — plantilla de informes */}
      <div className="pt-4 border-t border-border">
        <h3 className="text-base font-semibold mb-1">Plantilla de informes pedagógicos (IA)</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Prompt del sistema que usa la IA al generar informes. Si está vacío, se usa el estándar institucional.
          Puedes personalizar el tono, secciones o énfasis según las necesidades de tu colegio.
        </p>
        <textarea
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          rows={10}
          placeholder={PLANTILLA_DEFAULT}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
        <div className="flex items-center gap-3 mt-2">
          {plantilla && (
            <button
              type="button"
              onClick={() => setPlantilla("")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Restaurar plantilla estándar
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {plantilla ? `${plantilla.length} caracteres personalizados` : "Usando plantilla estándar"}
          </span>
        </div>
      </div>

      <BotonGuardar
        onClick={() => {
          onSave({ escala_calificacion: escala, plantilla_informe: plantilla, primer_anio_lectivo: primerAnio });
          // Recargar para actualizar InstitucionContext con el nuevo primer_anio_lectivo
          setTimeout(() => window.location.reload(), 800);
        }}
        saving={saving}
      />
    </>
  );
}

/* ═════════════════════════════════════════════════════════ SECCIÓN BACKUP ══ */
function SeccionBackup() {
  const [descargando, setDescargando] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [confirmTexto, setConfirmTexto] = useState("");
  const [restaurando, setRestaurando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  async function descargar() {
    setDescargando(true); setMsg(null);
    try {
      await descargarBackup();
      setMsg({ tipo: "ok", texto: "Backup descargado. Guardalo en un lugar seguro." });
    } catch {
      setMsg({ tipo: "err", texto: "No se pudo generar el backup. Revisa que sos director/admin_tic." });
    } finally { setDescargando(false); }
  }

  async function restaurar() {
    if (!archivo) return;
    if (confirmTexto !== "BORRAR TODO") return;
    setRestaurando(true); setMsg(null);
    try {
      const r = await restaurarBackup(archivo, "SI_BORRAR_TODO");
      if (r.ok) {
        setMsg({ tipo: "ok", texto: r.mensaje ?? "Backup restaurado. Recargando..." });
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setMsg({ tipo: "err", texto: r.error ?? "Restauración falló." });
      }
    } catch (e: unknown) {
      const ee = e as { response?: { data?: { error?: string } } };
      setMsg({ tipo: "err", texto: ee.response?.data?.error ?? "Error al restaurar." });
    } finally { setRestaurando(false); }
  }

  return (
    <>
      <div>
        <h2 className="text-lg font-semibold">Backup y restauración</h2>
        <p className="text-sm text-muted-foreground">
          Descarga una copia de seguridad completa (BD + estructura) o restaura una copia anterior.
        </p>
      </div>

      {/* Backup */}
      <div className="rounded-xl border border-border p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Download size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Descargar copia de seguridad</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Genera un archivo <code className="text-[11px] bg-muted px-1 rounded">.sql.gz</code> con
              toda la base de datos. Guardalo en tu computadora, disco externo, Google Drive, etc.
            </p>
          </div>
        </div>
        <button
          onClick={descargar}
          disabled={descargando}
          className="h-10 px-5 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
        >
          {descargando
            ? <><Loader2 size={14} className="animate-spin" /> Generando...</>
            : <><Download size={14} /> Descargar ahora</>}
        </button>
        <p className="text-[11px] text-muted-foreground">
          <Info size={11} className="inline align-text-bottom" /> <strong>Recomendado:</strong> descárgalo 1 vez por semana como mínimo. Un backup semanal
          + backups automáticos del servidor te protegen ante cualquier problema.
        </p>
      </div>

      {/* Restore */}
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Restaurar desde un backup</h3>
            <p className="text-xs text-muted-foreground mt-1">
              <strong className="text-rose-700 dark:text-rose-400">Operación destructiva:</strong>{" "}
              reemplaza TODA la base de datos actual por la del archivo. Todos los datos posteriores al backup se perderán.
            </p>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium">Archivo de backup (.sql o .sql.gz)</span>
          <input
            type="file"
            accept=".sql,.gz"
            onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setConfirmTexto(""); setMsg(null); }}
            className="mt-1 block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-rose-500 file:text-white file:text-xs file:font-medium hover:file:bg-rose-600"
          />
        </label>

        {archivo && (
          <>
            <div className="rounded-md bg-rose-500/10 border border-rose-500/40 p-3 text-xs text-rose-900 dark:text-rose-100">
              Vas a restaurar <strong>{archivo.name}</strong> ({(archivo.size / 1024).toFixed(1)} KB).
              Todo lo que hayas agregado después del backup se perderá.
            </div>
            <label className="block">
              <span className="text-xs font-medium">Para confirmar, escribe <code className="bg-muted px-1 rounded">BORRAR TODO</code>:</span>
              <input
                type="text"
                value={confirmTexto}
                onChange={(e) => setConfirmTexto(e.target.value)}
                placeholder="BORRAR TODO"
                className="mt-1 w-full h-10 px-3 rounded-md border border-rose-500/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
            </label>

            <button
              onClick={restaurar}
              disabled={confirmTexto !== "BORRAR TODO" || restaurando}
              className="h-10 px-5 rounded-md bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
            >
              {restaurando
                ? <><Loader2 size={14} className="animate-spin" /> Restaurando...</>
                : <><Upload size={14} /> Restaurar (destructivo)</>}
            </button>
          </>
        )}
      </div>

      {msg && (
        <div className={cn(
          "rounded-md border p-3 text-xs",
          msg.tipo === "ok"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            : "border-destructive/40 bg-destructive/10 text-destructive"
        )}>
          {msg.texto}
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground inline-flex items-center gap-1.5"><Save size={12} /> Recomendación de estrategia:</strong>
        <ul className="mt-1 list-disc pl-5 space-y-0.5">
          <li>1 backup manual semanal (aquí) → subilo a Google Drive</li>
          <li>Backup automático diario del servidor VPS (viene con la instalación)</li>
          <li>1 backup mensual grabado en USB físico → guardar en la dirección</li>
        </ul>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════ SECCIÓN FINANZAS ═══ */
function SeccionFinanzas({ cfg, onSave, saving }: {
  cfg: ConfigInstitucional;
  onSave: (patch: Partial<ConfigInstitucional>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState({
    bloquear_boleta_por_deuda: cfg.bloquear_boleta_por_deuda ?? false,
    max_cuotas_vencidas_bloqueo: cfg.max_cuotas_vencidas_bloqueo ?? 1,
    facturacion_sunat_habilitada: cfg.facturacion_sunat_habilitada ?? false,
    sunat_api_url: cfg.sunat_api_url ?? "",
    sunat_api_token: cfg.sunat_api_token ?? "",
    sunat_serie_boleta: cfg.sunat_serie_boleta ?? "B001",
    sunat_serie_factura: cfg.sunat_serie_factura ?? "F001",
    cuenta_recaudacion_bcp: cfg.cuenta_recaudacion_bcp ?? "",
    cuenta_recaudacion_bbva: cfg.cuenta_recaudacion_bbva ?? "",
  });

  return (
    <div className="space-y-6">
      {/* Nivel 1: Cobranzas y Bloqueo de Boletas */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert size={16} className="text-primary" /> Control de Morosidad y Libreta de Notas (Nivel 1)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configuración del bloqueo condicional de descarga de boletas a familias con deudas impagas.
          </p>
        </div>

        <div className="rounded-xl border border-border/70 p-4 space-y-4 bg-muted/20">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={f.bloquear_boleta_por_deuda}
              onChange={(e) => setF({ ...f, bloquear_boleta_por_deuda: e.target.checked })}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-foreground">Restringir descarga de boletas a deudores</span>
              <p className="text-xs text-muted-foreground">
                Si está activo, los padres con pensiones vencidas no podrán descargar las boletas en PDF hasta regularizar sus pagos.
              </p>
            </div>
          </label>

          {f.bloquear_boleta_por_deuda && (
            <div className="max-w-xs pl-7">
              <Campo
                label="Cuotas vencidas mínimas para bloqueo"
                type="number"
                value={String(f.max_cuotas_vencidas_bloqueo)}
                onChange={(v) => setF({ ...f, max_cuotas_vencidas_bloqueo: parseInt(v) || 1 })}
                hint="Por ejemplo: 1 para bloquear desde la primera cuota vencida, o 2 para dar un mes de gracia."
              />
            </div>
          )}
        </div>
      </div>

      {/* Nivel 2: Facturación Electrónica SUNAT / PSE */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Facturación Electrónica SUNAT / PSE (Nivel 2)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Integración con Proveedor de Servicios Electrónicos (PSE tipo Nubefact o Facturador.pro). Operación inafecta al IGV (Código 30 - Ley General de Educación).
          </p>
        </div>

        <div className="rounded-xl border border-border/70 p-4 space-y-4 bg-muted/20">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={f.facturacion_sunat_habilitada}
              onChange={(e) => setF({ ...f, facturacion_sunat_habilitada: e.target.checked })}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-foreground">Activar emisión electrónica a SUNAT</span>
              <p className="text-xs text-muted-foreground">
                Envía automáticamente el comprobante electrónico al PSE al registrar o validar cada pago.
              </p>
            </div>
          </label>

          {f.facturacion_sunat_habilitada && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7 pt-2">
              <Campo
                label="URL del API PSE (Nubefact / Facturador.pro)"
                placeholder="https://api.nubefact.com/api/v1/..."
                value={f.sunat_api_url}
                onChange={(v) => setF({ ...f, sunat_api_url: v })}
                span={2}
                hint="Endpoint provisto por su PSE para la emisión de documentos JSON."
              />
              <Campo
                label="Token de Autenticación PSE"
                type="password"
                placeholder={cfg.sunat_api_token ? "••••••••" : "Pegar token del PSE"}
                value={f.sunat_api_token}
                onChange={(v) => setF({ ...f, sunat_api_token: v })}
                span={2}
                hint="Bearer token provisto en el portal de su facturador electrónico."
              />
              <Campo
                label="Serie Boletas de Venta"
                placeholder="B001"
                value={f.sunat_serie_boleta}
                onChange={(v) => setF({ ...f, sunat_serie_boleta: v })}
                hint="Serie autorizada para boletas de venta (ej: B001)."
              />
              <Campo
                label="Serie Facturas Electrónicas"
                placeholder="F001"
                value={f.sunat_serie_factura}
                onChange={(v) => setF({ ...f, sunat_serie_factura: v })}
                hint="Serie autorizada para facturas con RUC (ej: F001)."
              />
            </div>
          )}
        </div>
      </div>

      {/* Nivel 3: Cuentas y Recaudación Bancaria */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Landmark size={16} className="text-primary" /> Recaudación Bancaria BCP y BBVA (Nivel 3)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cuentas y códigos de servicio que se imprimen en los recordatorios y se incluyen en los archivos de Telecrédito.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo
            label="Cuenta o Servicio Recaudador BCP"
            placeholder="Ej: 193-9876543-0-12 / Convenio 12345"
            value={f.cuenta_recaudacion_bcp}
            onChange={(v) => setF({ ...f, cuenta_recaudacion_bcp: v })}
            hint="Código de servicio BCP o cuenta corriente para abonos Telecrédito."
          />
          <Campo
            label="Código de Recaudo BBVA Continental"
            placeholder="Ej: 0011-0123-0100012345"
            value={f.cuenta_recaudacion_bbva}
            onChange={(v) => setF({ ...f, cuenta_recaudacion_bbva: v })}
            hint="Número de cuenta recaudadora BBVA para banca por internet y ventanilla."
          />
        </div>
      </div>

      <BotonGuardar onClick={() => onSave(f)} saving={saving} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ HELPERS ════ */
function Campo({ label, value, onChange, placeholder, span, type, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; span?: number; type?: string; hint?: string;
}) {
  return (
    <div className={cn("space-y-1.5", span === 2 && "md:col-span-2")}>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
      />
      {hint && <p className="text-[11px] text-muted-foreground leading-tight">{hint}</p>}
    </div>
  );
}

function BotonGuardar({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <div className="pt-2 border-t border-border">
      <button
        onClick={onClick}
        disabled={saving}
        className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
