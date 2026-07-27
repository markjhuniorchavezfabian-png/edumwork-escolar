interface SeccionCardProps {
  grado: string;
  letra: string;
  nivel: string;
  cantidad?: number;
  onClick: () => void;
}

const NIVEL_CONFIG: Record<string, { label: string; color: string; bg: string; bgDark: string }> = {
  inicial:    { label: "Inicial",    color: "#7C3AED", bg: "#F5F3FF", bgDark: "#2E1065" },
  primaria:   { label: "Primaria",   color: "#0369A1", bg: "#F0F9FF", bgDark: "#0C2847" },
  secundaria: { label: "Secundaria", color: "#B45309", bg: "#FFFBEB", bgDark: "#3B1A02" },
};

export default function SeccionCard({ grado, letra, nivel, cantidad, onClick }: SeccionCardProps) {
  const cfg = NIVEL_CONFIG[nivel] ?? { label: nivel, color: "#475569", bg: "#F8FAFC", bgDark: "#1E293B" };

  return (
    <button
      onClick={onClick}
      className="seccion-card"
      data-nivel={nivel}
      style={{
        "--card-color": cfg.color,
        "--card-bg": cfg.bg,
        "--card-bg-dark": cfg.bgDark,
      } as React.CSSProperties}
    >
      <span className="seccion-card-nivel">{cfg.label}</span>
      <span className="seccion-card-grado">{grado} {letra}</span>
      {cantidad !== undefined && (
        <span className="seccion-card-alumnos">{cantidad} estudiantes</span>
      )}
    </button>
  );
}
