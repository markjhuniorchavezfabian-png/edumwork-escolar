"""
Poblamiento del Currículo Nacional de Educación Básica (CNEB 2016).
Incluye Inicial, Primaria y Secundaria con sus competencias y capacidades.
"""
from django.core.management.base import BaseCommand

from apps.curricula.models import AreaCurricular, Capacidad, Competencia

# ─── DATOS CNEB ──────────────────────────────────────────────────────────────
# Estructura: { nivel: [ { area, orden, competencias: [ { nombre, capacidades: [...] } ] } ] }

CNEB = {
    "inicial": [
        {
            "area": "Personal Social", "orden": 1,
            "competencias": [
                {
                    "nombre": "Construye su identidad",
                    "capacidades": [
                        "Se valora a sí mismo",
                        "Autorregula sus emociones",
                    ],
                },
                {
                    "nombre": "Convive y participa democráticamente en la búsqueda del bien común",
                    "capacidades": [
                        "Interactúa con todas las personas",
                        "Construye normas y asume acuerdos y leyes",
                        "Participa en acciones que promueven el bienestar común",
                    ],
                },
            ],
        },
        {
            "area": "Psicomotriz", "orden": 2,
            "competencias": [
                {
                    "nombre": "Se desenvuelve de manera autónoma a través de su motricidad",
                    "capacidades": [
                        "Comprende su cuerpo",
                        "Se expresa corporalmente",
                    ],
                },
            ],
        },
        {
            "area": "Comunicación", "orden": 3,
            "competencias": [
                {
                    "nombre": "Se comunica oralmente en su lengua materna",
                    "capacidades": [
                        "Obtiene información del texto oral",
                        "Infiere e interpreta información del texto oral",
                        "Adecúa, organiza y desarrolla el texto de forma coherente y cohesionada",
                        "Utiliza recursos no verbales y paraverbales de forma estratégica",
                        "Interactúa estratégicamente con distintos interlocutores",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto oral",
                    ],
                },
                {
                    "nombre": "Lee diversos tipos de textos escritos en su lengua materna",
                    "capacidades": [
                        "Obtiene información del texto escrito",
                        "Infiere e interpreta información del texto",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto",
                    ],
                },
                {
                    "nombre": "Crea proyectos desde los lenguajes artísticos",
                    "capacidades": [
                        "Explora y experimenta los lenguajes del arte",
                        "Aplica procesos creativos",
                        "Socializa sus procesos y proyectos",
                    ],
                },
            ],
        },
        {
            "area": "Matemática", "orden": 4,
            "competencias": [
                {
                    "nombre": "Resuelve problemas de cantidad",
                    "capacidades": [
                        "Traduce cantidades a expresiones numéricas",
                        "Comunica su comprensión sobre los números y las operaciones",
                        "Usa estrategias y procedimientos de estimación y cálculo",
                        "Argumenta afirmaciones sobre las relaciones numéricas y las operaciones",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de regularidad, equivalencia y cambio",
                    "capacidades": [
                        "Traduce datos y condiciones a expresiones algebraicas",
                        "Comunica su comprensión sobre las relaciones algebraicas",
                        "Usa estrategias y procedimientos para encontrar reglas generales",
                        "Argumenta afirmaciones sobre relaciones de cambio y equivalencia",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de movimiento, forma y localización",
                    "capacidades": [
                        "Modela objetos con formas geométricas y sus transformaciones",
                        "Comunica su comprensión sobre las formas y relaciones geométricas",
                        "Usa estrategias y procedimientos para orientarse en el espacio",
                        "Argumenta afirmaciones sobre relaciones geométricas",
                    ],
                },
            ],
        },
        {
            "area": "Ciencia y Tecnología", "orden": 5,
            "competencias": [
                {
                    "nombre": "Indaga mediante métodos científicos para construir sus conocimientos",
                    "capacidades": [
                        "Problematiza situaciones",
                        "Diseña estrategias para hacer indagación",
                        "Genera y registra datos o información",
                        "Analiza datos e información",
                        "Evalúa y comunica el proceso y resultados de su indagación",
                    ],
                },
                {
                    "nombre": "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
                    "capacidades": [
                        "Comprende y usa conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
                        "Evalúa las implicancias del saber y del quehacer científico y tecnológico",
                    ],
                },
                {
                    "nombre": "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno",
                    "capacidades": [
                        "Determina una alternativa de solución tecnológica",
                        "Diseña la alternativa de solución tecnológica",
                        "Implementa y valida alternativas de solución tecnológica",
                        "Evalúa y comunica el funcionamiento y los impactos de su alternativa de solución tecnológica",
                    ],
                },
            ],
        },
    ],

    "primaria": [
        {
            "area": "Comunicación", "orden": 1,
            "competencias": [
                {
                    "nombre": "Se comunica oralmente en su lengua materna",
                    "capacidades": [
                        "Obtiene información del texto oral",
                        "Infiere e interpreta información del texto oral",
                        "Adecúa, organiza y desarrolla el texto de forma coherente y cohesionada",
                        "Utiliza recursos no verbales y paraverbales de forma estratégica",
                        "Interactúa estratégicamente con distintos interlocutores",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto oral",
                    ],
                },
                {
                    "nombre": "Lee diversos tipos de textos escritos en su lengua materna",
                    "capacidades": [
                        "Obtiene información del texto escrito",
                        "Infiere e interpreta información del texto",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto",
                    ],
                },
                {
                    "nombre": "Escribe diversos tipos de textos en su lengua materna",
                    "capacidades": [
                        "Adecúa el texto a la situación comunicativa",
                        "Organiza y desarrolla las ideas de forma coherente y cohesionada",
                        "Utiliza convenciones del lenguaje escrito de forma pertinente",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto escrito",
                    ],
                },
            ],
        },
        {
            "area": "Matemática", "orden": 2,
            "competencias": [
                {
                    "nombre": "Resuelve problemas de cantidad",
                    "capacidades": [
                        "Traduce cantidades a expresiones numéricas",
                        "Comunica su comprensión sobre los números y las operaciones",
                        "Usa estrategias y procedimientos de estimación y cálculo",
                        "Argumenta afirmaciones sobre las relaciones numéricas y las operaciones",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de regularidad, equivalencia y cambio",
                    "capacidades": [
                        "Traduce datos y condiciones a expresiones algebraicas",
                        "Comunica su comprensión sobre las relaciones algebraicas",
                        "Usa estrategias y procedimientos para encontrar reglas generales",
                        "Argumenta afirmaciones sobre relaciones de cambio y equivalencia",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de movimiento, forma y localización",
                    "capacidades": [
                        "Modela objetos con formas geométricas y sus transformaciones",
                        "Comunica su comprensión sobre las formas y relaciones geométricas",
                        "Usa estrategias y procedimientos para orientarse en el espacio",
                        "Argumenta afirmaciones sobre relaciones geométricas",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de gestión de datos e incertidumbre",
                    "capacidades": [
                        "Representa datos con gráficos y medidas estadísticas o probabilísticas",
                        "Comunica su comprensión de los conceptos estadísticos y probabilísticos",
                        "Usa estrategias y procedimientos para recopilar y procesar datos",
                        "Sustenta conclusiones o decisiones con base en información obtenida",
                    ],
                },
            ],
        },
        {
            "area": "Personal Social", "orden": 3,
            "competencias": [
                {
                    "nombre": "Construye su identidad",
                    "capacidades": [
                        "Se valora a sí mismo",
                        "Autorregula sus emociones",
                    ],
                },
                {
                    "nombre": "Convive y participa democráticamente en la búsqueda del bien común",
                    "capacidades": [
                        "Interactúa con todas las personas",
                        "Construye normas y asume acuerdos y leyes",
                        "Maneja conflictos de manera constructiva",
                        "Delibera sobre asuntos públicos",
                        "Participa en acciones que promueven el bienestar común",
                    ],
                },
                {
                    "nombre": "Construye interpretaciones históricas",
                    "capacidades": [
                        "Interpreta críticamente fuentes diversas",
                        "Comprende el tiempo histórico",
                        "Elabora explicaciones sobre procesos históricos",
                    ],
                },
                {
                    "nombre": "Gestiona responsablemente el espacio y el ambiente",
                    "capacidades": [
                        "Comprende las relaciones entre los elementos naturales y sociales",
                        "Maneja fuentes de información para comprender el espacio geográfico",
                        "Genera acciones para preservar el ambiente local y global",
                    ],
                },
                {
                    "nombre": "Gestiona responsablemente los recursos económicos",
                    "capacidades": [
                        "Comprende las relaciones entre los elementos del sistema económico y financiero",
                        "Toma decisiones económicas y financieras",
                    ],
                },
            ],
        },
        {
            "area": "Ciencia y Tecnología", "orden": 4,
            "competencias": [
                {
                    "nombre": "Indaga mediante métodos científicos para construir sus conocimientos",
                    "capacidades": [
                        "Problematiza situaciones",
                        "Diseña estrategias para hacer indagación",
                        "Genera y registra datos o información",
                        "Analiza datos e información",
                        "Evalúa y comunica el proceso y resultados de su indagación",
                    ],
                },
                {
                    "nombre": "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
                    "capacidades": [
                        "Comprende y usa conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
                        "Evalúa las implicancias del saber y del quehacer científico y tecnológico",
                    ],
                },
                {
                    "nombre": "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno",
                    "capacidades": [
                        "Determina una alternativa de solución tecnológica",
                        "Diseña la alternativa de solución tecnológica",
                        "Implementa y valida alternativas de solución tecnológica",
                        "Evalúa y comunica el funcionamiento y los impactos de su alternativa de solución tecnológica",
                    ],
                },
            ],
        },
        {
            "area": "Arte y Cultura", "orden": 5,
            "competencias": [
                {
                    "nombre": "Aprecia de manera crítica manifestaciones artístico-culturales",
                    "capacidades": [
                        "Percibe manifestaciones artístico-culturales",
                        "Contextualiza las manifestaciones culturales",
                        "Reflexiona creativa y críticamente",
                    ],
                },
                {
                    "nombre": "Crea proyectos desde los lenguajes artísticos",
                    "capacidades": [
                        "Explora y experimenta los lenguajes del arte",
                        "Aplica procesos creativos",
                        "Evalúa y comunica sus procesos y proyectos",
                    ],
                },
            ],
        },
        {
            "area": "Educación Física", "orden": 6,
            "competencias": [
                {
                    "nombre": "Se desenvuelve de manera autónoma a través de su motricidad",
                    "capacidades": [
                        "Comprende su cuerpo",
                        "Se expresa corporalmente",
                    ],
                },
                {
                    "nombre": "Asume una vida saludable",
                    "capacidades": [
                        "Comprende las relaciones entre la actividad física, alimentación, postura e higiene corporal y la salud",
                        "Incorpora prácticas que mejoran su calidad de vida",
                    ],
                },
                {
                    "nombre": "Interactúa a través de sus habilidades sociomotrices",
                    "capacidades": [
                        "Se relaciona utilizando sus habilidades sociomotrices",
                        "Crea y aplica estrategias y tácticas de juego",
                    ],
                },
            ],
        },
        {
            "area": "Educación Religiosa", "orden": 7,
            "competencias": [
                {
                    "nombre": "Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente",
                    "capacidades": [
                        "Conoce a Dios y asume su identidad religiosa y espiritual como persona digna, libre y trascendente",
                        "Cultiva y valora las manifestaciones religiosas de su entorno argumentando su fe de manera comprensible y respetuosa",
                    ],
                },
                {
                    "nombre": "Asume la experiencia el encuentro personal y comunitario con Dios en su proyecto de vida en coherencia con su creencia religiosa",
                    "capacidades": [
                        "Transforma su entorno desde el encuentro personal y comunitario con Dios y desde la fe que profesa",
                        "Actúa coherentemente en razón de su fe según los principios de su conciencia moral en situaciones concretas de la vida",
                    ],
                },
            ],
        },
        {
            "area": "Inglés", "orden": 8,
            "competencias": [
                {
                    "nombre": "Se comunica oralmente en Inglés como lengua extranjera",
                    "capacidades": [
                        "Obtiene información del texto oral",
                        "Infiere e interpreta información del texto oral",
                        "Adecúa, organiza y desarrolla el texto de forma coherente y cohesionada",
                        "Utiliza recursos no verbales y paraverbales de forma estratégica",
                        "Interactúa estratégicamente con distintos interlocutores",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto oral",
                    ],
                },
                {
                    "nombre": "Lee diversos tipos de textos en Inglés como lengua extranjera",
                    "capacidades": [
                        "Obtiene información del texto escrito",
                        "Infiere e interpreta información del texto",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto",
                    ],
                },
                {
                    "nombre": "Escribe diversos tipos de textos en Inglés como lengua extranjera",
                    "capacidades": [
                        "Adecúa el texto a la situación comunicativa",
                        "Organiza y desarrolla las ideas de forma coherente y cohesionada",
                        "Utiliza convenciones del lenguaje escrito de forma pertinente",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto escrito",
                    ],
                },
            ],
        },
    ],

    "secundaria": [
        {
            "area": "Comunicación", "orden": 1,
            "competencias": [
                {
                    "nombre": "Se comunica oralmente en su lengua materna",
                    "capacidades": [
                        "Obtiene información del texto oral",
                        "Infiere e interpreta información del texto oral",
                        "Adecúa, organiza y desarrolla el texto de forma coherente y cohesionada",
                        "Utiliza recursos no verbales y paraverbales de forma estratégica",
                        "Interactúa estratégicamente con distintos interlocutores",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto oral",
                    ],
                },
                {
                    "nombre": "Lee diversos tipos de textos escritos en su lengua materna",
                    "capacidades": [
                        "Obtiene información del texto escrito",
                        "Infiere e interpreta información del texto",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto",
                    ],
                },
                {
                    "nombre": "Escribe diversos tipos de textos en su lengua materna",
                    "capacidades": [
                        "Adecúa el texto a la situación comunicativa",
                        "Organiza y desarrolla las ideas de forma coherente y cohesionada",
                        "Utiliza convenciones del lenguaje escrito de forma pertinente",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto escrito",
                    ],
                },
            ],
        },
        {
            "area": "Matemática", "orden": 2,
            "competencias": [
                {
                    "nombre": "Resuelve problemas de cantidad",
                    "capacidades": [
                        "Traduce cantidades a expresiones numéricas",
                        "Comunica su comprensión sobre los números y las operaciones",
                        "Usa estrategias y procedimientos de estimación y cálculo",
                        "Argumenta afirmaciones sobre las relaciones numéricas y las operaciones",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de regularidad, equivalencia y cambio",
                    "capacidades": [
                        "Traduce datos y condiciones a expresiones algebraicas",
                        "Comunica su comprensión sobre las relaciones algebraicas",
                        "Usa estrategias y procedimientos para encontrar reglas generales",
                        "Argumenta afirmaciones sobre relaciones de cambio y equivalencia",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de movimiento, forma y localización",
                    "capacidades": [
                        "Modela objetos con formas geométricas y sus transformaciones",
                        "Comunica su comprensión sobre las formas y relaciones geométricas",
                        "Usa estrategias y procedimientos para orientarse en el espacio",
                        "Argumenta afirmaciones sobre relaciones geométricas",
                    ],
                },
                {
                    "nombre": "Resuelve problemas de gestión de datos e incertidumbre",
                    "capacidades": [
                        "Representa datos con gráficos y medidas estadísticas o probabilísticas",
                        "Comunica su comprensión de los conceptos estadísticos y probabilísticos",
                        "Usa estrategias y procedimientos para recopilar y procesar datos",
                        "Sustenta conclusiones o decisiones con base en información obtenida",
                    ],
                },
            ],
        },
        {
            "area": "Ciencias Sociales", "orden": 3,
            "competencias": [
                {
                    "nombre": "Construye interpretaciones históricas",
                    "capacidades": [
                        "Interpreta críticamente fuentes diversas",
                        "Comprende el tiempo histórico",
                        "Elabora explicaciones sobre procesos históricos",
                    ],
                },
                {
                    "nombre": "Gestiona responsablemente el espacio y el ambiente",
                    "capacidades": [
                        "Comprende las relaciones entre los elementos naturales y sociales",
                        "Maneja fuentes de información para comprender el espacio geográfico",
                        "Genera acciones para preservar el ambiente local y global",
                    ],
                },
                {
                    "nombre": "Gestiona responsablemente los recursos económicos",
                    "capacidades": [
                        "Comprende las relaciones entre los elementos del sistema económico y financiero",
                        "Toma decisiones económicas y financieras",
                    ],
                },
            ],
        },
        {
            "area": "Ciencia y Tecnología", "orden": 4,
            "competencias": [
                {
                    "nombre": "Indaga mediante métodos científicos para construir sus conocimientos",
                    "capacidades": [
                        "Problematiza situaciones",
                        "Diseña estrategias para hacer indagación",
                        "Genera y registra datos o información",
                        "Analiza datos e información",
                        "Evalúa y comunica el proceso y resultados de su indagación",
                    ],
                },
                {
                    "nombre": "Explica el mundo físico basándose en conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
                    "capacidades": [
                        "Comprende y usa conocimientos sobre los seres vivos, materia y energía, biodiversidad, Tierra y universo",
                        "Evalúa las implicancias del saber y del quehacer científico y tecnológico",
                    ],
                },
                {
                    "nombre": "Diseña y construye soluciones tecnológicas para resolver problemas de su entorno",
                    "capacidades": [
                        "Determina una alternativa de solución tecnológica",
                        "Diseña la alternativa de solución tecnológica",
                        "Implementa y valida alternativas de solución tecnológica",
                        "Evalúa y comunica el funcionamiento y los impactos de su alternativa de solución tecnológica",
                    ],
                },
            ],
        },
        {
            "area": "Desarrollo Personal, Ciudadanía y Cívica", "orden": 5,
            "competencias": [
                {
                    "nombre": "Construye su identidad",
                    "capacidades": [
                        "Se valora a sí mismo",
                        "Autorregula sus emociones",
                    ],
                },
                {
                    "nombre": "Convive y participa democráticamente en la búsqueda del bien común",
                    "capacidades": [
                        "Interactúa con todas las personas",
                        "Construye normas y asume acuerdos y leyes",
                        "Maneja conflictos de manera constructiva",
                        "Delibera sobre asuntos públicos",
                        "Participa en acciones que promueven el bienestar común",
                    ],
                },
            ],
        },
        {
            "area": "Arte y Cultura", "orden": 6,
            "competencias": [
                {
                    "nombre": "Aprecia de manera crítica manifestaciones artístico-culturales",
                    "capacidades": [
                        "Percibe manifestaciones artístico-culturales",
                        "Contextualiza las manifestaciones culturales",
                        "Reflexiona creativa y críticamente",
                    ],
                },
                {
                    "nombre": "Crea proyectos desde los lenguajes artísticos",
                    "capacidades": [
                        "Explora y experimenta los lenguajes del arte",
                        "Aplica procesos creativos",
                        "Evalúa y comunica sus procesos y proyectos",
                    ],
                },
            ],
        },
        {
            "area": "Educación Física", "orden": 7,
            "competencias": [
                {
                    "nombre": "Se desenvuelve de manera autónoma a través de su motricidad",
                    "capacidades": [
                        "Comprende su cuerpo",
                        "Se expresa corporalmente",
                    ],
                },
                {
                    "nombre": "Asume una vida saludable",
                    "capacidades": [
                        "Comprende las relaciones entre la actividad física, alimentación, postura e higiene corporal y la salud",
                        "Incorpora prácticas que mejoran su calidad de vida",
                    ],
                },
                {
                    "nombre": "Interactúa a través de sus habilidades sociomotrices",
                    "capacidades": [
                        "Se relaciona utilizando sus habilidades sociomotrices",
                        "Crea y aplica estrategias y tácticas de juego",
                    ],
                },
            ],
        },
        {
            "area": "Educación Religiosa", "orden": 8,
            "competencias": [
                {
                    "nombre": "Construye su identidad como persona humana, amada por Dios, digna, libre y trascendente",
                    "capacidades": [
                        "Conoce a Dios y asume su identidad religiosa y espiritual como persona digna, libre y trascendente",
                        "Cultiva y valora las manifestaciones religiosas de su entorno argumentando su fe de manera comprensible y respetuosa",
                    ],
                },
                {
                    "nombre": "Asume la experiencia el encuentro personal y comunitario con Dios en su proyecto de vida en coherencia con su creencia religiosa",
                    "capacidades": [
                        "Transforma su entorno desde el encuentro personal y comunitario con Dios y desde la fe que profesa",
                        "Actúa coherentemente en razón de su fe según los principios de su conciencia moral en situaciones concretas de la vida",
                    ],
                },
            ],
        },
        {
            "area": "Inglés", "orden": 9,
            "competencias": [
                {
                    "nombre": "Se comunica oralmente en Inglés como lengua extranjera",
                    "capacidades": [
                        "Obtiene información del texto oral",
                        "Infiere e interpreta información del texto oral",
                        "Adecúa, organiza y desarrolla el texto de forma coherente y cohesionada",
                        "Utiliza recursos no verbales y paraverbales de forma estratégica",
                        "Interactúa estratégicamente con distintos interlocutores",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto oral",
                    ],
                },
                {
                    "nombre": "Lee diversos tipos de textos en Inglés como lengua extranjera",
                    "capacidades": [
                        "Obtiene información del texto escrito",
                        "Infiere e interpreta información del texto",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto",
                    ],
                },
                {
                    "nombre": "Escribe diversos tipos de textos en Inglés como lengua extranjera",
                    "capacidades": [
                        "Adecúa el texto a la situación comunicativa",
                        "Organiza y desarrolla las ideas de forma coherente y cohesionada",
                        "Utiliza convenciones del lenguaje escrito de forma pertinente",
                        "Reflexiona y evalúa la forma, el contenido y el contexto del texto escrito",
                    ],
                },
            ],
        },
        {
            "area": "Educación para el Trabajo", "orden": 10,
            "competencias": [
                {
                    "nombre": "Gestiona proyectos de emprendimiento económico y social",
                    "capacidades": [
                        "Crea propuestas de valor",
                        "Aplica habilidades técnicas",
                        "Trabaja cooperativamente para lograr objetivos y metas",
                        "Evalúa los resultados del proyecto de emprendimiento",
                    ],
                },
            ],
        },
    ],
}


class Command(BaseCommand):
    help = "Poblar la base de datos con el Currículo Nacional (CNEB 2016) — Inicial, Primaria, Secundaria"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limpiar",
            action="store_true",
            help="Eliminar datos existentes antes de insertar",
        )

    def handle(self, *args, **options):
        if options["limpiar"]:
            AreaCurricular.objects.all().delete()
            self.stdout.write("  Datos anteriores eliminados.")

        total_areas = 0
        total_comp = 0
        total_cap = 0

        for nivel, areas in CNEB.items():
            for area_data in areas:
                area, _ = AreaCurricular.objects.get_or_create(
                    nombre=area_data["area"],
                    nivel=nivel,
                    defaults={"orden": area_data["orden"]},
                )
                total_areas += 1

                for i, comp_data in enumerate(area_data["competencias"], start=1):
                    comp, _ = Competencia.objects.get_or_create(
                        area=area,
                        numero=i,
                        defaults={"nombre": comp_data["nombre"]},
                    )
                    total_comp += 1

                    for j, cap_nombre in enumerate(comp_data["capacidades"], start=1):
                        Capacidad.objects.get_or_create(
                            competencia=comp,
                            nombre=cap_nombre,
                            defaults={"orden": j},
                        )
                        total_cap += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"CNEB cargado: {total_areas} áreas · {total_comp} competencias · {total_cap} capacidades"
            )
        )
