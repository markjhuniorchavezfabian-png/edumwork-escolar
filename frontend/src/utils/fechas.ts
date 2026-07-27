/**
 * Formateo de fechas centralizado. Todo el sistema muestra fechas en es-PE.
 *
 * Convenciones:
 *   fechaCorta    → "dd/mm/yyyy"
 *   fechaLarga    → "12 de julio de 2026"
 *   fechaHora     → "12/07/2026, 14:35"
 *   fechaChip     → "12 jul, 14:35"        (para chips/badges donde el espacio importa)
 *   relativa      → "hace 3 días" / "en 2h" (para "creado_en" recientes)
 */

const LOC = "es-PE";

export function fechaCorta(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOC);
}

export function fechaLarga(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(LOC, { day: "numeric", month: "long", year: "numeric" });
}

export function fechaHora(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOC, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fechaChip(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOC, {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export function relativa(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const abs = Math.abs(diffMs);
  const min = 60_000, hora = 60 * min, dia = 24 * hora;

  const fmt = (n: number, unidad: string) =>
    diffMs >= 0 ? `hace ${n} ${unidad}` : `en ${n} ${unidad}`;

  if (abs < min) return diffMs >= 0 ? "hace segundos" : "en segundos";
  if (abs < hora) return fmt(Math.round(abs / min), "min");
  if (abs < dia)  return fmt(Math.round(abs / hora), "h");
  if (abs < 7 * dia) return fmt(Math.round(abs / dia), "d");
  return fechaCorta(d);
}
