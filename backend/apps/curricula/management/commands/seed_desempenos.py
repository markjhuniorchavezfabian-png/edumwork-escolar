"""
Seedea desempeños del CNEB por (capacidad × grado) siguiendo la progresión
cognitiva por grado. 3 desempeños por combinación.

Los verbos varían por grado según el ciclo EBR:
- Inicial (i3a-i5a): reconocer, expresar, explorar
- Primaria 1er ciclo (p1-p2): identificar, nombrar, describir
- Primaria 2do ciclo (p3-p4): explicar, aplicar, comparar
- Primaria 3er ciclo (p5-p6): argumentar, justificar, sintetizar
- Secundaria VI (s1-s2): analizar, argumentar, modelar
- Secundaria VII (s3-s5): evaluar, proponer, sistematizar

Nota: son plantillas orientativas. El docente puede editarlas después desde el
admin para adaptar a la redacción exacta del CNEB por área.
"""
from django.core.management.base import BaseCommand
from apps.curricula.models import Capacidad, Desempeno

VERBOS = {
    "i3a": ["Reconoce", "Nombra", "Explora"],
    "i4a": ["Describe", "Expresa", "Compara"],
    "i5a": ["Identifica", "Explica", "Aplica"],
    "p1":  ["Identifica", "Nombra", "Describe"],
    "p2":  ["Reconoce", "Explica", "Aplica"],
    "p3":  ["Interpreta", "Compara", "Establece"],
    "p4":  ["Explica", "Analiza", "Aplica"],
    "p5":  ["Justifica", "Argumenta", "Diseña"],
    "p6":  ["Sintetiza", "Evalúa", "Propone"],
    "s1":  ["Analiza", "Interpreta", "Aplica"],
    "s2":  ["Explica", "Argumenta", "Modela"],
    "s3":  ["Diseña", "Evalúa", "Justifica"],
    "s4":  ["Propone", "Sintetiza", "Argumenta"],
    "s5":  ["Evalúa", "Propone", "Sistematiza"],
}

GRADOS_POR_NIVEL = {
    "inicial":    ["i3a", "i4a", "i5a"],
    "primaria":   ["p1", "p2", "p3", "p4", "p5", "p6"],
    "secundaria": ["s1", "s2", "s3", "s4", "s5"],
}

MATICES = [
    "en situaciones concretas de su entorno",
    "en contextos progresivamente más complejos",
    "con criterio y autonomía crecientes",
]

GRADO_DISPLAY = dict(Desempeno.GRADOS)


class Command(BaseCommand):
    help = "Genera 3 desempeños por (capacidad × grado) según el nivel EBR."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Elimina desempeños existentes antes de seedear.")

    def handle(self, *args, **opts):
        if opts["reset"]:
            n = Desempeno.objects.count()
            Desempeno.objects.all().delete()
            self.stdout.write(f"  {n} desempeños eliminados.")

        total = 0
        for cap in Capacidad.objects.select_related("competencia__area").iterator():
            nivel = cap.competencia.area.nivel
            grados = GRADOS_POR_NIVEL.get(nivel, [])
            cap_lower = cap.nombre.lower().rstrip(". ")

            for grado in grados:
                verbos = VERBOS[grado]
                grado_disp = GRADO_DISPLAY[grado]
                for i, verbo in enumerate(verbos, start=1):
                    matiz = MATICES[i - 1]
                    desc = (
                        f"{verbo} aspectos clave de: {cap_lower}, "
                        f"{matiz} apropiadas al nivel de {grado_disp}."
                    )
                    _, creado = Desempeno.objects.get_or_create(
                        capacidad=cap, grado=grado, orden=i,
                        defaults={"descripcion": desc},
                    )
                    if creado:
                        total += 1

        self.stdout.write(self.style.SUCCESS(
            f"{total} desempeños creados. Total en BD: {Desempeno.objects.count()}"
        ))
