import { useMemo, useState } from "react";
import type { Incidencia } from "../../types/incidencia";
import { PRIORIDAD_LABEL, TIPO_LABEL } from "../../types/incidencia";
import EstadoBadge from "./EstadoBadge";

interface Props {
  incidencias: Incidencia[];
  onSeleccionar?: (inc: Incidencia) => void;
  mostrarReportadoPor?: boolean;
}

type OrdenClave = "id" | "titulo" | "ubicacion" | "tipo" | "prioridad" | "estado" | "creado_en";
type OrdenDir = "asc" | "desc";

const PRIORIDAD_PESO: Record<string, number> = { alta: 0, media: 1, baja: 2 };
const ESTADO_PESO: Record<string, number> = { nueva: 0, en_atencion: 1, resuelta: 2, cerrada: 3 };

export default function IncidenciaTabla({
  incidencias,
  onSeleccionar,
  mostrarReportadoPor = false,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState<{ clave: OrdenClave; dir: OrdenDir }>({ clave: "creado_en", dir: "desc" });

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    let lista = incidencias;
    if (q) {
      lista = lista.filter((i) =>
        i.titulo.toLowerCase().includes(q) ||
        i.ubicacion.toLowerCase().includes(q) ||
        i.reportado_por_nombre?.toLowerCase().includes(q) ||
        String(i.id).includes(q)
      );
    }
    const sign = orden.dir === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      switch (orden.clave) {
        case "id": va = a.id; vb = b.id; break;
        case "titulo": va = a.titulo; vb = b.titulo; break;
        case "ubicacion": va = a.ubicacion; vb = b.ubicacion; break;
        case "tipo": va = a.tipo; vb = b.tipo; break;
        case "prioridad": va = PRIORIDAD_PESO[a.prioridad] ?? 99; vb = PRIORIDAD_PESO[b.prioridad] ?? 99; break;
        case "estado": va = ESTADO_PESO[a.estado] ?? 99; vb = ESTADO_PESO[b.estado] ?? 99; break;
        case "creado_en": va = a.creado_en; vb = b.creado_en; break;
      }
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
  }, [incidencias, busqueda, orden]);

  function alClickCabecera(clave: OrdenClave) {
    setOrden((o) => o.clave === clave ? { clave, dir: o.dir === "asc" ? "desc" : "asc" } : { clave, dir: "asc" });
  }

  function indicador(clave: OrdenClave) {
    if (orden.clave !== clave) return <span style={{ color: "var(--texto-suave)" }}> ↕</span>;
    return <span> {orden.dir === "asc" ? "▲" : "▼"}</span>;
  }

  return (
    <div>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--borde)", background: "var(--slate-50)" }}>
        <input
          className="form-input"
          placeholder="Buscar por título, ubicación, reportante o #..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ maxWidth: 380 }}
        />
        {busqueda && (
          <span style={{ marginLeft: 10, fontSize: 12, color: "var(--texto-mute)" }}>
            {filtradas.length} de {incidencias.length}
          </span>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p style={{ padding: 18, color: "var(--texto-mute)" }}>Sin resultados.</p>
      ) : (
        <div className="tabla-wrap" style={{ overflowX: "auto" }}>
          <table className="tabla-incidencias">
            <thead>
              <tr>
                <th style={{ cursor: "pointer" }} onClick={() => alClickCabecera("id")}>#{indicador("id")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => alClickCabecera("titulo")}>Título{indicador("titulo")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => alClickCabecera("ubicacion")}>Ubicación{indicador("ubicacion")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => alClickCabecera("tipo")}>Tipo{indicador("tipo")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => alClickCabecera("prioridad")}>Prioridad{indicador("prioridad")}</th>
                <th style={{ cursor: "pointer" }} onClick={() => alClickCabecera("estado")}>Estado{indicador("estado")}</th>
                {mostrarReportadoPor && <th>Reportado por</th>}
                <th style={{ cursor: "pointer" }} onClick={() => alClickCabecera("creado_en")}>Creado{indicador("creado_en")}</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((i) => (
                <tr
                  key={i.id}
                  style={{ cursor: onSeleccionar ? "pointer" : "default" }}
                  onClick={() => onSeleccionar?.(i)}
                >
                  <td>{i.id}</td>
                  <td>{i.titulo}</td>
                  <td>{i.ubicacion}</td>
                  <td>{TIPO_LABEL[i.tipo]}</td>
                  <td>{PRIORIDAD_LABEL[i.prioridad]}</td>
                  <td><EstadoBadge estado={i.estado} /></td>
                  {mostrarReportadoPor && <td>{i.reportado_por_nombre || "—"}</td>}
                  <td>{new Date(i.creado_en).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
