import { useCallback, useEffect, useRef, useState } from "react";
import { AREAS_CNEB } from "../constants/curriculo";
import api from "../services/api";
import Card from "../components/ui/Card";
import { useToast } from "../components/ui/Toast";
import { Cargando } from "../components/ui/Spinner";
import Icon from "../components/ui/Icon";
import { ChevronLeft, ChevronRight, Sparkles, X, FileSpreadsheet, Pencil, Eye } from "lucide-react";
import SeccionCard from "../components/ui/SeccionCard";
import { useAuth } from "../hooks/useAuth";
import { useModoRol } from "../hooks/useModoRol";
import { useModoUI } from "../hooks/useModoUI";
import SiagieRellenarModal from "../components/notas/SiagieRellenarModal";
import { parseFecha } from "../utils/fechas";

interface Asignacion {
  id: number;
  seccion_id: number;
  seccion_nombre: string;
  seccion_grado: string;
  seccion_letra: string;
  seccion_nivel?: string;
  area: string;
  num_competencias: number;
}

interface Nota {
  id?: number;
  estudiante: number;
  estudiante_nombre: string;
  estudiante_codigo: string;
  area: string;
  bimestre: string;
  competencia: number;
  calificacion: string;
  conclusion_descriptiva: string;
  calificacion_numerica?: number | null;
  observaciones?: string;
}

interface Estudiante {
  id: number;
  nombre_completo: string;
  nombre: string;
  codigo_matricula: string;
  dni: string;
  fecha_ingreso?: string | null;
}

const CONCLUSIONES: Record<string, string> = {
  AD: "Logro destacado. El estudiante evidencia el logro de los aprendizajes previstos, demostrando incluso un manejo solvente y muy satisfactorio en todas las tareas propuestas.",
  A: "Logro esperado. El estudiante evidencia el logro de los aprendizajes previstos en el tiempo programado.",
  B: "En proceso. El estudiante está en camino de lograr los aprendizajes previstos, para lo cual requiere acompañamiento durante un tiempo razonable para lograrlo.",
  C: "En inicio. El estudiante está empezando a desarrollar los aprendizajes previstos o evidencia dificultades para el desarrollo de éstos y necesita mayor tiempo de acompañamiento e intervención del docente de acuerdo con su ritmo y estilo de aprendizaje.",
};

const NL_COLOR: Record<string, { bg: string; text: string }> = {
  AD: { bg: "var(--success-bg-subtle)", text: "var(--success-text)" },
  A:  { bg: "var(--info-bg-subtle)", text: "var(--info-text)" },
  B:  { bg: "var(--warning-bg-subtle)", text: "var(--warning-text)" },
  C:  { bg: "var(--danger-bg-subtle)", text: "var(--danger-text)" },
};

const CICLO_NL = ["AD", "A", "B", "C"];

function badgeIngresoMitadAnio(fechaIngreso: string | null | undefined): string | null {
  if (!fechaIngreso) return null;
  const d = parseFecha(fechaIngreso)!;
  const mes = d.getMonth() + 1; // 1-based
  if (mes <= 3) return null; // ingresó en B1 o antes — normal
  if (mes <= 5) return "Ingresó en B2";
  if (mes <= 8) return "Ingresó en B3";
  return "Ingresó en B4";
}

type CeldaKey = `${number}_${number}`;

interface PanelState { estudianteId: number; competencia: number }

interface Sugerencia {
  estudiante_id: number;
  competencia: number;
  sugerencia: string;
  tendencia: "mejorando" | "bajando" | "estable";
  base: string;
  historial: { bimestre: string; anio: number; nota: string }[];
}

interface CompCNEB {
  id: number;
  numero: number;
  nombre: string;
  capacidades: {
    id: number;
    nombre: string;
    orden: number;
  }[];
  desempenos?: { id: number; descripcion: string; orden: number }[];
}

function nivelFromGrado(grado: string): "inicial" | "primaria" | "secundaria" {
  const g = (grado ?? "").toLowerCase();
  if (g.includes("inicial") || g.includes("años")) return "inicial";
  if (g.includes("secundaria")) return "secundaria";
  return "primaria";
}

/** Convierte (nivel, grado_display) → código CNEB (p5, s3, i4a, etc.) */
function codigoGrado(nivel: string, grado: string): string | null {
  const g = (grado ?? "").toLowerCase();
  if (nivel === "inicial") {
    if (g.includes("3")) return "i3a";
    if (g.includes("4")) return "i4a";
    if (g.includes("5")) return "i5a";
    return null;
  }
  const num =
    g.includes("1") ? 1 :
    g.includes("2") ? 2 :
    g.includes("3") ? 3 :
    g.includes("4") ? 4 :
    g.includes("5") ? 5 :
    g.includes("6") ? 6 : 0;
  if (!num) return null;
  return nivel === "secundaria" ? `s${num}` : `p${num}`;
}

function numericaALetra(n: number): string {
  if (n >= 18) return "AD";
  if (n >= 14) return "A";
  if (n >= 11) return "B";
  return "C";
}

const LS_KEY = "nota_escala_preferencia";

