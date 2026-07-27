export default function Spinner({ size = 24, texto }: { size?: number; texto?: string }) {
  return (
    <div className="spinner-wrap">
      <svg className="spinner" width={size} height={size} viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
      </svg>
      {texto && <span className="spinner-texto">{texto}</span>}
    </div>
  );
}

/** Estado de carga estándar: spinner + texto. Reemplazo drop-in de <p>Cargando...</p>. */
export function Cargando({ texto = "Cargando...", inline = false }: { texto?: string; inline?: boolean }) {
  return (
    <div className={inline ? "cargando-inline" : "cargando-centrado"}>
      <Spinner size={inline ? 16 : 24} />
      <span>{texto}</span>
    </div>
  );
}

import Icon from "./Icon";
import type { } from "./Icon";

type IconName = Parameters<typeof Icon>[0]["name"];

export function EmptyState({ icono = "bandeja", titulo, descripcion, accion }: {
  icono?: IconName;
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="empty-state-card">
      <div className="empty-icono">
        <Icon name={icono} size={36} strokeWidth={1.5} />
      </div>
      <h4>{titulo}</h4>
      {descripcion && <p>{descripcion}</p>}
      {accion && <div style={{ marginTop: 12 }}>{accion}</div>}
    </div>
  );
}
