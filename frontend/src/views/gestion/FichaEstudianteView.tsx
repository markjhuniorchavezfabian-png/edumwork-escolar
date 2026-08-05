import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/ui/Toast";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import { Cargando, EmptyState } from "../../components/ui/Spinner";
import { useInstitucion } from "../../context/InstitucionContext";
import { parseFecha } from "../../utils/fechas";

function calcularEdad(fechaNac: string): number {
  const hoy = new Date();
  const nac = parseFecha(fechaNac);
  if (!nac) return 0;
  let edad = hoy.getFullYear() - nac.getFullYear();
  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

interface Ficha {
  id: number;
  usuario: number;
  dni: string;
  first_name: string;
  last_name: string;
  email: string;
  telefono: string;
  nombre_completo: string;
  // Académicos
  grado: string;
  seccion: string;
  seccion_obj: number | null;
  seccion_nombre: string;
  codigo_matricula: string;
  situacion_matricula: string;
  fecha_ingreso: string | null;
  colegio_procedencia: string;
  // Personales
  fecha_nacimiento: string | null;
  edad: number | null;
  sexo: string;
  lugar_nacimiento: string;
  nacionalidad: string;
  lengua_materna: string;
  religion: string;
  // Dirección
  direccion: string;
  referencia_direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  // Médicos
  grupo_sanguineo: string;
  alergias: string;
  medicamentos: string;
  condicion_medica: string;
  tiene_seguro: boolean;
  tipo_seguro: string;
  // Emergencia
  contacto_emergencia_nombre: string;
  contacto_emergencia_parentesco: string;
  contacto_emergencia_telefono: string;
  // Socioeconómico
  vive_con: string;
  numero_hermanos: number | null;
  trabaja: boolean;
  tiene_luz: boolean;
  tiene_agua: boolean;
  tiene_internet: boolean;
  // Apoderados
  apoderados_detalle: Array<{
    id: number; usuario_id: number; nombre: string;
    parentesco: string; parentesco_label: string;
    telefono: string; email: string; ocupacion: string;
  }>;
  foto: string | null;
}

const SECCIONES = [
  { id: "academico", label: "Datos académicos", icon: "libro" as const },
  { id: "personal", label: "Datos personales", icon: "usuarios" as const },
  { id: "direccion", label: "Dirección", icon: "casa" as const },
  { id: "medico", label: "Ficha médica", icon: "alerta" as const },
  { id: "emergencia", label: "Contacto de emergencia", icon: "telefono" as const },
  { id: "socioeconomico", label: "Datos socioeconómicos", icon: "grafico" as const },
  { id: "apoderados", label: "Apoderados", icon: "usuarios" as const },
];

export default function FichaEstudianteView() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const institucion = useInstitucion();
  const [descargandoCert, setDescargandoCert] = useState(false);
  const toast = useToast();

  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [datos, setDatos] = useState<Partial<Ficha>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState<Record<string, boolean>>({ academico: true });
  const [modalTraslado, setModalTraslado] = useState(false);
  const [procesandoTraslado, setProcesandoTraslado] = useState(false);

  const puedeEditar = usuario && ["director", "subdirector", "admin_tic", "secretaria", "docente", "padre"].includes(usuario.rol);
  const puedeCertificado = usuario && ["director", "subdirector", "admin_tic", "secretaria"].includes(usuario.rol);
  const puedeTraslado = usuario && ["director", "subdirector", "admin_tic", "secretaria"].includes(usuario.rol);

  async function descargarCertificado() {
    if (!ficha) return;
    const primerAnio = institucion.primer_anio_lectivo || institucion.anio_lectivo_activo || new Date().getFullYear();
    const hastaAnio = institucion.anio_lectivo_activo || new Date().getFullYear();
    setDescargandoCert(true);
    try {
      const { data } = await api.get(
        `/notas/certificado/${id}/?desde_anio=${primerAnio}&hasta_anio=${hastaAnio}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificado_${ficha.nombre_completo?.replace(/\s+/g, "_") ?? id}_${primerAnio}-${hastaAnio}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.ok("Certificado generado.");
    } catch { toast.error("Error al generar certificado."); }
    finally { setDescargandoCert(false); }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get<Ficha>(`/usuarios/fichas-estudiantes/${id}/`);
      setFicha(data);
      setDatos(data);
    } catch {
      setFicha(null);
    } finally { setCargando(false); }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  function toggle(sid: string) {
    setAbierto((a) => ({ ...a, [sid]: !a[sid] }));
  }

  async function guardar() {
    setGuardando(true);
    try {
      const { data } = await api.patch<Ficha>(`/usuarios/fichas-estudiantes/${id}/`, datos);
      setFicha(data);
      setDatos(data);
      toast.ok("Ficha actualizada.");
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data ?? "")}`);
    } finally { setGuardando(false); }
  }

  async function registrarTraslado() {
    if (!ficha) return;
    setProcesandoTraslado(true);
    try {
      await api.patch(`/usuarios/matricula/${ficha.id}/situacion/`, { situacion_matricula: "trasladado" });
      toast.ok("Traslado registrado. El estudiante ya no aparecerá en las grillas activas.");
      setModalTraslado(false);
      await cargar();
    } catch { toast.error("Error al registrar traslado."); }
    finally { setProcesandoTraslado(false); }
  }

  function campo(k: keyof Ficha, val: unknown) {
    setDatos((d) => ({ ...d, [k]: val }));
  }

  if (cargando) return <Cargando />;
  if (!ficha) return <EmptyState icono="alerta" titulo="Estudiante no encontrado" />;

  return (
    <div>
      {/* Cabecera */}
      <div style={{
        background: "linear-gradient(135deg, var(--azul-600), var(--azul-800))",
        color: "white",
        padding: 24,
        borderRadius: 16,
        marginBottom: 20,
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(255,255,255,.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 700,
        }}>
          {ficha.first_name[0]}{ficha.last_name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 250 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 24 }}>{ficha.nombre_completo}</h2>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            {ficha.seccion_nombre}
            {ficha.codigo_matricula && <> · <code style={{ background: "rgba(255,255,255,.15)", padding: "1px 6px", borderRadius: 4 }}>{ficha.codigo_matricula}</code></>}
            {ficha.edad && <> · {ficha.edad} años</>}
          </div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>
            DNI: {ficha.dni || "—"} · {ficha.situacion_matricula.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {puedeCertificado && (
            <button onClick={descargarCertificado} disabled={descargandoCert}
              style={{ background: "rgba(255,255,255,.15)", color: "white", border: "1px solid rgba(255,255,255,.3)",
                       padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                       fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="pdf" size={14} /> {descargandoCert ? "Generando..." : "Certificado de estudios"}
            </button>
          )}
          {puedeTraslado && ficha.situacion_matricula === "matriculado" && (
            <button onClick={() => setModalTraslado(true)}
              style={{ background: "rgba(239,68,68,.15)", color: "white", border: "1px solid rgba(239,68,68,.4)",
                       padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                       fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              Registrar traslado
            </button>
          )}
          {puedeEditar && (
            <button className="btn btn-icono" onClick={guardar} disabled={guardando}
              style={{ background: "var(--bg-panel)", color: "var(--azul-800)", width: "auto", padding: "10px 18px" }}>
              <Icon name="check" /> {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          )}
        </div>
      </div>

      {SECCIONES.map((s) => (
        <Card key={s.id} titulo={
          <button onClick={() => toggle(s.id)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            background: "transparent", border: "none", cursor: "pointer",
            padding: 0, fontSize: "inherit", fontWeight: "inherit", color: "inherit",
          }}>
            <span style={{ display: "inline-block", transform: abierto[s.id] ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}>
              <Icon name="chevron-abajo" size={14} />
            </span>
            <Icon name={s.icon} /> {s.label}
          </button>
        }>
          {abierto[s.id] && <SeccionContenido sid={s.id} datos={datos} setCampo={campo} ficha={ficha} editable={!!puedeEditar} />}
        </Card>
      ))}

      <HistorialNotas estudianteId={Number(id)} />

      {modalTraslado && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "var(--bg-panel)", borderRadius: 12, padding: 28, maxWidth: 420, width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,.3)",
          }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 17, color: "var(--destructive)" }}>Registrar traslado</h3>
            <p style={{ fontSize: 13, color: "var(--texto-mute)", margin: "0 0 8px" }}>
              <strong>{ficha.nombre_completo}</strong> será marcado como <strong>TRASLADADO</strong>.
            </p>
            <p style={{ fontSize: 13, color: "var(--texto-mute)", margin: "0 0 20px" }}>
              Ya no aparecerá en las grillas de notas ni asistencia activas. Las notas y registros históricos se conservan.
              Puedes revertirlo cambiando la situación manualmente en la ficha.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setModalTraslado(false)} disabled={procesandoTraslado}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--borde)", background: "transparent", cursor: "pointer", fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={registrarTraslado} disabled={procesandoTraslado}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--destructive)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {procesandoTraslado ? "Procesando..." : "Confirmar traslado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  sid: string;
  datos: Partial<Ficha>;
  setCampo: (k: keyof Ficha, v: unknown) => void;
  ficha: Ficha;
  editable: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function SeccionContenido({ sid, datos, setCampo, ficha, editable }: Props) {
  const dis = !editable;
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 };

  if (sid === "academico") return (
    <div style={grid}>
      <Field label="Código matrícula">
        <input className="form-input" disabled={dis} value={datos.codigo_matricula ?? ""} onChange={(e) => setCampo("codigo_matricula", e.target.value)} />
      </Field>
      <Field label="Situación">
        <select className="form-input" disabled={dis} value={datos.situacion_matricula ?? ""} onChange={(e) => setCampo("situacion_matricula", e.target.value)}>
          <option value="matriculado">Matriculado</option>
          <option value="retirado">Retirado</option>
          <option value="trasladado">Trasladado</option>
          <option value="egresado">Egresado</option>
          <option value="suspendido">Suspendido</option>
        </select>
      </Field>
      <Field label="Fecha de ingreso a la IE">
        <input type="date" className="form-input" disabled={dis} value={datos.fecha_ingreso ?? ""} onChange={(e) => setCampo("fecha_ingreso", e.target.value)} />
      </Field>
      <Field label="Colegio de procedencia">
        <input className="form-input" disabled={dis} value={datos.colegio_procedencia ?? ""} onChange={(e) => setCampo("colegio_procedencia", e.target.value)} />
      </Field>
    </div>
  );

  if (sid === "personal") return (
    <div style={grid}>
      <Field label="DNI"><input className="form-input" disabled={dis} value={datos.dni ?? ""} onChange={(e) => setCampo("dni" as keyof Ficha, e.target.value)} /></Field>
      <Field label="Nombres"><input className="form-input" disabled={dis} value={datos.first_name ?? ""} onChange={(e) => setCampo("first_name" as keyof Ficha, e.target.value)} /></Field>
      <Field label="Apellidos"><input className="form-input" disabled={dis} value={datos.last_name ?? ""} onChange={(e) => setCampo("last_name" as keyof Ficha, e.target.value)} /></Field>
      <Field label="Fecha nacimiento">
        <input type="date" className="form-input" disabled={dis} value={datos.fecha_nacimiento ?? ""} onChange={(e) => setCampo("fecha_nacimiento", e.target.value)} />
        {datos.fecha_nacimiento && (
          <span style={{ fontSize: 11, color: "var(--texto-mute)", marginTop: 3, display: "block" }}>
            {calcularEdad(datos.fecha_nacimiento)} años
          </span>
        )}
      </Field>
      <Field label="Sexo">
        <select className="form-input" disabled={dis} value={datos.sexo ?? ""} onChange={(e) => setCampo("sexo", e.target.value)}>
          <option value="">—</option><option value="M">Masculino</option><option value="F">Femenino</option>
        </select>
      </Field>
      <Field label="Lugar nacimiento"><input className="form-input" disabled={dis} value={datos.lugar_nacimiento ?? ""} onChange={(e) => setCampo("lugar_nacimiento", e.target.value)} /></Field>
      <Field label="Nacionalidad"><input className="form-input" disabled={dis} value={datos.nacionalidad ?? ""} onChange={(e) => setCampo("nacionalidad", e.target.value)} /></Field>
      <Field label="Lengua materna"><input className="form-input" disabled={dis} value={datos.lengua_materna ?? ""} onChange={(e) => setCampo("lengua_materna", e.target.value)} /></Field>
      <Field label="Religión"><input className="form-input" disabled={dis} value={datos.religion ?? ""} onChange={(e) => setCampo("religion", e.target.value)} /></Field>
      <Field label="Teléfono"><input className="form-input" disabled={dis} value={datos.telefono ?? ""} onChange={(e) => setCampo("telefono" as keyof Ficha, e.target.value)} /></Field>
      <Field label="Email"><input type="email" className="form-input" disabled={dis} value={datos.email ?? ""} onChange={(e) => setCampo("email" as keyof Ficha, e.target.value)} /></Field>
    </div>
  );

  if (sid === "direccion") return (
    <div style={grid}>
      <Field label="Dirección completa"><input className="form-input" disabled={dis} value={datos.direccion ?? ""} onChange={(e) => setCampo("direccion", e.target.value)} /></Field>
      <Field label="Referencia"><input className="form-input" disabled={dis} value={datos.referencia_direccion ?? ""} onChange={(e) => setCampo("referencia_direccion", e.target.value)} /></Field>
      <Field label="Distrito"><input className="form-input" disabled={dis} value={datos.distrito ?? ""} onChange={(e) => setCampo("distrito", e.target.value)} /></Field>
      <Field label="Provincia"><input className="form-input" disabled={dis} value={datos.provincia ?? ""} onChange={(e) => setCampo("provincia", e.target.value)} /></Field>
      <Field label="Departamento"><input className="form-input" disabled={dis} value={datos.departamento ?? ""} onChange={(e) => setCampo("departamento", e.target.value)} /></Field>
    </div>
  );

  if (sid === "medico") return (
    <>
      <div style={grid}>
        <Field label="Grupo sanguíneo">
          <select className="form-input" disabled={dis} value={datos.grupo_sanguineo ?? ""} onChange={(e) => setCampo("grupo_sanguineo", e.target.value)}>
            {["O+","O-","A+","A-","B+","B-","AB+","AB-","NS"].map((g) => <option key={g} value={g}>{g === "NS" ? "No se sabe" : g}</option>)}
          </select>
        </Field>
        <Field label="¿Tiene seguro?">
          <select className="form-input" disabled={dis} value={datos.tiene_seguro ? "1" : "0"} onChange={(e) => setCampo("tiene_seguro", e.target.value === "1")}>
            <option value="0">No</option><option value="1">Sí</option>
          </select>
        </Field>
        <Field label="Tipo de seguro"><input className="form-input" disabled={dis || !datos.tiene_seguro} placeholder="SIS, ESSALUD, EPS..." value={datos.tipo_seguro ?? ""} onChange={(e) => setCampo("tipo_seguro", e.target.value)} /></Field>
      </div>
      <Field label="Alergias conocidas"><textarea className="form-input" rows={2} disabled={dis} value={datos.alergias ?? ""} onChange={(e) => setCampo("alergias", e.target.value)} /></Field>
      <Field label="Medicamentos regulares"><textarea className="form-input" rows={2} disabled={dis} value={datos.medicamentos ?? ""} onChange={(e) => setCampo("medicamentos", e.target.value)} /></Field>
      <Field label="Condición médica / discapacidad"><textarea className="form-input" rows={2} disabled={dis} value={datos.condicion_medica ?? ""} onChange={(e) => setCampo("condicion_medica", e.target.value)} /></Field>
    </>
  );

  if (sid === "emergencia") return (
    <div style={grid}>
      <Field label="Nombre del contacto"><input className="form-input" disabled={dis} value={datos.contacto_emergencia_nombre ?? ""} onChange={(e) => setCampo("contacto_emergencia_nombre", e.target.value)} /></Field>
      <Field label="Parentesco"><input className="form-input" disabled={dis} value={datos.contacto_emergencia_parentesco ?? ""} onChange={(e) => setCampo("contacto_emergencia_parentesco", e.target.value)} /></Field>
      <Field label="Teléfono"><input className="form-input" disabled={dis} value={datos.contacto_emergencia_telefono ?? ""} onChange={(e) => setCampo("contacto_emergencia_telefono", e.target.value)} /></Field>
    </div>
  );

  if (sid === "socioeconomico") return (
    <div style={grid}>
      <Field label="Vive con"><input className="form-input" disabled={dis} placeholder="Ej: Ambos padres" value={datos.vive_con ?? ""} onChange={(e) => setCampo("vive_con", e.target.value)} /></Field>
      <Field label="Número de hermanos"><input type="number" min="0" className="form-input" disabled={dis} value={datos.numero_hermanos ?? ""} onChange={(e) => setCampo("numero_hermanos", e.target.value ? Number(e.target.value) : null)} /></Field>
      <Field label="¿Trabaja?">
        <select className="form-input" disabled={dis} value={datos.trabaja ? "1" : "0"} onChange={(e) => setCampo("trabaja", e.target.value === "1")}>
          <option value="0">No</option><option value="1">Sí</option>
        </select>
      </Field>
      <Field label="Servicios básicos">
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
            <input type="checkbox" disabled={dis} checked={!!datos.tiene_luz} onChange={(e) => setCampo("tiene_luz", e.target.checked)} /> Luz
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
            <input type="checkbox" disabled={dis} checked={!!datos.tiene_agua} onChange={(e) => setCampo("tiene_agua", e.target.checked)} /> Agua
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
            <input type="checkbox" disabled={dis} checked={!!datos.tiene_internet} onChange={(e) => setCampo("tiene_internet", e.target.checked)} /> Internet
          </label>
        </div>
      </Field>
    </div>
  );

  if (sid === "apoderados") return (
    ficha.apoderados_detalle.length === 0 ? (
      <EmptyState icono="usuarios" titulo="Sin apoderados vinculados" descripcion="Podés vincular apoderados desde el módulo de Usuarios." />
    ) : (
      <div style={{ display: "grid", gap: 10 }}>
        {ficha.apoderados_detalle.map((a) => (
          <div key={a.id} style={{ padding: 12, border: "1px solid var(--borde)", borderRadius: 8, background: "var(--bg-panel)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>{a.nombre}</strong>
                <div style={{ fontSize: 12, color: "var(--texto-mute)" }}>
                  {a.parentesco_label || "Sin parentesco"} · {a.ocupacion || "Ocupación no registrada"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--texto-mute)", textAlign: "right" }}>
                {a.telefono && <div><Icon name="telefono" size={11} /> {a.telefono}</div>}
                {a.email && <div><Icon name="email" size={11} /> {a.email}</div>}
              </div>
            </div>
            <Link to={`/usuarios/${a.usuario_id}`} className="btn-mini btn-icono" style={{ marginTop: 6 }}>
              <Icon name="editar" size={11} /> Editar cuenta
            </Link>
          </div>
        ))}
      </div>
    )
  );

  return null;
}


/* ════════════════════════════════ HISTORIAL DE NOTAS ═══════════════════ */
interface Nota {
  id: number;
  estudiante: number;
  area: string;
  bimestre: string;
  bimestre_label: string;
  competencia: number;
  calificacion: string;
  calificacion_numerica: string | null;
}

const NL_COLOR: Record<string, { bg: string; text: string }> = {
  AD: { bg: "#D1FAE5", text: "#065F46" },
  A:  { bg: "#DBEAFE", text: "#1E40AF" },
  B:  { bg: "#FEF3C7", text: "#92400E" },
  C:  { bg: "#FEE2E2", text: "#991B1B" },
};

function HistorialNotas({ estudianteId }: { estudianteId: number }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function cargar() {
    if (notas.length > 0) return;
    setCargando(true);
    try {
      const { data } = await api.get<Nota[] | { results?: Nota[] }>(
        `/notas/?estudiante=${estudianteId}&limit=500`
      );
      setNotas(Array.isArray(data) ? data : (data.results ?? []));
    } finally { setCargando(false); }
  }

  function toggle() {
    if (!abierto) cargar();
    setAbierto(v => !v);
  }

  // Agrupar por bimestre → área → mejor calificación
  const ORDEN_NL = ["AD", "A", "B", "C", ""];
  const porBimestre: Record<string, Record<string, string>> = {};
  for (const n of notas) {
    if (!porBimestre[n.bimestre_label]) porBimestre[n.bimestre_label] = {};
    const prev = porBimestre[n.bimestre_label][n.area] ?? "";
    const mejor = ORDEN_NL.indexOf(n.calificacion) <= ORDEN_NL.indexOf(prev) ? n.calificacion : prev;
    porBimestre[n.bimestre_label][n.area] = mejor;
  }
  const bimestres = Object.keys(porBimestre).sort();

  return (
    <Card titulo={
      <button onClick={toggle} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        background: "transparent", border: "none", cursor: "pointer",
        padding: 0, fontSize: "inherit", fontWeight: "inherit", color: "inherit",
      }}>
        <span style={{ display: "inline-block", transform: abierto ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}>
          <Icon name="chevron-abajo" size={14} />
        </span>
        <Icon name="documento" /> Historial de notas
        {notas.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginLeft: 4 }}>
            <span style={{ fontSize: 11, background: "var(--azul-100,#dbeafe)", color: "var(--azul-700,#1d4ed8)",
                           padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>
              {bimestres.length} bimestre{bimestres.length !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 11, background: "var(--fondo,#f8fafc)", color: "var(--texto-mute)",
                           padding: "2px 8px", borderRadius: 999, border: "1px solid var(--borde)" }}>
              {notas.length} notas
            </span>
          </div>
        )}
      </button>
    }>
      {abierto && (
        cargando ? <div style={{ padding: 16, textAlign: "center", color: "var(--muted-foreground)" }}>Cargando...</div> :
        notas.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
            Sin notas registradas todavía.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {bimestres.map(bim => (
              <div key={bim}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--azul-700)" }}>
                  {bim}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Object.entries(porBimestre[bim]).sort(([a], [b]) => a.localeCompare(b)).map(([area, nl]) => {
                    const col = NL_COLOR[nl] ?? { bg: "var(--muted)", text: "var(--texto)" };
                    return (
                      <div key={area} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "5px 10px", borderRadius: 6, background: "var(--fondo)",
                        border: "1px solid var(--borde)", fontSize: 12,
                      }}>
                        <span>{area}</span>
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          background: col.bg, color: col.text,
                          padding: "2px 8px", borderRadius: 6,
                        }}>
                          {nl || "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Card>
  );
}