export default function CargarNotasView() {
  const toast = useToast();
  useAuth();
  const { rolEfectivo } = useModoRol();
  const { modo } = useModoUI();
  const modoSimple = modo === "simple";
  const esDirector = rolEfectivo === "director" || rolEfectivo === "subdirector";
  const [modoEdicion, setModoEdicion] = useState(false);
  const [confirmarEdicion, setConfirmarEdicion] = useState(false);
  const soloLectura = !modoEdicion;
  const [escala, setEscalaState] = useState<"letras" | "numerica">("letras");
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [asigSeleccionada, setAsigSeleccionada] = useState<Asignacion | null>(null);
  const [, setSeccionFiltro] = useState<string>("");
  const [bimestre, setBimestre] = useState(() => {
    const m = new Date().getMonth() + 1; // 1-12
    if (m <= 4) return "1";
    if (m <= 6) return "2";
    if (m <= 9) return "3";
    return "4";
  });
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [notasMap, setNotasMap] = useState<Map<CeldaKey, Nota>>(new Map());
  const [editado, setEditado] = useState<Set<CeldaKey>>(new Set());
  const [cargandoAsignaciones, setCargandoAsignaciones] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [areaDirector, setAreaDirector] = useState("Matemática");
  const [compDirector, setCompDirector] = useState(1);
  const [modalSiagieTemplate, setModalSiagieTemplate] = useState(false);
  const [publicandoNotas, setPublicandoNotas] = useState(false);
  const [estadoPublicacion, setEstadoPublicacion] = useState<"borrador" | "publicado" | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ creadas: number; actualizadas: number; errores: unknown[] } | null>(null);
  const [compNombres, setCompNombres] = useState<string[]>(["", "", "", "", ""]);
  const [seleccionadas, setSeleccionadas] = useState<Set<CeldaKey>>(new Set());
  // Refs para drag — native DOM events evita todos los problemas de React synthetic events
  const isDraggingRef = useRef(false);
  const dragAnchorRef = useRef<{ row: number; col: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const estudiantesRef = useRef<Estudiante[]>([]);  // copia sin stale closure para el handler nativo
  useEffect(() => { estudiantesRef.current = estudiantes; }, [estudiantes]);
  const [competenciasCNEB, setCompetenciasCNEB] = useState<CompCNEB[]>([]);
  const [errorCNEB, setErrorCNEB] = useState(false);
  const [sugerencias, setSugerencias] = useState<Map<CeldaKey, Sugerencia>>(new Map());
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  // Override manual del conteo de competencias (null = usar CNEB o asignación)
  const [numCompManual, setNumCompManual] = useState<number | null>(null);
  // Evaluación por capacidad: Map<"estId_comp", Record<capId, "AD"|"A"|"B"|"C">>
  const [capEstados, setCapEstados] = useState<Map<CeldaKey, Record<number, string>>>(new Map());
  // Evaluación por desempeño: Map<"estId_comp", Record<desId, "AD"|"A"|"B"|"C">>
  const [desEstados, setDesEstados] = useState<Map<CeldaKey, Record<number, string>>>(new Map());
  // Sugerencias por desempeño (histórico): Map<"estId_desId", "AD"|"A"|"B"|"C">
  const [desSugerencias, setDesSugerencias] = useState<Map<string, string>>(new Map());
  // Sugerencias por capacidad: Map<"estId_capId", "AD"|"A"|"B"|"C">
  const [capSugerencias, setCapSugerencias] = useState<Map<string, string>>(new Map());
  // RVM 048-2024: qué NL requieren conclusión obligatoria por nivel
  const [normativaRVM, setNormativaRVM] = useState<Record<string, string[]>>({});
  // RVM 048-2024: alertas de C consecutiva. Map<"estId_comp_bimestre", {sustentado: bool}>
  const [cConsecutiva, setCConsecutiva] = useState<Map<string, { sustentado: boolean; bimestres: string[] }>>(new Map());
  // Competencias con sub-columnas expandidas (índice 0-based)
  const [expandedComps, setExpandedComps] = useState<Set<number>>(new Set());
  // Selección múltiple de celdas de capacidad: key = "${estId}_${comp}_${capId}"
  const [capSeleccionadas, setCapSeleccionadas] = useState<Set<string>>(new Set());
  // drag de capacidades: fija capId y comp al hacer mousedown en cap cell
  const capDragRef = useRef<{ capComp: number; capId: number } | null>(null);
  // Auto-guardado
  const [autoGuardadoTs, setAutoGuardadoTs] = useState<number | null>(null);
  const guardandoRef = useRef(false);
  // Modo de entrada: ciclar = click cicla AD/A/B/C; panel = click abre panel lateral
  const [modoInput, setModoInput] = useState<"ciclar" | "panel">("ciclar");
  // DEBUG: último evento detectado (temporal, para diagnóstico)
  const [debugLast, setDebugLast] = useState<string>("(sin eventos)");
  void debugLast;

  // Helpers para escala — localStorage tiene prioridad sobre config global
  function setEscala(val: "letras" | "numerica") {
    localStorage.setItem(LS_KEY, val);
    setEscalaState(val);
  }
  function toggleEscala() {
    setEscala(escala === "letras" ? "numerica" : "letras");
  }

  // Cargar reglas RVM 048-2024 al montar
  useEffect(() => {
    api.get<{ conclusion_obligatoria_por_nivel: Record<string, string[]> }>("/notas/normativa-rvm-048/")
      .then(({ data }) => setNormativaRVM(data.conclusion_obligatoria_por_nivel))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const guardada = localStorage.getItem(LS_KEY) as "letras" | "numerica" | null;
    if (guardada) {
      setEscalaState(guardada);
    } else {
      api.get<{ escala_calificacion?: string }>("/core/configuracion/")
        .then(({ data }) => { if (data.escala_calificacion === "numerica") setEscalaState("numerica"); })
        .catch(() => {});
    }

    // Limpiar selección al cambiar modo
    setAsigSeleccionada(null);
    setAsignaciones([]);
    setCargandoAsignaciones(true);
    setModoEdicion(false);

    if (esDirector) {
      // Director/subdirector: ve todas las secciones + elige área manualmente
      api.get<{ results?: { id: number; nombre: string; grado: string; letra: string }[] } | { id: number; nombre: string; grado: string; letra: string }[]>("/usuarios/secciones/?limit=200")
        .then(({ data }) => {
          const secs = Array.isArray(data) ? data : (data.results ?? []);
          const asigs: Asignacion[] = secs.map(s => ({
            id: s.id * -1, // ID negativo para distinguir de AsignacionDocente real
            seccion_id: s.id,
            seccion_nombre: s.nombre || `${s.grado} ${s.letra}`,
            seccion_grado: s.grado,
            seccion_letra: s.letra,
            area: "",        // director elige el área manualmente
            num_competencias: 1,
          }));
          setAsignaciones(asigs);
        })
        .catch(() => {})
        .finally(() => setCargandoAsignaciones(false));
    } else {
      api.get<Asignacion[]>("/notas/mis-asignaciones/").then(({ data }) => {
        setAsignaciones(data);
        const secciones = [...new Set(data.map(a => a.seccion_nombre))];
        if (secciones.length === 1) {
          setSeccionFiltro(secciones[0]);
          if (data.length === 1) setAsigSeleccionada(data[0]);
        }
      })
      .catch(() => {})
      .finally(() => setCargandoAsignaciones(false));
    }
  }, [esDirector]);

  // RVM 048-2024: helper para saber si una nota necesita conclusión obligatoria
  function requiereConclusion(nl: string): boolean {
    const nivel = asigSeleccionada?.seccion_nivel ?? "primaria";
    return (normativaRVM[nivel] ?? []).includes(nl);
  }

  // Para el director: área y competencias elegidas manualmente (antes de cargarDatos)
  const areaActual = esDirector ? areaDirector : (asigSeleccionada?.area ?? "");
  // Prioridad: override manual > CNEB > asignación backend > 1
  const numComp = numCompManual !== null
    ? numCompManual
    : competenciasCNEB.length > 0
      ? competenciasCNEB.length
      : esDirector ? compDirector : (asigSeleccionada?.num_competencias ?? 1);

  const cargarDatos = useCallback(async () => {
    if (!asigSeleccionada) return;
    if (!areaActual) return; // director debe elegir área primero
    setCargando(true);
    try {
      const [estRes, notasRes] = await Promise.all([
        api.get<Estudiante[]>(`/usuarios/estudiantes/lista/?seccion=${asigSeleccionada.seccion_id}`),
        api.get<{ results?: Nota[] } | Nota[]>(
          `/notas/?seccion=${asigSeleccionada.seccion_id}&area=${encodeURIComponent(areaActual)}&bimestre=${bimestre}&limit=500`
        ),
      ]);
      setEstudiantes(estRes.data);
      const notas: Nota[] = Array.isArray(notasRes.data)
        ? notasRes.data
        : (notasRes.data as { results?: Nota[] }).results ?? [];
      const map = new Map<CeldaKey, Nota>();
      const caps = new Map<CeldaKey, Record<number, string>>();
      const dess = new Map<CeldaKey, Record<number, string>>();
      for (const n of notas) {
        const k: CeldaKey = `${n.estudiante}_${n.competencia}`;
        map.set(k, n);
        if (n.observaciones) {
          try {
            const obs = JSON.parse(n.observaciones);
            if (obs?.capacidades) caps.set(k, obs.capacidades);
            if (obs?.desempenos) dess.set(k, obs.desempenos);
          } catch { /* observaciones no es JSON, ignorar */ }
        }
      }
      setNotasMap(map);
      setCapEstados(caps);
      setDesEstados(dess);
      setEditado(new Set());
      setPanel(null);
    } finally { setCargando(false); }
  }, [asigSeleccionada, bimestre, areaActual]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    if (!esDirector || !asigSeleccionada) {
      setEstadoPublicacion(null);
      return;
    }
    api.get<{ publicaciones: { bimestre: string; estado: "borrador" | "publicado" }[] }>(
      `/notas/publicaciones/?seccion_id=${asigSeleccionada.seccion_id}`
    ).then(({ data }) => {
      const pub = data.publicaciones.find(p => p.bimestre === bimestre);
      setEstadoPublicacion(pub?.estado ?? "borrador");
    }).catch(() => setEstadoPublicacion(null));
  }, [esDirector, asigSeleccionada?.seccion_id, bimestre]);

  // Drag híbrido: mousedown lo maneja React onMouseDown de cada celda.
  // Solo document mousemove/mouseup para extender/terminar la selección.
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !(e.buttons & 1) || !dragAnchorRef.current || !dragStartRef.current) return;
      if (!didDragRef.current) {
        const dx = Math.abs(e.clientX - dragStartRef.current.x);
        const dy = Math.abs(e.clientY - dragStartRef.current.y);
        if (dx > 8 || dy > 8) didDragRef.current = true;
      }
      if (!didDragRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (capDragRef.current) {
        // Drag 2D de desempeños: rectángulo screen coords desde start → posición actual
        if (!dragStartRef.current) return;
        const x1 = Math.min(dragStartRef.current.x, e.clientX);
        const y1 = Math.min(dragStartRef.current.y, e.clientY);
        const x2 = Math.max(dragStartRef.current.x, e.clientX);
        const y2 = Math.max(dragStartRef.current.y, e.clientY);
        const allDes = document.querySelectorAll<HTMLElement>('td[data-cap-id]');
        const newSel = new Set<string>();
        const ests = estudiantesRef.current;
        allDes.forEach(td => {
          const r = td.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
            const rowN = Number(td.dataset.row);
            const compN = Number(td.dataset.capComp);
            const idN = Number(td.dataset.capId);
            if (ests[rowN]) newSel.add(`${ests[rowN].id}_${compN}_${idN}`);
          }
        });
        if (newSel.size > 0) setCapSeleccionadas(newSel);
      } else {
        const td = (el as Element | null)?.closest?.('td[data-col]') as HTMLElement | null;
        if (!td) return;
        const row = Number(td.dataset.row);
        const col = Number(td.dataset.col);
        if (isNaN(row) || isNaN(col)) return;
        const anchor = dragAnchorRef.current;
        const r1 = Math.min(anchor.row, row), r2 = Math.max(anchor.row, row);
        const c1 = Math.min(anchor.col, col), c2 = Math.max(anchor.col, col);
        const ests = estudiantesRef.current;
        const newSel = new Set<CeldaKey>();
        for (let r = r1; r <= r2; r++)
          for (let c = c1; c <= c2; c++)
            if (ests[r]) newSel.add(`${ests[r].id}_${c + 1}` as CeldaKey);
        setSeleccionadas(newSel);
      }
    };
    const handleUp = () => {
      isDraggingRef.current = false;
      dragAnchorRef.current = null;
      dragStartRef.current = null;
      capDragRef.current = null;
      setTimeout(() => { didDragRef.current = false; }, 100);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, []);

  useEffect(() => {
    if (!asigSeleccionada) return;
    const saved = localStorage.getItem(`comp_nombres_${asigSeleccionada.id}`);
    setCompNombres(saved ? JSON.parse(saved) : ["", "", "", "", ""]);
  }, [asigSeleccionada?.id]);

  // Reset override y expansiones cuando cambia la asignación o el área
  useEffect(() => { setNumCompManual(null); setExpandedComps(new Set()); }, [asigSeleccionada?.id, areaActual]);

  // Carga competencias reales del CNEB cuando cambia el área o la sección
  useEffect(() => {
    if (!areaActual || !asigSeleccionada) { setCompetenciasCNEB([]); setErrorCNEB(false); return; }
    const nivel = asigSeleccionada.seccion_nivel ?? nivelFromGrado(asigSeleccionada.seccion_grado);
    const grado = codigoGrado(nivel, asigSeleccionada.seccion_grado);
    setErrorCNEB(false);
    const gradoParam = grado ? `&grado=${grado}` : "";
    api.get<{ results?: CompCNEB[] } | CompCNEB[]>(
      `/curricula/competencias/?area_nombre=${encodeURIComponent(areaActual)}&nivel=${nivel}${gradoParam}&limit=20`
    ).then(({ data }) => {
      const comps: CompCNEB[] = Array.isArray(data) ? data : (data as { results?: CompCNEB[] }).results ?? [];
      setCompetenciasCNEB(comps);
      if (comps.length > 0) {
        const nombres = comps.map(c => c.nombre);
        setCompNombres(nombres);
      }
    }).catch(() => { setCompetenciasCNEB([]); setErrorCNEB(true); });
  }, [areaActual, asigSeleccionada?.seccion_grado]);

  // Carga sugerencias basadas en el historial previo del estudiante
  useEffect(() => {
    setSugerencias(new Map()); // limpiar antes de recargar
    if (!asigSeleccionada || !areaActual) return;
    const params = new URLSearchParams({
      seccion_id: String(asigSeleccionada.seccion_id),
      area: areaActual,
      bimestre,
    });
    api.get<{ sugerencias: Sugerencia[] }>(`/notas/sugerencias/?${params}`)
      .then(({ data }) => {
        const m = new Map<CeldaKey, Sugerencia>();
        for (const s of data.sugerencias) m.set(`${s.estudiante_id}_${s.competencia}`, s);
        setSugerencias(m);
      })
      .catch(() => {});
    // Sugerencias por desempeño (histórico)
    api.get<{ sugerencias: { estudiante_id: number; desempeno_id: number; sugerencia: string; muestras: number }[] }>(
      `/notas/sugerencias-desempeno/?${params}`
    ).then(({ data }) => {
      const m = new Map<string, string>();
      for (const s of data.sugerencias) m.set(`${s.estudiante_id}_${s.desempeno_id}`, s.sugerencia);
      setDesSugerencias(m);
    }).catch(() => {});
    // Sugerencias por capacidad
    api.get<{ sugerencias: { estudiante_id: number; capacidad_id: number; sugerencia: string; muestras: number }[] }>(
      `/notas/sugerencias-capacidad/?${params}`
    ).then(({ data }) => {
      const m = new Map<string, string>();
      for (const s of data.sugerencias) m.set(`${s.estudiante_id}_${s.capacidad_id}`, s.sugerencia);
      setCapSugerencias(m);
    }).catch(() => {});
    // RVM 048-2024: alertas de C consecutiva (todo el año, no depende del bimestre)
    const paramsCC = new URLSearchParams({
      seccion_id: String(asigSeleccionada.seccion_id),
      area: areaActual,
    });
    api.get<{ alertas: { estudiante_id: number; competencia: number; bimestres_consecutivos: string[]; sustentado: boolean }[] }>(
      `/notas/c-consecutiva/?${paramsCC}`
    ).then(({ data }) => {
      const m = new Map<string, { sustentado: boolean; bimestres: string[] }>();
      for (const a of data.alertas) {
        // Marcamos ambos bimestres implicados
        for (const b of a.bimestres_consecutivos) {
          m.set(`${a.estudiante_id}_${a.competencia}_${b}`, { sustentado: a.sustentado, bimestres: a.bimestres_consecutivos });
        }
      }
      setCConsecutiva(m);
    }).catch(() => {});
  }, [asigSeleccionada?.seccion_id, areaActual, bimestre]);

  function getOrCreateNota(estudianteId: number, competencia: number): Nota {
    const key: CeldaKey = `${estudianteId}_${competencia}`;
    return notasMap.get(key) ?? {
      estudiante: estudianteId,
      area: areaActual,
      bimestre,
      competencia,
      estudiante_nombre: "",
      estudiante_codigo: "",
      calificacion: "",
      conclusion_descriptiva: "",
    };
  }

  // Equivalente numérico de referencia por letra (mitad del rango)
  const NUM_POR_LETRA: Record<string, number> = { AD: 19, A: 15, B: 12, C: 8 };

  function setNL(estudianteId: number, competencia: number, valor: string) {
    const key: CeldaKey = `${estudianteId}_${competencia}`;
    setNotasMap(prev => {
      const base: Nota = prev.get(key) ?? {
        estudiante: estudianteId, area: areaActual, bimestre, competencia,
        estudiante_nombre: "", estudiante_codigo: "",
        calificacion: "", conclusion_descriptiva: "",
      };
      let nueva: Nota;
      const esLetra = ["AD", "A", "B", "C"].includes(valor);

      if (escala === "numerica") {
        if (esLetra) {
          // Viene de la moda de desempeños → convertir letra a numérico equivalente
          const num = NUM_POR_LETRA[valor];
          nueva = { ...base, calificacion_numerica: num, calificacion: valor,
            conclusion_descriptiva: base.conclusion_descriptiva || (CONCLUSIONES[valor] ?? "") };
        } else {
          const num = valor === "" ? null : Number(valor);
          const letra = num !== null ? numericaALetra(num) : "";
          nueva = { ...base, calificacion_numerica: num, calificacion: letra,
            conclusion_descriptiva: letra ? (base.conclusion_descriptiva || (CONCLUSIONES[letra] ?? "")) : "" };
        }
      } else {
        // Escala letras — si viene un número (edge case), convertir a letra
        const finalLetra = esLetra || valor === "" ? valor : numericaALetra(Number(valor));
        nueva = { ...base, calificacion: finalLetra,
          conclusion_descriptiva: finalLetra ? (base.conclusion_descriptiva || (CONCLUSIONES[finalLetra] ?? "")) : "" };
      }
      const next = new Map(prev);
      next.set(key, nueva);
      return next;
    });
    markEditado(key);
  }

  function setConclusion(estudianteId: number, competencia: number, texto: string) {
    const key: CeldaKey = `${estudianteId}_${competencia}`;
    setNotasMap(prev => {
      const actual = prev.get(key);
      if (!actual) return prev;
      const next = new Map(prev);
      next.set(key, { ...actual, conclusion_descriptiva: texto });
      return next;
    });
    markEditado(key);
  }

  function markEditado(key: CeldaKey) {
    setEditado((prev) => { const s = new Set(prev); s.add(key); return s; });
  }

  function setCapEstado(estId: number, comp: number, capId: number, estado: string) {
    const key: CeldaKey = `${estId}_${comp}`;
    setCapEstados(prev => {
      const next = new Map(prev);
      const actual = next.get(key) ?? {};
      next.set(key, { ...actual, [capId]: estado });
      return next;
    });
    markEditado(key);
  }

  // Moda de letras (escala AD/A/B/C). Empate → gana el más alto.
  function modaNL(valores: string[]): string {
    if (valores.length === 0) return "";
    const count: Record<string, number> = { AD: 0, A: 0, B: 0, C: 0 };
    for (const v of valores) if (count[v] !== undefined) count[v]++;
    let best = ""; let bestCount = 0;
    for (const g of ["C", "B", "A", "AD"]) {
      if (count[g] >= bestCount && count[g] > 0) { bestCount = count[g]; best = g; }
    }
    return best;
  }

  // Promedio de números (escala 0-20). Redondea al entero más cercano.
  function promedioNum(valores: number[]): number | null {
    const validos = valores.filter(v => Number.isFinite(v) && v >= 0 && v <= 20);
    if (validos.length === 0) return null;
    const sum = validos.reduce((a, b) => a + b, 0);
    return Math.round((sum / validos.length) * 10) / 10;  // 1 decimal
  }

  function setDesEstado(estId: number, comp: number, desId: number, estado: string) {
    const key: CeldaKey = `${estId}_${comp}`;
    const cnebComp = competenciasCNEB[comp - 1];
    if (!cnebComp?.desempenos) return;

    // Actualizar el desempeño local
    const desActuales = desEstados.get(key) ?? {};
    const newDes = { ...desActuales };
    if (estado) newDes[desId] = estado; else delete newDes[desId];

    setDesEstados(prev => {
      const next = new Map(prev);
      if (Object.keys(newDes).length === 0) next.delete(key); else next.set(key, newDes);
      return next;
    });

    // Recalcular la nota de la competencia según escala
    const valores = cnebComp.desempenos.map(d => newDes[d.id]).filter(Boolean);
    if (escala === "numerica") {
      const numeros = valores.map(v => Number(v)).filter(n => Number.isFinite(n));
      const prom = promedioNum(numeros);
      if (prom !== null) setNL(estId, comp, String(prom));
      else markEditado(key);
    } else {
      const nuevoNL = modaNL(valores);
      if (nuevoNL) setNL(estId, comp, nuevoNL); else markEditado(key);
    }
  }

  function ciclarNL(estId: number, competencia: number) {
    if (soloLectura) return;
    const actual = notasMap.get(`${estId}_${competencia}`)?.calificacion ?? "";
    const idx = CICLO_NL.indexOf(actual);
    const siguiente = CICLO_NL[(idx + 1) % CICLO_NL.length];
    setNL(estId, competencia, siguiente);
  }

  function aplicarASeleccion(nl: string) {
    seleccionadas.forEach((key) => {
      const [estId, comp] = key.split("_").map(Number);
      setNL(estId, comp, nl);
    });
    setSeleccionadas(new Set());
  }

  function aplicarACapSeleccion(nl: string) {
    // En numérica convertir letra → número equivalente antes de aplicar
    const valorFinal = escala === "numerica" && NUM_POR_LETRA[nl] !== undefined
      ? String(NUM_POR_LETRA[nl])
      : nl;
    capSeleccionadas.forEach((key) => {
      const [estId, comp, desId] = key.split("_").map(Number);
      setDesEstado(estId, comp, desId, valorFinal);
    });
    setCapSeleccionadas(new Set());
  }

  function aceptarSugerencia(key: CeldaKey) {
    const sug = sugerencias.get(key);
    if (!sug) return;
    const [estId, comp] = key.split("_").map(Number);
    setNL(estId, comp, sug.sugerencia);
  }

  function aplicarTodasSugerencias() {
    let aplicadas = 0;
    sugerencias.forEach((sug, key) => {
      const nota = notasMap.get(key);
      if (!nota?.calificacion) {
        const [estId, comp] = key.split("_").map(Number);
        setNL(estId, comp, sug.sugerencia);
        aplicadas++;
      }
    });
    toast.ok(`${aplicadas} sugerencia${aplicadas !== 1 ? "s" : ""} aplicada${aplicadas !== 1 ? "s" : ""}. Revisa y guarda.`);
  }

  // Consolida usando fórmula RVM 048-2024: (Σpuntos / n×4) × 10 → letra
  // Umbrales en puntos medios entre niveles puros (2.5-10):
  //   all-C=2.5  all-B=6.25  all-A=7.5  all-AD=10
  //   C:<4.375  B:<6.875  A:<8.75  AD:≥8.75
  function consolidadoEstudiante(estId: number): string {
    const PUNTOS: Record<string, number> = { AD: 4, A: 3, B: 2.5, C: 1 };
    const niveles: number[] = [];
    for (let ci = 1; ci <= numComp; ci++) {
      const nl = notasMap.get(`${estId}_${ci}`)?.calificacion;
      if (nl && PUNTOS[nl] !== undefined) niveles.push(PUNTOS[nl]);
    }
    if (niveles.length === 0) return "";
    const score = (niveles.reduce((a, b) => a + b, 0) / (niveles.length * 4)) * 10;
    if (score >= 8.75) return "AD";
    if (score >= 6.875) return "A";
    if (score >= 4.375) return "B";
    return "C";
  }

  // RVM 048-2024 — calificativo oficial del área (fórmula MINEDU)
  // C=1, B=2.5, A=3, AD=4 → (Σ / n×4) × 10 → escala 2.5-10
  function calificativoArea(estId: number): number | null {
    const PUNTOS: Record<string, number> = { AD: 4, A: 3, B: 2.5, C: 1 };
    const niveles: number[] = [];
    for (let ci = 1; ci <= numComp; ci++) {
      const nl = notasMap.get(`${estId}_${ci}`)?.calificacion;
      if (nl && PUNTOS[nl] !== undefined) niveles.push(PUNTOS[nl]);
    }
    if (niveles.length === 0) return null;
    const suma = niveles.reduce((a, b) => a + b, 0);
    return Math.round((suma / (niveles.length * 4)) * 10 * 100) / 100;
  }

  async function guardar() {
    if (!asigSeleccionada || editado.size === 0) return;
    setGuardando(true);
    let ok = 0, err = 0;
    for (const key of editado) {
      const nota = notasMap.get(key);
      if (!nota || !nota.calificacion) continue;
      const caps = capEstados.get(key);
      const dess = desEstados.get(key);
      const hasCaps = caps && Object.keys(caps).length > 0;
      const hasDess = dess && Object.keys(dess).length > 0;
      const observaciones = (hasCaps || hasDess)
        ? JSON.stringify({
            ...(hasCaps ? { capacidades: caps } : {}),
            ...(hasDess ? { desempenos: dess } : {}),
          })
        : (nota.observaciones ?? "");
      const payload = escala === "numerica"
        ? { calificacion_numerica: nota.calificacion_numerica, calificacion: nota.calificacion, conclusion_descriptiva: nota.conclusion_descriptiva, observaciones }
        : { calificacion: nota.calificacion, conclusion_descriptiva: nota.conclusion_descriptiva, observaciones };
      try {
        if (nota.id) {
          await api.patch(`/notas/${nota.id}/`, payload);
        } else {
          const { data } = await api.post<Nota>("/notas/", {
            estudiante: nota.estudiante, area: areaActual,
            bimestre, competencia: nota.competencia, ...payload,
          });
          const newMap = new Map(notasMap);
          newMap.set(key, data);
          setNotasMap(newMap);
        }
        ok++;
      } catch { err++; }
    }
    setEditado(new Set());
    setGuardando(false);
    if (err > 0) toast.error(`${ok} guardadas, ${err} errores.`);
    else toast.ok(`${ok} nota(s) guardadas.`);
  }

  // Auto-guardado: 4s después de la última edición
  useEffect(() => {
    if (editado.size === 0 || guardandoRef.current) return;
    const timer = setTimeout(async () => {
      if (editado.size === 0 || guardandoRef.current) return;
      guardandoRef.current = true;
      await guardar();
      guardandoRef.current = false;
      setAutoGuardadoTs(Date.now());
    }, 4000);
    return () => clearTimeout(timer);
  }, [editado]); // eslint-disable-line

  async function cambiarNumComp(n: number) {
    if (!asigSeleccionada) return;
    try {
      await api.patch(`/notas/asignaciones/${asigSeleccionada.id}/`, { num_competencias: n });
      setAsignaciones(prev => prev.map(a => a.id === asigSeleccionada.id ? { ...a, num_competencias: n } : a));
      setAsigSeleccionada(prev => prev ? { ...prev, num_competencias: n } : prev);
    } catch { toast.error("No se pudo cambiar el número de competencias."); }
  }

  async function guardarBlob(blob: Blob, nombreSugerido: string, mime: string) {
    if ("showSaveFilePicker" in window) {
      try {
        const ext = nombreSugerido.split(".").pop() ?? "xlsx";
        const handle = await (window as Window & { showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: nombreSugerido,
          types: [{ description: "Archivo", accept: { [mime]: [`.${ext}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return; // usuario canceló
      }
    }
    // fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = nombreSugerido; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function descargarTemplate() {
    if (!asigSeleccionada) return;
    const params = new URLSearchParams({ seccion_id: String(asigSeleccionada.seccion_id), area: areaActual, bimestre });
    const { data } = await api.get(`/notas/template/?${params}`, { responseType: "blob" });
    await guardarBlob(data, `registro_notas_${areaActual}_B${bimestre}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  async function subirExcel() {
    if (!archivo) return;
    setEnviando(true);
    try {
      const fd = new FormData(); fd.append("archivo", archivo); fd.append("bimestre", bimestre);
      const { data } = await api.post<typeof resultado>("/notas/importar/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResultado(data);
      toast.ok(`${data!.creadas} creadas, ${data!.actualizadas} actualizadas.`);
      cargarDatos();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? "Error al subir.");
    } finally { setEnviando(false); }
  }

  async function descargarBoletasSeccion() {
    if (!asigSeleccionada) return;
    try {
      const { data } = await api.get(
        `/notas/boletas-seccion/${asigSeleccionada.seccion_id}/?bimestre=${bimestre}`,
        { responseType: "blob" }
      );
      await guardarBlob(data, `boletas_${asigSeleccionada.seccion_nombre}_B${bimestre}.zip`, "application/zip");
      toast.ok("Boletas generadas.");
    } catch { toast.error("Error al generar boletas. Verifica que haya notas cargadas."); }
  }

  async function descargarLibretaAnual() {
    if (!asigSeleccionada) return;
    try {
      const { data } = await api.get(
        `/notas/libreta-anual/${asigSeleccionada.seccion_id}/`,
        { responseType: "blob" }
      );
      await guardarBlob(data, `libretas_anuales_${asigSeleccionada.seccion_nombre}.zip`, "application/zip");
      toast.ok("Libretas anuales generadas.");
    } catch { toast.error("Error al generar libretas. Verifica que haya notas cargadas."); }
  }

  async function exportarSIAGIE(bim?: string) {
    const params = new URLSearchParams();
    if (bim) params.set("bimestre", bim);
    if (asigSeleccionada) params.set("seccion", String(asigSeleccionada.seccion_id));
    const { data } = await api.get(`/notas/exportar-siagie/?${params}`, { responseType: "blob" });
    const nombre = bim ? `notas_siagie_B${bim}.xlsx` : "notas_siagie.xlsx";
    await guardarBlob(data, nombre, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  async function cambiarPublicacionNotas(estado: "borrador" | "publicado") {
    if (!asigSeleccionada) return;
    setPublicandoNotas(true);
    try {
      const { data } = await api.post<{ estado: "borrador" | "publicado" }>("/notas/publicaciones/", {
        seccion_id: asigSeleccionada.seccion_id,
        bimestre,
        estado,
      });
      setEstadoPublicacion(data.estado);
      toast.ok(estado === "publicado"
        ? `Bimestre ${bimestre} publicado para familias.`
        : `Bimestre ${bimestre} oculto para familias.`);
    } catch {
      toast.error("No se pudo cambiar la publicación de notas.");
    } finally {
      setPublicandoNotas(false);
    }
  }

  // Sugerencias pendientes (sin nota real cargada)
  const sugerenciasPendientes = [...sugerencias.entries()].filter(
    ([key]) => !notasMap.get(key)?.calificacion
  );
  const sugerenciasRiesgo = sugerenciasPendientes.filter(([, s]) => s.sugerencia === "B" || s.sugerencia === "C");

  // RVM 048-2024: contar notas con NL que requiere conclusión pero sin conclusión válida
  const conclusionesFaltantes = [...notasMap.values()].filter(n =>
    n.calificacion && requiereConclusion(n.calificacion) &&
    (!n.conclusion_descriptiva || n.conclusion_descriptiva.trim().length < 20)
  ).length;

  // RVM 048-2024: contar alertas de C consecutiva sin sustentar
  const ccSinSustentar = (() => {
    const casos = new Set<string>();
    cConsecutiva.forEach((val, key) => {
      if (!val.sustentado) {
        // Deduplico por par (estId, comp) usando estId_comp
        const [estId, comp] = key.split("_");
        casos.add(`${estId}_${comp}`);
      }
    });
    return casos.size;
  })();

  // Panel lateral
  const panelEstudiante = panel ? estudiantes.find(e => e.id === panel.estudianteId) : null;
  const panelNota = panel ? getOrCreateNota(panel.estudianteId, panel.competencia) : null;
  const panelIdx = panel ? estudiantes.findIndex(e => e.id === panel.estudianteId) : -1;

  // ── Cards de sección para docente (pantalla previa) ───────────────────────
  if (!esDirector && !asigSeleccionada && !cargandoAsignaciones) {
    const seccionesUnicas = Array.from(
      new Map(asignaciones.map(a => [a.seccion_id, a])).values()
    );
    return (
      <div>
        <h2 className="page-title">Registro de notas</h2>
        {asignaciones.length === 0 ? (
          <div style={{ background: "var(--warning-bg-subtle)", border: "1px solid var(--warning-border-subtle)", color: "var(--warning-text)", borderRadius: 12, padding: 16 }}>
            <strong>Sin asignaciones configuradas.</strong> El director debe asignarte en{" "}
            <strong>Administración → Asignaciones de docentes</strong>.
          </div>
        ) : (
          <>
            <p style={{ color: "var(--muted-foreground)", marginBottom: 16, fontSize: 14 }}>
              Selecciona la sección para registrar notas:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {seccionesUnicas.map((a) => {
                const areasSeccion = asignaciones.filter(x => x.seccion_id === a.seccion_id);
                const nivel = a.seccion_nivel ?? nivelFromGrado(a.seccion_grado);
                return (
                  <div key={a.seccion_id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <SeccionCard
                      grado={a.seccion_grado}
                      letra={a.seccion_letra}
                      nivel={nivel}
                      onClick={() => { setAsigSeleccionada(a); setEstudiantes([]); setNotasMap(new Map()); }}
                    />
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", paddingLeft: 8 }}>
                      {areasSeccion.map(x => x.area).join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 0, position: "relative" }}>
      {/* Contenido principal */}
      <div style={{ flex: 1, minWidth: 0, transition: "margin-right .2s", marginRight: panel ? 340 : 0 }}>
        <h2 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!esDirector && (
            <button
              onClick={() => { setAsigSeleccionada(null); setEstudiantes([]); setNotasMap(new Map()); }}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)", fontSize: 13, fontWeight: 400 }}
            >
              <ChevronLeft size={16} /> Secciones
            </button>
          )}
          Registro de notas
        </h2>
        <p style={{ color: "var(--muted-foreground)", marginBottom: 16, fontSize: 14 }}>
          {modoSimple
            ? "Elige sección y bimestre, toca las celdas para registrar AD/A/B/C y guarda. Las opciones SIAGIE están al final."
            : escala === "numerica"
              ? "Escala numérica 0–20 (18-20=AD, 14-17=A, 11-13=B, 0-10=C). Haz click en una celda para editar la conclusión descriptiva."
              : "Niveles de logro AD / A / B / C según RVM 094-2020-MINEDU. Haz click en una celda para editar la conclusión descriptiva."}
        </p>

        {/* Selector */}
        {cargandoAsignaciones ? (
          <Cargando inline />
        ) : asignaciones.length === 0 ? (
          <div style={{ background: "var(--warning-bg-subtle)", border: "1px solid var(--warning-border-subtle)", color: "var(--warning-text)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <strong>Sin asignaciones configuradas.</strong> El director debe asignarte en{" "}
            <strong>Administración → Asignaciones de docentes</strong>.
          </div>
        ) : (
          <Card titulo={modoSimple ? "1. Elige sección y bimestre" : "Seleccionar asignación y bimestre"}>
            {/* Chips de asignaciones — docente ve sección·área de un vistazo */}
            {!esDirector && (
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: "block", marginBottom: 6 }}>Asignación</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {asignaciones.map(a => {
                    const activa = asigSeleccionada?.id === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => {
                          setAsigSeleccionada(a);
                          setSeccionFiltro(a.seccion_nombre);
                          setEstudiantes([]); setNotasMap(new Map());
                        }}
                        style={{
                          padding: "6px 14px", borderRadius: 20, fontSize: 13,
                          border: `2px solid ${activa ? "var(--azul-600)" : "var(--borde)"}`,
                          background: activa ? "var(--azul-50)" : "var(--fondo)",
                          color: activa ? "var(--azul-700)" : "var(--texto)",
                          fontWeight: activa ? 700 : 400,
                          cursor: "pointer", transition: "all .15s",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {a.seccion_nombre} · {a.area}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {/* Director: selector sección + área (más variedad) */}
              {esDirector && (
                <>
                  <div className="form-field" style={{ flex: 2, minWidth: 180 }}>
                    <label className="form-label">Sección</label>
                    <select className="form-input" value={asigSeleccionada?.id ?? ""}
                      onChange={(e) => {
                        setAsigSeleccionada(asignaciones.find(x => x.id === Number(e.target.value)) ?? null);
                        setEstudiantes([]); setNotasMap(new Map());
                      }}>
                      <option value="">Seleccionar...</option>
                      {asignaciones.map(a => <option key={a.id} value={a.id}>{a.seccion_nombre}</option>)}
                    </select>
                  </div>
                  {asigSeleccionada && (
                    <div className="form-field" style={{ minWidth: 180 }}>
                      <label className="form-label">Área</label>
                      <select className="form-input" value={areaDirector} onChange={(e) => setAreaDirector(e.target.value)}>
                        {AREAS_CNEB.map(a => <option key={a}>{a}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="form-field">
                <label className="form-label">Bimestre</label>
                <select className="form-input" value={bimestre} onChange={(e) => setBimestre(e.target.value)}>
                  {["1","2","3","4"].map(b => <option key={b} value={b}>Bimestre {b}</option>)}
                </select>
              </div>
              {!modoSimple && asigSeleccionada && (
                <div className="form-field">
                  <label className="form-label">Competencias</label>
                  <select className="form-input" value={numComp}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (esDirector) { setCompDirector(n); setNumCompManual(n); }
                      else { setNumCompManual(n); cambiarNumComp(n); }
                    }}>
                    {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
              {!modoSimple && <div className="form-field">
                <label className="form-label">Escala</label>
                <button
                  type="button"
                  onClick={toggleEscala}
                  title={escala === "letras" ? "Cambiar a escala numérica (0-20)" : "Cambiar a letras (AD/A/B/C)"}
                  style={{
                    height: 42, padding: "0 14px",
                    border: "1px solid var(--borde)", borderRadius: 8,
                    background: escala === "numerica" ? "var(--azul-600)" : "var(--fondo)",
                    color: escala === "numerica" ? "white" : "var(--texto)",
                    fontWeight: 600, fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all .15s", whiteSpace: "nowrap",
                  }}
                >
                  {escala === "letras" ? "AD/A/B/C" : "0 – 20"}
                  <span style={{ fontSize: 10, opacity: 0.7 }}>⇄</span>
                </button>
              </div>}
              {!modoSimple && <div className="form-field">
                <label className="form-label">Modo entrada</label>
                <div style={{ display: "flex", height: 42, border: "1px solid var(--borde)", borderRadius: 8, overflow: "hidden" }}>
                  {(["ciclar", "panel"] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModoInput(m)}
                      title={m === "ciclar" ? "Click en celda cicla AD→A→B→C" : "Click en celda abre panel lateral con todos los controles"}
                      style={{
                        flex: 1, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, padding: "0 12px",
                        background: modoInput === m ? "var(--azul-600)" : "var(--fondo)",
                        color: modoInput === m ? "white" : "var(--texto)",
                        transition: "all .15s", whiteSpace: "nowrap",
                      }}
                    >
                      {m === "ciclar" ? "Ciclar" : "Panel"}
                    </button>
                  ))}
                </div>
              </div>}
            </div>
          </Card>
        )}

        {/* Banner solo lectura / edición — visible para docente y director */}
        {asigSeleccionada && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            background: modoEdicion ? "var(--warning-bg-subtle)" : "var(--fondo-secundario)",
            border: `1px solid ${modoEdicion ? "var(--warning-border-subtle)" : "var(--borde)"}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13,
          }}>
            <span style={{
              color: modoEdicion ? "var(--warning-text)" : "var(--muted-foreground)",
              display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 500,
            }}>
              {modoEdicion ? <Pencil size={14} /> : <Eye size={14} />}
              {modoEdicion
                ? (esDirector
                    ? "Edición directiva activa — cambios auditados"
                    : "Edición activa")
                : "Solo lectura — activa edición para modificar notas"}
            </span>
            {modoEdicion ? (
              <button
                className="btn btn-secundario"
                onClick={() => setModoEdicion(false)}
                style={{ padding: "8px 16px", fontSize: 13, whiteSpace: "nowrap" }}
              >
                Salir de edición
              </button>
            ) : (
              <button
                className="btn btn-primario"
                onClick={() => esDirector ? setConfirmarEdicion(true) : setModoEdicion(true)}
                style={{
                  padding: "9px 18px", fontSize: 13, whiteSpace: "nowrap",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <Pencil size={14} /> Activar edición
              </button>
            )}
          </div>
        )}

        {/* Modal confirmación edición directiva */}
        {confirmarEdicion && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          }}>
            <div style={{
              background: "var(--fondo)", borderRadius: 14, padding: 28, maxWidth: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)", margin: 16,
            }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700 }}>Edición directiva</h3>
              <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                Como director, puedes corregir notas en casos justificados.
                <br /><br />
                <strong>Todos los cambios quedan registrados en auditoría</strong> con tu nombre, timestamp y la nota anterior.
                <br /><br />
                ¿Deseas habilitar la edición?
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmarEdicion(false)}
                  style={{
                    padding: "8px 18px", borderRadius: 8, fontSize: 13,
                    background: "var(--fondo)", border: "1px solid var(--borde)",
                    color: "var(--texto)", cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setModoEdicion(true); setConfirmarEdicion(false); }}
                  style={{
                    padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: "#1D4ED8", border: "none", color: "white", cursor: "pointer",
                  }}
                >
                  Sí, habilitar edición
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Aviso si el CNEB no cargó */}
        {errorCNEB && asigSeleccionada && (
          <div style={{ background: "var(--warning-bg-subtle)", border: "1px solid var(--warning-border-subtle)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "var(--warning-text)" }}>
            No se pudieron cargar las competencias del CNEB para esta área. Puedes editar los nombres manualmente en la cabecera de la grilla.
          </div>
        )}

        {/* Grilla compacta */}
        {asigSeleccionada && (
          <Card titulo={modoSimple ? `2. Registra notas · ${asigSeleccionada.seccion_nombre} · B${bimestre}` : `${asigSeleccionada.seccion_nombre} · ${areaActual} · B${bimestre}`}>
            {/* Banner RVM 048-2024: C en 2+ periodos consecutivos sin sustento */}
            {ccSinSustentar > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                background: "var(--warning-bg-subtle)", border: "1px solid var(--warning-border-subtle)",
                borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13,
              }}>
                <span style={{
                  background: "var(--warning-text)", color: "var(--warning-bg-subtle)", borderRadius: "50%",
                  width: 22, height: 22, fontSize: 13, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "monospace",
                }}>!</span>
                <span style={{ color: "var(--warning-text)", fontWeight: 600 }}>
                  RVM 048-2024: {ccSinSustentar} estudiante{ccSinSustentar !== 1 ? "s" : ""} con nota C en 2 bimestres consecutivos sin sustento en la conclusión.
                </span>
                <span style={{ fontSize: 11, color: "var(--warning-text)", fontStyle: "italic" }}>
                  Docente debe explicar por qué no hay avance (≥40 caracteres en cada bimestre).
                </span>
              </div>
            )}
            {/* Banner RVM 048-2024: conclusiones faltantes */}
            {conclusionesFaltantes > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                background: "var(--danger-bg-subtle)", border: "1px solid var(--danger-border-subtle)",
                borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 13,
              }}>
                <span style={{
                  background: "var(--danger-text)", color: "var(--danger-bg-subtle)", borderRadius: "50%",
                  width: 22, height: 22, fontSize: 12, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>!</span>
                <span style={{ color: "var(--danger-text)", fontWeight: 600 }}>
                  RVM 048-2024: {conclusionesFaltantes} nota{conclusionesFaltantes !== 1 ? "s" : ""} con NL que requiere{conclusionesFaltantes !== 1 ? "n" : ""} conclusión descriptiva obligatoria y aún no la tiene{conclusionesFaltantes !== 1 ? "n" : ""}.
                </span>
                <span style={{ fontSize: 11, color: "var(--danger-text)", fontStyle: "italic" }}>
                  Click en la celda con "!" → panel → escribe ≥20 caracteres
                </span>
              </div>
            )}
            {/* Banner de sugerencias */}
            {sugerenciasPendientes.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                background: sugerenciasRiesgo.length > 0 ? "var(--warning-bg-subtle)" : "var(--info-bg-subtle)",
                border: `1px solid ${sugerenciasRiesgo.length > 0 ? "var(--warning-border-subtle)" : "color-mix(in srgb, var(--info-text) 45%, transparent)"}`,
                borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13,
              }}>
                <span style={{ color: sugerenciasRiesgo.length > 0 ? "var(--warning-text)" : "var(--info-text)", fontWeight: 600 }}>
                  {sugerenciasRiesgo.length > 0
                    ? `${sugerenciasRiesgo.length} estudiantes con riesgo B/C según historial`
                    : `${sugerenciasPendientes.length} celdas con sugerencia del historial`}
                </span>
                <button
                  onClick={() => setMostrarSugerencias(v => !v)}
                  style={{
                    padding: "3px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    border: "1px solid color-mix(in srgb, var(--info-text) 45%, transparent)", background: mostrarSugerencias ? "var(--info-bg-subtle)" : "transparent",
                    color: "var(--info-text)", fontWeight: mostrarSugerencias ? 700 : 400,
                  }}>
                  {mostrarSugerencias ? "Ocultar" : "Ver"} sugerencias
                </button>
                {mostrarSugerencias && (
                  <button
                    onClick={aplicarTodasSugerencias}
                    style={{ padding: "3px 12px", borderRadius: 6, border: "1px solid var(--info-text)", background: "var(--info-text)", color: "var(--info-bg-subtle)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    Aplicar todas
                  </button>
                )}
              </div>
            )}
            {cargando ? <Cargando inline /> : estudiantes.length === 0 ? (
              <p style={{ color: "var(--slate-500)", fontSize: 13 }}>No hay estudiantes en esta sección.</p>
            ) : (
              <>
                <div style={{ overflowX: "auto", marginBottom: 12 }}>
                  <table className="tabla-incidencias" style={{ minWidth: 400, userSelect: "none" }}>
                    <thead>
                      {(() => {
                        const anyExpanded = Array.from({ length: numComp }, (_, i) => expandedComps.has(i)).some(Boolean);
                        return (
                          <>
                            <tr>
                              <th rowSpan={anyExpanded ? 2 : 1} style={{ width: 28 }}>#</th>
                              <th rowSpan={anyExpanded ? 2 : 1} style={{ width: 120 }}>Cód.</th>
                              <th rowSpan={anyExpanded ? 2 : 1}>Nombres</th>
                              {Array.from({ length: numComp }, (_, i) => {
                                const cneb = competenciasCNEB[i];
                                const nombre = cneb?.nombre ?? compNombres[i] ?? "";
                                const desemps = [...(cneb?.desempenos ?? [])].sort((a, b) => a.orden - b.orden);
                                const expanded = expandedComps.has(i);
                                return (
                                  <th key={`ch${i}`}
                                    colSpan={expanded ? 1 + desemps.length : 1}
                                    rowSpan={expanded ? 1 : (anyExpanded ? 2 : 1)}
                                    style={{ width: 100, textAlign: "center", background: "var(--azul-50)", verticalAlign: "middle", padding: "6px 4px", borderLeft: expanded ? "2px solid var(--azul-300)" : undefined }}
                                    title={nombre || undefined}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                                      <span style={{ fontWeight: 700, fontSize: 12 }}>C{i + 1}</span>
                                      {desemps.length > 0 && (
                                        <button
                                          onClick={() => setExpandedComps(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                                          title={expanded ? "Ocultar desempeños" : "Ver desempeños como sub-columnas"}
                                          style={{ fontSize: 9, border: "1px solid var(--azul-300)", borderRadius: 3, background: expanded ? "var(--azul-200)" : "transparent", color: "var(--azul-600)", cursor: "pointer", padding: "0 3px", lineHeight: "14px" }}
                                        >{expanded ? "▲" : `▼ ${desemps.length}`}</button>
                                      )}
                                    </div>
                                    {cneb ? (
                                      <div style={{ fontSize: 9, color: "var(--azul-700)", fontWeight: 500, lineHeight: 1.3, marginTop: 2, maxHeight: 36, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                                        {nombre}
                                      </div>
                                    ) : (
                                      <input value={nombre}
                                        onChange={(e) => { const n = [...compNombres]; n[i] = e.target.value; setCompNombres(n); }}
                                        onBlur={() => asigSeleccionada && localStorage.setItem(`comp_nombres_${asigSeleccionada.id}`, JSON.stringify(compNombres))}
                                        placeholder="competencia..." title="Nombre de la competencia"
                                        style={{ width: "100%", border: "none", borderBottom: "1px dashed var(--borde)", background: "transparent", fontSize: 9, color: "var(--texto-mute)", textAlign: "center", outline: "none", padding: "2px 2px 1px", fontWeight: 400 }}
                                      />
                                    )}
                                  </th>
                                );
                              })}
                              <th rowSpan={anyExpanded ? 2 : 1}
                                title="Consolidado: moda de NL + calificativo oficial RVM 048-2024 (escala 2.5-10)"
                                style={{ width: 78, textAlign: "center", background: "var(--slate-100)", fontSize: 12, fontWeight: 700 }}
                              >
                                Consol.
                                <div style={{ fontSize: 8, fontWeight: 500, opacity: 0.65, marginTop: 2 }}>NL · Calif</div>
                              </th>
                            </tr>
                            {anyExpanded && (
                              <tr>
                                {Array.from({ length: numComp }, (_, i) => {
                                  const cneb = competenciasCNEB[i];
                                  const desemps = [...(cneb?.desempenos ?? [])].sort((a, b) => a.orden - b.orden);
                                  if (!expandedComps.has(i) || desemps.length === 0) return null;
                                  // Primer sub-header vacío para alinear con la celda "main C1"
                                  const headers = [
                                    <th key={`mainph${i}`}
                                      style={{ width: 46, textAlign: "center", background: "var(--azul-100)", fontSize: 10, padding: "4px 3px", fontWeight: 700, color: "var(--azul-700)", verticalAlign: "middle" }}
                                      title="Nota final por moda de desempeños"
                                    >
                                      Σ
                                    </th>,
                                  ];
                                  desemps.forEach(des => headers.push(
                                    <th key={`dph${i}_${des.id}`}
                                      style={{ width: 46, textAlign: "center", background: "#ECFDF5", fontSize: 10, padding: "4px 3px", fontWeight: 700, color: "#065F46", verticalAlign: "middle", borderLeft: "1px dashed #6EE7B7" }}
                                      title={des.descripcion}
                                    >
                                      D{des.orden}
                                    </th>
                                  ));
                                  return headers;
                                }).flat().filter(Boolean)}
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </thead>
                    <tbody>
                      {estudiantes.map((est, idx) => {
                        // ¿Tiene al menos una sugerencia B o C en alguna competencia?
                        const sugsEst = Array.from({ length: numComp }, (_, ci) => sugerencias.get(`${est.id}_${ci + 1}`));
                        const tieneRiesgo = sugsEst.some(s => s && (s.sugerencia === "B" || s.sugerencia === "C") && !notasMap.get(`${est.id}_${sugsEst.indexOf(s) + 1}`)?.calificacion);
                        return (
                        <tr key={est.id} style={{
                          background: panel?.estudianteId === est.id ? "var(--azul-50)" : undefined,
                        }}>
                          <td style={{ textAlign: "center", color: "var(--slate-400)", fontSize: 12 }}>{idx + 1}</td>
                          <td><code style={{ fontSize: 11 }}>{est.codigo_matricula || est.dni}</code></td>
                          <td
                            style={{ fontWeight: 500, fontSize: 13, cursor: "pointer", color: tieneRiesgo ? "#B45309" : "var(--azul-700)" }}
                            onClick={() => setPanel({ estudianteId: est.id, competencia: 1 })}
                            title={tieneRiesgo ? "Estudiante con sugerencias B o C — requiere atención" : "Click para editar conclusión"}
                          >
                            {tieneRiesgo && <span style={{ marginRight: 4 }} title="Sugerencia B/C">⚠️</span>}
                            {est.nombre_completo || est.nombre}
                            {badgeIngresoMitadAnio(est.fecha_ingreso) && (
                              <span style={{
                                marginLeft: 6, fontSize: 10, fontWeight: 600,
                                background: "var(--warning-bg-subtle)", color: "var(--warning-text)",
                                border: "1px solid var(--warning-border-subtle)", borderRadius: 4,
                                padding: "1px 5px", verticalAlign: "middle",
                              }} title={`Fecha de ingreso: ${est.fecha_ingreso}`}>
                                {badgeIngresoMitadAnio(est.fecha_ingreso)}
                              </span>
                            )}
                          </td>
                          {Array.from({ length: numComp }, (_, ci) => {
                            const comp = ci + 1;
                            const key: CeldaKey = `${est.id}_${comp}`;
                            const nota = notasMap.get(key);
                            const nl = nota?.calificacion ?? "";
                            const valNum = nota?.calificacion_numerica;
                            const modified = editado.has(key);
                            const activo = panel?.estudianteId === est.id && panel.competencia === comp;
                            const enSeleccion = seleccionadas.has(key);
                            const colores = nl ? NL_COLOR[nl] : undefined;
                            const expanded = expandedComps.has(ci);
                            const desemps = [...(competenciasCNEB[ci]?.desempenos ?? [])].sort((a, b) => a.orden - b.orden);
                            const desEst = desEstados.get(key) ?? {};

                            const DES_COLOR = NL_COLOR;

                            const cells = [
                              <td
                                key={`g${ci}`}
                                data-row={idx}
                                data-col={ci}
                                onMouseDown={(e) => {
                                  if (soloLectura) return;
                                  if (e.button !== 0) return;
                                  if (e.shiftKey || e.ctrlKey || e.metaKey) return;
                                  // Anchor + iniciar drag potencial
                                  setSeleccionadas(new Set([key]));
                                  dragAnchorRef.current = { row: idx, col: ci };
                                  dragStartRef.current = { x: e.clientX, y: e.clientY };
                                  capDragRef.current = null;
                                  isDraggingRef.current = true;
                                  didDragRef.current = false;
                                }}
                                onClick={(e) => {
                                  if (soloLectura) return;
                                  if (didDragRef.current) { didDragRef.current = false; return; }
                                  // Shift+Click = rango desde la última celda anclada
                                  if (e.shiftKey && seleccionadas.size > 0) {
                                    const anchorKey = [...seleccionadas][0];
                                    const [ancEstId, ancComp] = anchorKey.split("_").map(Number);
                                    const ancRow = estudiantes.findIndex(x => x.id === ancEstId);
                                    if (ancRow < 0) { setDebugLast(`shift: anchor no encontrado`); return; }
                                    const r1 = Math.min(ancRow, idx), r2 = Math.max(ancRow, idx);
                                    const c1 = Math.min(ancComp - 1, ci), c2 = Math.max(ancComp - 1, ci);
                                    const newSel = new Set<CeldaKey>();
                                    for (let r = r1; r <= r2; r++)
                                      for (let c = c1; c <= c2; c++)
                                        if (estudiantes[r]) newSel.add(`${estudiantes[r].id}_${c + 1}` as CeldaKey);
                                    setSeleccionadas(newSel);
                                    setDebugLast(`shift: rango ${r1}-${r2} × ${c1}-${c2} = ${newSel.size} celdas`);
                                    return;
                                  }
                                  // Ctrl+Click = toggle
                                  if (e.ctrlKey || e.metaKey) {
                                    setSeleccionadas(prev => {
                                      const n = new Set(prev);
                                      if (n.has(key)) n.delete(key); else n.add(key);
                                      setDebugLast(`ctrl: toggle → sel=${n.size}`);
                                      return n;
                                    });
                                    return;
                                  }
                                  // Click simple: si había selección múltiple, colapsar; si no, ciclar
                                  if (seleccionadas.size > 1) {
                                    setSeleccionadas(new Set([key]));
                                    setDebugLast(`click: colapso selección múltiple`);
                                    return;
                                  }
                                  if (modoInput === "panel" || escala === "numerica") {
                                    setPanel({ estudianteId: est.id, competencia: comp });
                                  } else {
                                    ciclarNL(est.id, comp);
                                  }
                                }}
                                style={(() => {
                                  const alertaCC = cConsecutiva.get(`${est.id}_${comp}_${bimestre}`);
                                  const necesitaSustento = nl === "C" && alertaCC && !alertaCC.sustentado;
                                  return {
                                    textAlign: "center", cursor: soloLectura ? "default" : "pointer",
                                    background: enSeleccion ? "var(--azul-100)" : activo ? "var(--azul-200)" : (colores?.bg ?? "var(--fondo)"),
                                    outline: enSeleccion ? "2px solid var(--azul-500)" :
                                      necesitaSustento ? "3px solid #F97316" :
                                      modified ? "2px solid var(--azul-400)" :
                                      activo ? "2px solid var(--azul-600)" : "none",
                                    outlineOffset: -2, transition: "background .1s", padding: "6px 4px",
                                    boxShadow: necesitaSustento ? "0 0 0 1px #F97316 inset" : undefined,
                                  } as React.CSSProperties;
                                })()}
                              >
                                {escala === "numerica" ? (
                                  <span style={{ fontWeight: 700, fontSize: 13, color: colores?.text ?? "var(--muted-foreground)" }}>
                                    {valNum != null ? valNum : "—"}
                                    {nl && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>({nl})</span>}
                                  </span>
                                ) : nl ? (
                                  <span style={{ position: "relative", display: "inline-block" }}>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: colores?.text ?? "var(--slate-400)" }}>{nl}</span>
                                    {requiereConclusion(nl) && !(nota?.conclusion_descriptiva && nota.conclusion_descriptiva.trim().length >= 20) && (
                                      <span
                                        title="RVM 048-2024: conclusión descriptiva obligatoria para este nivel de logro"
                                        style={{
                                          position: "absolute", top: -8, right: -10,
                                          background: "#EF4444", color: "white", borderRadius: "50%",
                                          width: 14, height: 14, fontSize: 9, fontWeight: 700,
                                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                                          cursor: "help",
                                        }}
                                      >!</span>
                                    )}
                                  </span>
                                ) : (() => {
                                  const sug = mostrarSugerencias ? sugerencias.get(key) : undefined;
                                  if (!sug) return <span style={{ fontWeight: 700, fontSize: 14, color: "var(--slate-300)" }}>—</span>;
                                  const sugCol = NL_COLOR[sug.sugerencia];
                                  const tendIcon = sug.tendencia === "mejorando" ? "↑" : sug.tendencia === "bajando" ? "↓" : "→";
                                  return (
                                    <span
                                      title={`Sugerencia: ${sug.sugerencia} (${sug.base}) · ${sug.tendencia} ${tendIcon}\nClick para aceptar`}
                                      onClick={(e) => { e.stopPropagation(); aceptarSugerencia(key); }}
                                      style={{ fontWeight: 700, fontSize: 14, color: sugCol.text, opacity: 0.4, border: `1.5px dashed ${sugCol.text}`, borderRadius: 4, padding: "1px 6px", cursor: "pointer", display: "inline-block", transition: "opacity .15s" }}
                                      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}
                                    >
                                      {sug.sugerencia}<span style={{ fontSize: 8, marginLeft: 2, opacity: 0.8 }}>{tendIcon}</span>
                                    </span>
                                  );
                                })()}
                              </td>,
                            ];

                            if (expanded && desemps.length > 0) {
                              desemps.forEach(des => {
                                const desNl = desEst[des.id] ?? "";
                                const desCol = desNl ? DES_COLOR[desNl] : undefined;
                                const desSelKey = `${est.id}_${comp}_${des.id}`;
                                const desEnSel = capSeleccionadas.has(desSelKey);
                                const desSug = !desNl ? desSugerencias.get(`${est.id}_${des.id}`) : undefined;
                                const sugCol = desSug ? DES_COLOR[desSug] : undefined;
                                cells.push(
                                  <td key={`des${ci}_${des.id}`}
                                    data-row={idx}
                                    data-cap-comp={comp}
                                    data-cap-id={des.id}
                                    title={`D${des.orden}: ${des.descripcion}${desSug ? ` · sugerencia histórica: ${desSug}` : ""}`}
                                    onMouseDown={(e) => {
                                      if (e.button !== 0) return;
                                      if (e.shiftKey || e.ctrlKey || e.metaKey) return;
                                      setCapSeleccionadas(new Set([desSelKey]));
                                      dragAnchorRef.current = { row: idx, col: 0 };
                                      dragStartRef.current = { x: e.clientX, y: e.clientY };
                                      capDragRef.current = { capComp: comp, capId: des.id };
                                      isDraggingRef.current = true;
                                      didDragRef.current = false;
                                    }}
                                    onClick={() => {
                                      if (didDragRef.current) { didDragRef.current = false; return; }
                                      if (capSeleccionadas.size > 1) return;
                                      if (escala === "numerica") {
                                        // En numérica el input es 0-20, no cicla — abre panel para editar
                                        setPanel({ estudianteId: est.id, competencia: comp });
                                      } else {
                                        const idx2 = CICLO_NL.indexOf(desNl);
                                        const next = CICLO_NL[(idx2 + 1) % CICLO_NL.length];
                                        setDesEstado(est.id, comp, des.id, next);
                                      }
                                    }}
                                    style={{
                                      textAlign: "center", cursor: "pointer", padding: "6px 3px",
                                      background: desEnSel ? "var(--azul-100)" : (desCol?.bg ?? "var(--success-bg-subtle)"),
                                      outline: desEnSel ? "2px solid var(--azul-500)" : "none",
                                      outlineOffset: -2,
                                      borderLeft: "1px dashed color-mix(in srgb, var(--success-text) 45%, transparent)",
                                      transition: "background .1s",
                                    }}>
                                    <span style={{
                                      fontWeight: desNl ? 700 : 600, fontSize: 13,
                                      color: desEnSel ? "var(--azul-700)" : (desCol?.text ?? (desSug ? sugCol?.text : "var(--success-text)")),
                                      opacity: !desNl && desSug ? 0.5 : 1,
                                      fontStyle: !desNl && desSug ? "italic" : "normal",
                                    }}>
                                      {desNl || desSug || "—"}
                                    </span>
                                  </td>
                                );
                              });
                            }
                            return cells;
                          }).flat()}
                          {(() => {
                            const consol = consolidadoEstudiante(est.id);
                            const calif = calificativoArea(est.id);
                            const col = consol ? NL_COLOR[consol] : undefined;
                            return (
                              <td
                                title={calif !== null ? `Calificativo oficial del área: ${calif.toFixed(2)} (escala 2.5-10 según RVM 048-2024)` : undefined}
                                style={{
                                  textAlign: "center", fontWeight: 700, fontSize: 14,
                                  background: col?.bg ?? "var(--slate-50)",
                                  color: col?.text ?? "var(--slate-400)",
                                  borderLeft: "2px solid var(--borde)",
                                  padding: "4px 2px",
                                }}
                              >
                                <div>{consol || "—"}</div>
                                {calif !== null && (
                                  <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.75, marginTop: 2 }}>
                                    {calif.toFixed(2)}
                                  </div>
                                )}
                              </td>
                            );
                          })()}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Selección múltiple — competencias */}
                {seleccionadas.size > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: "var(--azul-50)", borderRadius: 8, border: "1px solid var(--azul-200)" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--azul-700)" }}>{seleccionadas.size} celdas seleccionadas — Aplicar:</span>
                    {CICLO_NL.map(nl => {
                      const col = NL_COLOR[nl];
                      return (
                        <button key={nl} onClick={() => aplicarASeleccion(nl)} style={{
                          padding: "4px 14px", borderRadius: 6, border: `2px solid ${col.text}`,
                          background: col.bg, color: col.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
                        }}>{nl}</button>
                      );
                    })}
                    <button onClick={() => setSeleccionadas(new Set())} style={{ marginLeft: 4, fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                      ✕ Cancelar
                    </button>
                  </div>
                )}
                {/* Selección múltiple — capacidades */}
                {capSeleccionadas.size > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", background: "var(--success-bg-subtle)", borderRadius: 8, border: "1px solid color-mix(in srgb, var(--success-text) 45%, transparent)" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success-text)" }}>{capSeleccionadas.size} desempeños seleccionados — Aplicar:</span>
                    {CICLO_NL.map(nl => {
                      const col = NL_COLOR[nl];
                      return (
                        <button key={nl} onClick={() => aplicarACapSeleccion(nl)} style={{
                          padding: "4px 14px", borderRadius: 6, border: `2px solid ${col.text}`,
                          background: col.bg, color: col.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
                        }}>{nl}</button>
                      );
                    })}
                    <button onClick={() => setCapSeleccionadas(new Set())} style={{ marginLeft: 4, fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                      ✕ Cancelar
                    </button>
                  </div>
                )}

                {/* Leyenda + guardar */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {!soloLectura && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button className="btn btn-primario" onClick={guardar}
                        disabled={!editado.size || guardando} style={{ width: "auto" }}>
                        {guardando ? "Guardando..." : `Guardar${editado.size ? ` (${editado.size})` : ""}`}
                      </button>
                      {editado.size > 0 && !guardando && (
                        <span style={{ fontSize: 11, color: "var(--amarillo-600)", fontWeight: 600 }}>
                          ● guardando en {4}s…
                        </span>
                      )}
                      {!editado.size && autoGuardadoTs && (
                        <span style={{ fontSize: 11, color: "var(--verde-600)" }}>
                          ✓ guardado automáticamente
                        </span>
                      )}
                    </div>
                  )}
                  {["AD","A","B","C"].map(nl => (
                    <span key={nl} style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 10,
                      background: NL_COLOR[nl].bg, color: NL_COLOR[nl].text, fontWeight: 600,
                    }}>{nl}</span>
                  ))}
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {modoSimple
                      ? "Toca una celda para cambiar AD→A→B→C. Toca el nombre para escribir la conclusión."
                      : modoInput === "ciclar"
                        ? "Click → cicla AD→A→B→C · Shift+Click → rango · Ctrl+Click → agregar/quitar · Arrastrar → selección · Click en nombre → panel"
                        : "Click → abre panel · Shift+Click → rango · Ctrl+Click → agregar/quitar · Arrastrar → selección"}
                  </span>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Excel */}
        <Card titulo={modoSimple ? "3. Reportes y SIAGIE" : "Excel — Plantilla / Importar / SIAGIE / Boletas"}>
          {esDirector && asigSeleccionada && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              background: estadoPublicacion === "publicado" ? "var(--success-bg-subtle)" : "var(--warning-bg-subtle)",
              border: `1px solid ${estadoPublicacion === "publicado" ? "color-mix(in srgb, var(--success-text) 35%, transparent)" : "var(--warning-border-subtle)"}`,
              borderRadius: 10, padding: 12, marginBottom: 12, flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: estadoPublicacion === "publicado" ? "var(--success-text)" : "var(--warning-text)" }}>
                  {estadoPublicacion === "publicado" ? "Notas visibles para familias" : "Notas en borrador interno"}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                  Sección {asigSeleccionada.seccion_nombre} · Bimestre {bimestre}. Padres y estudiantes solo ven notas/boletas cuando esté publicado.
                </div>
              </div>
              <button
                className={estadoPublicacion === "publicado" ? "btn btn-secundario" : "btn btn-primario"}
                onClick={() => cambiarPublicacionNotas(estadoPublicacion === "publicado" ? "borrador" : "publicado")}
                disabled={publicandoNotas}
                style={{ width: "auto", fontSize: 12, padding: "7px 12px" }}
              >
                {publicandoNotas
                  ? "Actualizando..."
                  : estadoPublicacion === "publicado" ? "Ocultar a familias" : "Publicar para familias"}
              </button>
            </div>
          )}
          {modoSimple && (
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.6 }}>
              Flujo seguro con SIAGIE: descarga el Excel oficial desde SIAGIE, súbelo aquí para leer o rellenar datos, y descarga el archivo listo para cargarlo nuevamente en SIAGIE.
            </p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            {!modoSimple && <button className="btn btn-secundario" onClick={descargarTemplate}
              disabled={!asigSeleccionada} style={{ width: "auto" }}>
              ↓ Plantilla Excel
            </button>}
            {asigSeleccionada && (
              <button className="btn btn-secundario btn-icono" onClick={descargarBoletasSeccion}
                style={{ width: "auto" }}
                title={`Generar boletas PDF de ${asigSeleccionada.seccion_nombre} — Bimestre ${bimestre}`}>
                <Icon name="pdf" size={13} /> Boletas B{bimestre}
              </button>
            )}
            {!modoSimple && asigSeleccionada && (
              <button className="btn btn-secundario btn-icono" onClick={descargarLibretaAnual}
                style={{ width: "auto" }}
                title={`Libreta anual de ${asigSeleccionada.seccion_nombre} — todos los bimestres`}>
                <Icon name="pdf" size={13} /> Libreta anual
              </button>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              {modoSimple && <span style={{ flexBasis: "100%", fontSize: 12, fontWeight: 600 }}>Importar notas desde Excel/SIAGIE</span>}
              <input type="file" accept=".xlsx" className="form-input" style={{ fontSize: 12 }}
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              <button className="btn btn-primario" onClick={subirExcel}
                disabled={!archivo || enviando} style={{ width: "auto" }}>
                {enviando ? "Subiendo..." : modoSimple ? "Leer y cargar" : "↑ Subir Excel"}
              </button>
            </div>
          </div>
          {!modoSimple && <div style={{ borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
            <p style={{ fontSize: 12, color: "var(--slate-500)", marginBottom: 8 }}>
              Exportar al formato SIAGIE (Excel del sistema):
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["1","2","3","4"].map((b) => (
                <button key={b} className="btn btn-secundario" onClick={() => exportarSIAGIE(b)}
                  style={{ padding: "6px 12px", width: "auto", fontSize: 12 }}>
                  B{b}
                </button>
              ))}
              <button className="btn btn-secundario" onClick={() => exportarSIAGIE()}
                style={{ padding: "6px 12px", width: "auto", fontSize: 12 }}>
                Todo
              </button>
            </div>
          </div>}
          <div style={{ borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
            <p style={{ fontSize: 12, color: "var(--slate-500)", marginBottom: 4 }}>
              {modoSimple ? "Preparar Excel oficial para SIAGIE:" : "Rellenar template oficial de SIAGIE:"}
            </p>
            <p style={{ fontSize: 11, color: "var(--slate-500)", marginBottom: 8, fontStyle: "italic" }}>
              Sube el Excel oficial que descargaste de SIAGIE; EduMWork detecta sus columnas, lo rellena con tus notas y te devuelve el mismo archivo listo para cargar.
            </p>
            <button className={modoSimple ? "btn btn-primario" : "btn btn-secundario"} onClick={() => setModalSiagieTemplate(true)}
              style={{ padding: "6px 12px", width: "auto", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <FileSpreadsheet size={13} /> {modoSimple ? "Preparar Excel SIAGIE" : "Subir template SIAGIE"}
            </button>
            {modoSimple && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted-foreground)" }}>
                Para exportar por bimestre, libreta anual o plantilla interna, cambia a modo Completo.
              </div>
            )}
          </div>
          {resultado && (
            <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
              <span style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="check" size={13} style={{ color: "var(--verde-600)" }} /> {resultado.creadas} creadas</span>
              <span style={{ fontSize: 13 }}>↺ {resultado.actualizadas} actualizadas</span>
              {resultado.errores.length > 0 && (
                <span style={{ fontSize: 13, color: "var(--rojo-600)", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="alerta" size={13} /> {resultado.errores.length} errores</span>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Panel lateral de conclusión */}
      {panel && panelEstudiante && panelNota && (
        <PanelConclusion
          estudiante={panelEstudiante}
          competencia={panel.competencia}
          competenciaNombre={competenciasCNEB[panel.competencia - 1]?.nombre}
          capacidades={competenciasCNEB[panel.competencia - 1]?.capacidades}
          desempenos={competenciasCNEB[panel.competencia - 1]?.desempenos}
          capEstados={capEstados.get(`${panel.estudianteId}_${panel.competencia}`) ?? {}}
          desEstados={desEstados.get(`${panel.estudianteId}_${panel.competencia}`) ?? {}}
          desSugerencias={desSugerencias}
          capSugerencias={capSugerencias}
          estudianteId={panel.estudianteId}
          onCapEstado={(capId, estado) => setCapEstado(panel.estudianteId, panel.competencia, capId, estado)}
          onDesEstado={(desId, estado) => setDesEstado(panel.estudianteId, panel.competencia, desId, estado)}
          nota={panelNota}
          escala={escala}
          seccionId={asigSeleccionada!.seccion_id}
          bimestre={bimestre}
          area={areaActual}
          compNombres={compNombres}
          onNL={(nl) => setNL(panel.estudianteId, panel.competencia, nl)}
          onConclusion={(t) => setConclusion(panel.estudianteId, panel.competencia, t)}
          onCerrar={() => setPanel(null)}
          onAnterior={panelIdx > 0 ? () => setPanel({ estudianteId: estudiantes[panelIdx - 1].id, competencia: panel.competencia }) : undefined}
          onSiguiente={panelIdx < estudiantes.length - 1 ? () => setPanel({ estudianteId: estudiantes[panelIdx + 1].id, competencia: panel.competencia }) : undefined}
          hayEditado={editado.has(`${panel.estudianteId}_${panel.competencia}`)}
        />
      )}
      {modalSiagieTemplate && (
        <SiagieRellenarModal
          onCerrar={() => setModalSiagieTemplate(false)}
          secciones={Array.from(
            new Map(asignaciones.map(a => [a.seccion_id, { id: a.seccion_id, nombre: a.seccion_nombre }])).values()
          )}
          area={areaActual}
          numCompetencias={numComp}
          competencias={competenciasCNEB.map(c => ({ numero: c.numero, nombre: c.nombre }))}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ PANEL LATERAL ═══ */
interface PanelProps {
  estudiante: Estudiante;
  competencia: number;
  competenciaNombre?: string;
  capacidades?: { id: number; nombre: string; orden: number }[];
  desempenos?: { id: number; descripcion: string; orden: number }[];
  capEstados: Record<number, string>;
  desEstados: Record<number, string>;
  desSugerencias: Map<string, string>;
  capSugerencias: Map<string, string>;
  estudianteId: number;
  onCapEstado: (capId: number, estado: string) => void;
  onDesEstado: (desId: number, estado: string) => void;
  nota: Nota;
  escala: "letras" | "numerica";
  seccionId: number;
  bimestre: string;
  area: string;
  compNombres: string[];
  onNL: (val: string) => void;
  onConclusion: (t: string) => void;
  onCerrar: () => void;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  hayEditado: boolean;
}

function PanelConclusion({ estudiante, competencia, competenciaNombre, capacidades, desempenos, capEstados, desEstados, desSugerencias, capSugerencias, estudianteId, onCapEstado, onDesEstado, nota, escala, seccionId, bimestre, area, compNombres, onNL, onConclusion, onCerrar, onAnterior, onSiguiente, hayEditado }: PanelProps) {
  const [mostrarDesemps, setMostrarDesemps] = useState(true);
  void capEstados; void onCapEstado; void capSugerencias;  // ya no se usan (capacidades read-only)
  const nl = nota.calificacion;
  const colores = nl ? NL_COLOR[nl] : null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [generandoIA, setGenerandoIA] = useState(false);
  const toast = useToast();

  useEffect(() => { textareaRef.current?.focus(); }, [estudiante.id, competencia]);

  async function generarConIA() {
    if (!nl) { toast.error("Selecciona un nivel de logro primero."); return; }
    setGenerandoIA(true);
    try {
      const nombresActivos = compNombres.filter(n => n.trim());
      const { data } = await api.post<{ ok?: boolean; conclusion?: string; sin_config?: boolean; error?: string }>(
        "/notas/conclusiones-ia/",
        { seccion_id: seccionId, bimestre, estudiante_id: estudiante.id, ...(nombresActivos.length ? { comp_nombres: compNombres } : {}) }
      );
      if (data.sin_config) {
        toast.error("Sin IA configurada. El director debe configurar la API en Administración → Configurar IA.");
      } else if (data.conclusion) {
        onConclusion(data.conclusion);
        toast.ok("Conclusión generada con IA.");
      } else if (data.error) {
        toast.error(data.error);
      } else {
        // fallback: fetch updated nota
        const res = await api.get<{results?: Nota[]} | Nota[]>(
          `/notas/?seccion=${seccionId}&area=${encodeURIComponent(area)}&bimestre=${bimestre}&limit=50`
        );
        const notas: Nota[] = Array.isArray(res.data) ? res.data : ((res.data as {results?: Nota[]}).results ?? []);
        const updated = notas.find(n => n.estudiante === estudiante.id && n.competencia === 1);
        if (updated?.conclusion_descriptiva) {
          onConclusion(updated.conclusion_descriptiva);
          toast.ok("Conclusión generada con IA.");
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; sin_config?: boolean } } };
      if (err.response?.data?.sin_config) {
        toast.error("Sin IA configurada. El director debe configurar la API en Administración → Configurar IA.");
      } else {
        toast.error(err.response?.data?.error ?? "Error al generar con IA.");
      }
    } finally {
      setGenerandoIA(false);
    }
  }

  return (
    <div style={{
      position: "fixed",
      top: 60, right: 0,
      width: 340,
      height: "calc(100vh - 60px)",
      background: "var(--card)",
      borderLeft: "1px solid var(--borde)",
      boxShadow: "-4px 0 20px rgba(0,0,0,.08)",
      display: "flex",
      flexDirection: "column",
      zIndex: 200,
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--borde)", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {estudiante.nombre_completo || estudiante.nombre}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {competenciaNombre
              ? <span title={competenciaNombre}>C{competencia}: {competenciaNombre.length > 45 ? competenciaNombre.slice(0, 45) + "…" : competenciaNombre}</span>
              : `Competencia ${competencia}`
            }
            {hayEditado && <span style={{ color: "var(--azul-600)" }}> · sin guardar</span>}
          </div>
        </div>
        <button onClick={onCerrar} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--muted-foreground)" }}>
          <X size={16} />
        </button>
      </div>

      {/* NL selector */}
      <div style={{ padding: "16px 16px 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Nivel de logro
        </div>
        {escala === "numerica" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number" min={0} max={20} step={1}
              value={nota.calificacion_numerica ?? ""}
              onChange={(e) => onNL(e.target.value)}
              style={{
                width: 80, height: 48, fontSize: 22, fontWeight: 700, textAlign: "center",
                border: "2px solid var(--borde)", borderRadius: 10,
                background: colores?.bg ?? "var(--fondo)", color: colores?.text ?? "var(--texto)",
              }}
              placeholder="0-20"
            />
            {nl && (
              <div style={{ background: colores?.bg, color: colores?.text, padding: "6px 14px", borderRadius: 20, fontWeight: 700, fontSize: 16 }}>
                {nl}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            {["AD","A","B","C"].map((op) => {
              const col = { AD: { bg: "#D1FAE5", text: "#065F46" }, A: { bg: "#DBEAFE", text: "#1E40AF" }, B: { bg: "#FEF3C7", text: "#92400E" }, C: { bg: "#FEE2E2", text: "#991B1B" } }[op]!;
              const sel = nl === op;
              return (
                <button
                  key={op}
                  onClick={() => onNL(sel ? "" : op)}
                  style={{
                    flex: 1, height: 48, fontSize: 18, fontWeight: 700,
                    border: sel ? `2px solid ${col.text}` : "2px solid var(--borde)",
                    borderRadius: 10, cursor: "pointer",
                    background: sel ? col.bg : "var(--fondo)",
                    color: sel ? col.text : "var(--texto)",
                    transition: "all .1s",
                  }}
                >
                  {op}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Capacidades como texto informativo (no gradeables) */}
      {capacidades && capacidades.length > 0 && (
        <div style={{ padding: "6px 16px 8px", borderBottom: "1px solid var(--borde)", fontSize: 11, color: "var(--muted-foreground)" }}>
          <span style={{ fontWeight: 600 }}>Integra las capacidades: </span>
          {[...capacidades].sort((a, b) => a.orden - b.orden).map((c, i, arr) => (
            <span key={c.id} title={c.nombre}>
              {c.nombre.length > 28 ? c.nombre.slice(0, 28) + "…" : c.nombre}
              {i < arr.length - 1 ? " · " : ""}
            </span>
          ))}
        </div>
      )}


      {/* Desempeños del CNEB — graduables, moda → nota de la competencia */}
      {desempenos && desempenos.length > 0 && (() => {
        const NL_C: Record<string, { bg: string; text: string }> = {
          AD: { bg: "var(--success-bg-subtle)", text: "var(--success-text)" },
          A:  { bg: "var(--info-bg-subtle)", text: "var(--info-text)" },
          B:  { bg: "var(--warning-bg-subtle)", text: "var(--warning-text)" },
          C:  { bg: "var(--danger-bg-subtle)", text: "var(--danger-text)" },
        };
        const sugsConNota = desempenos.filter(d => !desEstados[d.id] && desSugerencias.get(`${estudianteId}_${d.id}`));
        return (
          <div style={{ padding: "6px 16px 10px", borderBottom: "1px solid var(--borde)" }}>
            <button
              onClick={() => setMostrarDesemps(v => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)",
                textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <span>
                Desempeños del CNEB · {desempenos.length}
                {sugsConNota.length > 0 && (
                  <span style={{ marginLeft: 6, background: "var(--warning-bg-subtle)", color: "var(--warning-text)", padding: "1px 6px", borderRadius: 8, fontSize: 9 }}>
                    {sugsConNota.length} sugerencia{sugsConNota.length !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 12 }}>{mostrarDesemps ? "▲" : "▼"}</span>
            </button>
            {mostrarDesemps && (
              <div style={{ maxHeight: 380, overflowY: "auto", background: "var(--fondo-secundario)", borderRadius: 6, padding: "8px 10px" }}>
                {[...desempenos].sort((a, b) => a.orden - b.orden).map(des => {
                  const desVal = desEstados[des.id] ?? "";
                  const sug = desSugerencias.get(`${estudianteId}_${des.id}`);
                  return (
                    <div key={des.id} style={{ marginBottom: 10, background: "var(--bg-panel)", borderRadius: 6, padding: "6px 8px" }}>
                      <div style={{ fontSize: 11, color: "var(--texto)", lineHeight: 1.35, marginBottom: 5, display: "flex", gap: 6 }}>
                        <span style={{ fontWeight: 700, color: "var(--azul-700)", minWidth: 16 }}>{des.orden}.</span>
                        <span>{des.descripcion}</span>
                      </div>
                      {escala === "numerica" ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="number" min={0} max={20} step={1}
                            value={desVal}
                            placeholder={sug ? `sug: ${sug}` : "0-20"}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") { onDesEstado(des.id, ""); return; }
                              const n = Number(v);
                              if (n >= 0 && n <= 20) onDesEstado(des.id, String(n));
                            }}
                            style={{
                              width: 60, padding: "4px 6px", fontSize: 13, fontWeight: 700,
                              textAlign: "center", border: `1.5px solid ${desVal ? "var(--azul-500)" : "var(--borde)"}`,
                              borderRadius: 5, background: desVal ? "var(--azul-50)" : "var(--fondo)",
                            }}
                          />
                          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                            {desVal && Number(desVal) >= 18 ? "AD" :
                             desVal && Number(desVal) >= 14 ? "A" :
                             desVal && Number(desVal) >= 11 ? "B" :
                             desVal ? "C" : ""}
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                          {["AD", "A", "B", "C"].map(op => {
                            const sel = desVal === op;
                            const sugPropuesta = !desVal && sug === op;
                            const c = NL_C[op];
                            return (
                              <button
                                key={op}
                                onClick={() => onDesEstado(des.id, sel ? "" : op)}
                                title={sugPropuesta ? `Sugerencia del histórico (click para aceptar)` : undefined}
                                style={{
                                  flex: 1, fontSize: 11, fontWeight: sel ? 700 : sugPropuesta ? 600 : 500,
                                  padding: "3px 0", borderRadius: 4, cursor: "pointer",
                                  border: `${sel ? 2 : sugPropuesta ? 1.5 : 1}px ${sugPropuesta ? "dashed" : "solid"} ${sel ? c.text : sugPropuesta ? c.text : "var(--borde)"}`,
                                  background: sel ? c.bg : sugPropuesta ? c.bg + "80" : "var(--fondo)",
                                  color: sel ? c.text : sugPropuesta ? c.text : "var(--texto)",
                                  opacity: sugPropuesta ? 0.75 : 1,
                                  transition: "all .1s",
                                }}
                              >
                                {op}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--muted-foreground)", marginTop: 4, textAlign: "right" }}>
                  Fuente: CNEB — MINEDU · {escala === "numerica" ? "Promedio de desempeños → nota" : "Moda de desempeños → nota"}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Conclusión */}
      <div style={{ padding: "8px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Conclusión descriptiva
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
            background: "var(--warning-bg-subtle)", color: "var(--warning-text)",
            textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            plantilla
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={nota.conclusion_descriptiva}
          onChange={(e) => onConclusion(e.target.value)}
          placeholder="Se llenará automáticamente al elegir NL. Puedes editarla o usar IA."
          style={{
            flex: 1, resize: "none", border: "1px solid var(--borde)", borderRadius: 8,
            padding: "10px 12px", fontSize: 13, lineHeight: 1.6,
            background: "var(--fondo)", color: "var(--texto)",
          }}
        />
        <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={generarConIA}
            disabled={generandoIA || !nl}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 10px", fontSize: 12, fontWeight: 600, borderRadius: 6,
              border: "none", cursor: nl && !generandoIA ? "pointer" : "default",
              background: nl && !generandoIA ? "var(--azul-600)" : "var(--muted)",
              color: nl && !generandoIA ? "white" : "var(--muted-foreground)",
              transition: "all .15s",
            }}
          >
            <Sparkles size={12} />
            {generandoIA ? "Generando..." : "Generar con IA"}
          </button>
          {nl && (
            <button
              onClick={() => onConclusion(CONCLUSIONES[nl] ?? "")}
              style={{ fontSize: 11, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ↺ Restaurar plantilla {nl}
            </button>
          )}
        </div>
      </div>

      {/* Navegación */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--borde)", display: "flex", gap: 8 }}>
        <button onClick={onAnterior} disabled={!onAnterior}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 0", border: "1px solid var(--borde)", borderRadius: 8, background: "var(--fondo)", cursor: onAnterior ? "pointer" : "default", opacity: onAnterior ? 1 : 0.4, fontSize: 13 }}>
          <ChevronLeft size={14} /> Anterior
        </button>
        <button onClick={onSiguiente} disabled={!onSiguiente}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "8px 0", border: "1px solid var(--borde)", borderRadius: 8, background: "var(--fondo)", cursor: onSiguiente ? "pointer" : "default", opacity: onSiguiente ? 1 : 0.4, fontSize: 13 }}>
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
