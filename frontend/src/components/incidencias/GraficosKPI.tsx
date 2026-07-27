import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KPIsIncidencias } from "../../types/incidencia";
import { PRIORIDAD_LABEL, TIPO_LABEL, ESTADO_LABEL } from "../../types/incidencia";

const AZUL = "#2563EB";
const COLORES_ESTADO: Record<string, string> = {
  nueva: "#2563EB",
  en_atencion: "#EAB308",
  resuelta: "#16A34A",
  cerrada: "#64748B",
};
const COLORES_PRIORIDAD: Record<string, string> = {
  alta: "#DC2626",
  media: "#EAB308",
  baja: "#64748B",
};

export default function GraficosKPI({ kpis }: { kpis: KPIsIncidencias }) {
  const datosTipo = Object.entries(kpis.por_tipo)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ nombre: TIPO_LABEL[k as keyof typeof TIPO_LABEL] ?? k, valor: v }));

  const datosEstado = Object.entries(kpis.por_estado)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ nombre: ESTADO_LABEL[k as keyof typeof ESTADO_LABEL] ?? k, valor: v, key: k }));

  const datosPrioridad = Object.entries(kpis.por_prioridad)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ nombre: PRIORIDAD_LABEL[k as keyof typeof PRIORIDAD_LABEL] ?? k, valor: v, key: k }));

  return (
    <div className="graficos-grid">
      <div className="card">
        <div className="card-header">Incidencias por tipo</div>
        <div className="card-body" style={{ height: 280 }}>
          {datosTipo.length === 0 ? (
            <p className="empty-state">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosTipo} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="nombre" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="valor" fill={AZUL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Distribución por estado</div>
        <div className="card-body" style={{ height: 280 }}>
          {datosEstado.length === 0 ? (
            <p className="empty-state">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosEstado}
                  dataKey="valor"
                  nameKey="nombre"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {datosEstado.map((d, i) => (
                    <Cell key={i} fill={COLORES_ESTADO[d.key] ?? AZUL} />
                  ))}
                </Pie>
                <Legend fontSize={11} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Distribución por prioridad</div>
        <div className="card-body" style={{ height: 240 }}>
          {datosPrioridad.length === 0 ? (
            <p className="empty-state">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosPrioridad} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis dataKey="nombre" type="category" fontSize={11} width={60} />
                <Tooltip />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {datosPrioridad.map((d, i) => (
                    <Cell key={i} fill={COLORES_PRIORIDAD[d.key] ?? AZUL} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
