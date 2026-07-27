import type { KPIsIncidencias } from "../../types/incidencia";

interface Props {
  kpis: KPIsIncidencias;
}

export default function KPICards({ kpis }: Props) {
  const items = [
    { label: "Total", valor: kpis.total, color: "var(--azul-700)" },
    { label: "Nuevas", valor: kpis.por_estado.nueva, color: "#1D4ED8" },
    { label: "En atención", valor: kpis.por_estado.en_atencion, color: "#B45309" },
    { label: "Resueltas", valor: kpis.por_estado.resuelta, color: "#166534" },
    {
      label: "T. prom. resolución (h)",
      valor: kpis.tiempo_promedio_resolucion_horas,
      color: "var(--slate-700)",
    },
  ];

  return (
    <div className="kpi-grid">
      {items.map((it) => (
        <div key={it.label} className="kpi-card">
          <div className="kpi-label">{it.label}</div>
          <div className="kpi-valor" style={{ color: it.color }}>{it.valor}</div>
        </div>
      ))}
    </div>
  );
}
