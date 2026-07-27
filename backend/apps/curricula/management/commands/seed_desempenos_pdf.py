"""
Seedea desempeños desde JSON scrapeado del PDF CNEB oficial de MINEDU.
Hace fuzzy match del nombre truncado del PDF contra las competencias en BD.

Uso:
  python manage.py seed_desempenos_pdf --archivo /path/primaria.json --nivel primaria [--reset]
"""
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

from django.core.management.base import BaseCommand
from apps.curricula.models import Competencia, Desempeno


# Aliases: nombres viejos del CNEB 2016 → nombres actuales en la BD
ALIASES = {
    "explica el mundo natural y artificial": "explica el mundo físico basándose en conocimientos",
    "diseña y construye soluciones": "diseña y construye soluciones tecnológicas",
    "lee textos escritos": "lee diversos tipos de textos escritos",
    "explora su entorno para conocerlo": "indaga mediante métodos científicos",
    "indaga su entorno para conocerlo": "indaga mediante métodos científicos",
    "resuelve problemas de forma": "resuelve problemas de movimiento, forma y localización",
    "resuelve problemas de formas,": "resuelve problemas de movimiento, forma y localización",
}


def normalizar(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Quitar palabras cortas al final que suelen ser fragmentos como "c cu cua"
    words = s.split()
    while words and len(words[-1]) <= 3:
        words.pop()
    return " ".join(words)


def similitud(a: str, b: str) -> float:
    """Compara `a` (PDF, posiblemente truncado) contra `b[:len(a)]` (prefijo BD).
    Esto evita sesgo hacia nombres cortos del CNEB."""
    if not a or not b:
        return 0.0
    # Comparar prefijo BD del mismo largo que el PDF (con algo de tolerancia)
    tam = min(len(a) + 5, len(b))
    b_prefix = b[:tam]
    return SequenceMatcher(None, a, b_prefix).ratio()


class Command(BaseCommand):
    help = "Importa desempeños del PDF CNEB scrapeado a JSON."

    def add_arguments(self, parser):
        parser.add_argument("--archivo", required=True, help="Ruta al JSON con bloques.")
        parser.add_argument("--nivel", required=True, choices=["inicial", "primaria", "secundaria"])
        parser.add_argument("--reset", action="store_true", help="Borra desempeños existentes de este nivel antes de seedear.")
        parser.add_argument("--min-sim", type=float, default=0.55, help="Similitud mínima para hacer match (0-1).")

    def handle(self, *args, **opts):
        archivo = Path(opts["archivo"])
        nivel = opts["nivel"]
        min_sim = opts["min_sim"]

        if not archivo.exists():
            self.stdout.write(self.style.ERROR(f"No existe {archivo}"))
            return

        data = json.loads(archivo.read_text())
        self.stdout.write(f"Leídos {len(data)} bloques del PDF.")

        # Cargar competencias del nivel + índice normalizado
        comps = list(Competencia.objects.filter(area__nivel=nivel).select_related("area"))
        self.stdout.write(f"{len(comps)} competencias en BD para nivel={nivel}.")

        indice = [(c, normalizar(c.nombre)) for c in comps]

        if opts["reset"]:
            n = Desempeno.objects.filter(competencia__area__nivel=nivel).count()
            Desempeno.objects.filter(competencia__area__nivel=nivel).delete()
            self.stdout.write(f"Borrados {n} desempeños del nivel {nivel}.")

        creados = 0
        sin_match = []
        for bloque in data:
            comp_pdf = normalizar(bloque["competencia"])
            grado = bloque["grado"]
            desemps = bloque["desempenos"]

            if not comp_pdf or not desemps:
                continue

            # Aplicar alias si existe (nombres del CNEB 2016 vs 2018)
            for alias_key, alias_val in ALIASES.items():
                key_norm = normalizar(alias_key)
                if key_norm in comp_pdf or comp_pdf in key_norm:
                    comp_pdf = normalizar(alias_val)
                    break

            # Fuzzy match: mejor similitud entre comp_pdf y todos los nombres normalizados
            mejor = max(indice, key=lambda x: similitud(comp_pdf, x[1]))
            sim = similitud(comp_pdf, mejor[1])

            if sim < min_sim:
                sin_match.append((comp_pdf, mejor[1], sim))
                continue

            competencia = mejor[0]
            for i, desc in enumerate(desemps, start=1):
                _, creado = Desempeno.objects.get_or_create(
                    competencia=competencia, grado=grado, orden=i,
                    defaults={"descripcion": desc},
                )
                if creado:
                    creados += 1

        self.stdout.write(self.style.SUCCESS(f"\n{creados} desempeños creados."))
        if sin_match:
            self.stdout.write(self.style.WARNING(f"\n{len(sin_match)} bloques sin match (baja similitud):"))
            for pdf_name, best, sim in sin_match[:10]:
                self.stdout.write(f"  {sim:.2f} · PDF:'{pdf_name[:50]}' vs BD:'{best[:50]}'")
