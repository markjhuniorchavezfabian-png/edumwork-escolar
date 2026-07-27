import type { EstadoIncidencia } from "../../types/incidencia";
import { ESTADO_LABEL } from "../../types/incidencia";

interface Props {
  estado: EstadoIncidencia;
}

const COLORES: Record<EstadoIncidencia, { bg: string; fg: string }> = {
  nueva: { bg: "#DBEAFE", fg: "#1D4ED8" },
  en_atencion: { bg: "#FEF3C7", fg: "#B45309" },
  resuelta: { bg: "#DCFCE7", fg: "#166534" },
  cerrada: { bg: "#E2E8F0", fg: "#334155" },
};

export default function EstadoBadge({ estado }: Props) {
  const c = COLORES[estado];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "var(--r-sm)",
        fontSize: 12,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {ESTADO_LABEL[estado]}
    </span>
  );
}
