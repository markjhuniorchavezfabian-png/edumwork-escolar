/**
 * Formateo de fechas centralizado. Todo el sistema muestra fechas en es-PE.
 *
 * Convenciones:
 *   fechaCorta    → "dd/mm/yyyy"
 *   fechaLarga    → "12 de julio de 2026"
 *   fechaHora     → "12/07/2026, 14:35"
 *   fechaChip     → "12 jul, 14:35"        (para chips/badges donde el espacio importa)
 *   fechaDia      → "lun 27" / "lunes 27 de julio"  (día del calendario, sin hora)
 *   relativa      → "hace 3 días" / "en 2h" (para "creado_en" recientes)
 *
 * ⚠️ Usar SIEMPRE estas funciones en vez de `new Date(...)` suelto.
 *
 * Motivo: `new Date("2026-07-27")` —un DateField de Django, sin hora— lo parsea
 * el navegador como medianoche **UTC**. Al mostrarlo en Perú (UTC-5) retrocede
 * cinco horas y cae en el día anterior: la asistencia del lunes 27 se veía como
 * "dom 26" en el panel del padre, y los plazos de casos SíseVe corrían un día.
 * `parseFecha` detecta el formato YYYY-MM-DD y lo construye en hora local.
 */

const LOC = "es-PE";

/** Convierte a Date respetando el día calendario de los DateField (YYYY-MM-DD). */
export function parseFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;

  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const d = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(valor);

  return isNaN(d.getTime()) ? null : d;
}

export function fechaCorta(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = parseFecha(iso);
  if (!d) return "—";
  return d.toLocaleDateString(LOC);
}

export function fechaLarga(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = parseFecha(iso);
  if (!d) return "—";
  return d.toLocaleDateString(LOC, { day: "numeric", month: "long", year: "numeric" });
}

export function fechaHora(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = parseFecha(iso);
  if (!d) return "—";
  return d.toLocaleString(LOC, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fechaChip(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = parseFecha(iso);
  if (!d) return "—";
  return d.toLocaleString(LOC, {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

export function relativa(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = parseFecha(iso);
  if (!d) return "—";
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
