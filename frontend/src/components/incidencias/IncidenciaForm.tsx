import { useEffect, useState } from "react";
import type {
  NuevaIncidencia,
  PrioridadIncidencia,
  TipoIncidencia,
} from "../../types/incidencia";
import { PRIORIDAD_LABEL, TIPO_LABEL } from "../../types/incidencia";
import { crearIncidencia } from "../../services/incidencias";
import { clasificarConIA } from "../../services/ia";
import api from "../../services/api";

interface EstudianteOpt {
  id: number;
  nombre: string;
  seccion: string;
  codigo_matricula: string;
}

interface Props {
  onCreada: () => void;
  onCancelar: () => void;
}

const TIPOS: TipoIncidencia[] = ["proyector", "pc", "red", "pizarra", "impresora", "otro"];
const PRIORIDADES: PrioridadIncidencia[] = ["alta", "media", "baja"];

type Modo = "simple" | "estructurado";

export default function IncidenciaForm({ onCreada, onCancelar }: Props) {
  const [modo, setModo] = useState<Modo>("simple");
  const [texto, setTexto] = useState("");
  const [clasificando, setClasificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [datos, setDatos] = useState<NuevaIncidencia>({
    titulo: "",
    descripcion: "",
    ubicacion: "",
    tipo: "otro",
    prioridad: "media",
    estudiante_afectado: null,
  });
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [estudiantes, setEstudiantes] = useState<EstudianteOpt[]>([]);

  useEffect(() => {
    api.get<EstudianteOpt[]>("/usuarios/estudiantes/lista/")
      .then(({ data }) => setEstudiantes(data))
      .catch((e) => console.warn("[estudiantes]", e));
  }, []);

  function handleFoto(f: File | null) {
    setFoto(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setFotoPreview(url);
    } else {
      setFotoPreview(null);
    }
  }

  async function clasificar() {
    setError(null);
    setAviso(null);
    if (texto.trim().length < 5) {
      setError("Escribe al menos una frase describiendo el problema.");
      return;
    }
    setClasificando(true);
    try {
      const r = await clasificarConIA(texto);
      setDatos({
        titulo: r.titulo,
        descripcion: r.descripcion,
        ubicacion: r.ubicacion,
        tipo: r.tipo as TipoIncidencia,
        prioridad: r.prioridad as PrioridadIncidencia,
      });
      setModo("estructurado");
      setAviso("Revisa los campos extraídos por la IA antes de enviar. Puedes corregir cualquiera.");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "Fallo al consultar la IA. Puedes llenar el formulario manualmente.");
      setModo("estructurado");
    } finally {
      setClasificando(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await crearIncidencia(datos, foto);
      onCreada();
    } catch (err) {
      const anyErr = err as { response?: { data?: unknown } };
      const msg = anyErr.response?.data
        ? JSON.stringify(anyErr.response.data)
        : "Error al crear la incidencia";
      setError(msg);
    } finally {
      setEnviando(false);
    }
  }

  // ── Modo simple: una textarea grande + IA ─────────────────────────────────
  if (modo === "simple") {
    return (
      <div className="incidencia-form">
        <div className="form-hint" style={{ marginBottom: 12 }}>
          Cuenta qué pasó en tus palabras. La IA extraerá los detalles técnicos.
        </div>
        <div className="form-group">
          <label className="form-label">Describe el problema</label>
          <textarea
            className="form-input"
            rows={5}
            placeholder="Ej: El proyector del aula 5A no muestra imagen desde hace dos días. La lámpara parece encendida pero la pantalla queda en negro."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-secundario"
            onClick={() => setModo("estructurado")}
          >
            Llenar manualmente
          </button>
          <button
            type="button"
            className="btn btn-primario"
            onClick={clasificar}
            disabled={clasificando || !texto.trim()}
            style={{ flex: 1, minWidth: 180 }}
          >
            {clasificando ? "Analizando con IA..." : "Continuar (analizar con IA)"}
          </button>
        </div>
      </div>
    );
  }

  // ── Modo estructurado: campos editables (post-clasificación o manual) ─────
  return (
    <form onSubmit={submit} className="incidencia-form">
      {aviso && <div className="form-aviso">{aviso}</div>}

      <div className="form-group">
        <label className="form-label">Título</label>
        <input
          className="form-input"
          type="text"
          value={datos.titulo}
          onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
          required
          maxLength={140}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Descripción</label>
        <textarea
          className="form-input"
          rows={4}
          value={datos.descripcion}
          onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">Ubicación</label>
        <input
          className="form-input"
          type="text"
          placeholder="Ej: Aula 5to A, AIP, Dirección"
          value={datos.ubicacion}
          onChange={(e) => setDatos({ ...datos, ubicacion: e.target.value })}
          required
        />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Tipo</label>
          <select
            className="form-input"
            value={datos.tipo}
            onChange={(e) => setDatos({ ...datos, tipo: e.target.value as TipoIncidencia })}
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>{TIPO_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">Prioridad</label>
          <select
            className="form-input"
            value={datos.prioridad}
            onChange={(e) =>
              setDatos({ ...datos, prioridad: e.target.value as PrioridadIncidencia })
            }
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">
          Estudiante involucrado <span style={{ fontWeight: 400, color: "var(--texto-mute)" }}>(opcional)</span>
        </label>
        <select
          className="form-input"
          value={datos.estudiante_afectado ?? ""}
          onChange={(e) => setDatos({ ...datos, estudiante_afectado: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">— Ninguno —</option>
          {estudiantes.map((est) => (
            <option key={est.id} value={est.id}>
              {est.nombre} · {est.seccion}
            </option>
          ))}
        </select>
        <div className="form-hint" style={{ fontSize: 11, marginTop: 4 }}>
          Si un estudiante estuvo involucrado en el problema, sus padres podrán ver esta incidencia en su panel.
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Foto del problema (opcional)</label>
        <input
          className="form-input"
          type="file"
          accept="image/*"
          onChange={(e) => handleFoto(e.target.files?.[0] ?? null)}
        />
        {fotoPreview && (
          <div style={{ marginTop: 8 }}>
            <img
              src={fotoPreview}
              alt="Vista previa"
              style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, border: "1px solid var(--borde)" }}
            />
            <button
              type="button"
              className="btn-mini"
              style={{ marginTop: 6 }}
              onClick={() => handleFoto(null)}
            >
              Quitar foto
            </button>
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="btn btn-secundario"
          onClick={() => setModo("simple")}
        >
          Volver al modo simple
        </button>
        <button type="button" className="btn btn-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primario" disabled={enviando} style={{ flex: 1 }}>
          {enviando ? "Enviando..." : "Reportar incidencia"}
        </button>
      </div>
    </form>
  );
}
