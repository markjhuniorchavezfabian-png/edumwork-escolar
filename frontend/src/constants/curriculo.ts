/** Áreas curriculares según CNEB 2016 — fuente única para todo el frontend. */
export const AREAS_CNEB = [
  "Comunicación",
  "Matemática",
  "Ciencia y Tecnología",
  "Ciencias Sociales",
  "Historia, Geografía y Economía",
  "Personal Social",
  "Inglés",
  "Arte y Cultura",
  "Educación Física",
  "Educación Religiosa",
  "DPCC",
  "Tutoría",
] as const;

export type AreaCNEB = (typeof AREAS_CNEB)[number];

export const GRADOS_TODOS = [
  "Inicial 3 años", "Inicial 4 años", "Inicial 5 años",
  "1ro Primaria", "2do Primaria", "3ro Primaria", "4to Primaria", "5to Primaria", "6to Primaria",
  "1ro Secundaria", "2do Secundaria", "3ro Secundaria", "4to Secundaria", "5to Secundaria",
] as const;
