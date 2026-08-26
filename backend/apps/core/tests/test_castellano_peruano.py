"""El producto se escribe en español peruano, y eso se verifica solo.

Un docente de Huánuco que lee "Generá tu sesión" sabe en un segundo que la app
no se escribió para él. Ya se coló dos veces revisando a mano, así que esto lo
mira una prueba en vez de la memoria de quien edita.

La prueba pregunta al revés que antes. Tenía una lista de verbos prohibidos
("Mir|Cont|Pon|…") y una lista de prohibidos siempre se queda corta: dejó
pasar "Matriculá", y después "Registrá tus clases, controlá la asistencia".
Ahora lo prohibido es todo, y lo permitido es una lista chica de palabras
castellanas que legítimamente terminan en vocal tildada. Agregar una palabra
buena cuesta un renglón; olvidarse de un verbo malo ya no cuesta nada.
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[3].parent

# Palabras correctas que terminan en vocal tildada. Todo lo demás que termine
# así se reporta: en castellano peruano un verbo no termina en "á" tónica
# salvo en futuro ("evaluará"), y ese futuro entra acá cuando aparece.
PERMITIDAS = {
    # adverbios y demostrativos
    "acá", "ahí", "allá", "allí", "aquí", "así",
    # interrogativos y conectores
    "qué", "porqué", "quizá",
    # verbos legítimos: 3.ª persona, subjuntivo, 1.ª de pretérito
    "está", "esté", "encontré", "omití", "haré",
    # Futuro de 3.ª persona ("el mensaje aparecerá"). Es castellano correcto y
    # también termina en "á", así que va por lista como todo lo demás. No se
    # puede resolver con una regla estructural: el futuro es infinitivo + "á"
    # ("aparecer"+á), pero el voseo de un verbo cuya raíz ya termina en r o
    # que la pierde da lo mismo —"esperá" deja "esper", que termina en "er"—
    # y se colaría. Agregar una palabra buena cuesta un renglón; dejar pasar
    # un voseo no cuesta nada, que es justo lo que este archivo evita.
    "analizará", "aparecerá", "borrará", "comunicará", "confirmará",
    "desactivará", "desaparecerá", "descargará", "enrutará", "evaluará",
    "extraerá", "generará", "guardará", "habrá", "llenará", "mostrará",
    "pedirá", "perderá", "podrá", "publicará", "quedará", "realizará",
    "rechazará", "recibirá", "rellenará", "revisará", "será", "usará",
    "vendrá", "volverá", "entregará", "pagará",
    # sustantivos y abreviaturas
    "caché", "mié", "comité", "josé", "josué",
}

# Imperativos con pronombre pegado. Acá sí hace falta enumerarlos: el voseo
# ("registrate") no lleva tilde, así que la regla de arriba no lo ve, y buscar
# cualquier palabra terminada en "-ate" marcaría medio TypeScript —"state",
# "update", "template"—. Son los pocos que puede usar una app escolar.
# Sin "animate": es la clase `animate-spin` de Tailwind, no el "anímate" que
# nadie va a escribir en una app de registro de notas.
ENCLITICOS = re.compile(
    r"\b(?:registrate|contactate|fijate|acordate|quedate|apurate|"
    r"suscribite|comunicate|olvidate|acercate)\b",
    re.IGNORECASE,
)

TILDADA = re.compile(r"\b[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}[áéí]\b")
VOS = re.compile(r"\bvos\b", re.IGNORECASE)

# El presente del voseo —"tenés", "podés", "querés", "sabés", "vivís"— termina
# en "-ás/-és/-ís", o sea NO termina en la vocal tildada: termina en "s". Por
# eso `TILDADA` no lo veía y "Tenés 172 lectivos" vivió en el KPI del
# calendario y en el error de la config de IA hasta que se leyó la pantalla en
# un celular (2026-08-25). Mismo criterio que arriba: se prohíbe la forma y se
# permite por lista corta lo que en castellano sí termina así.
#
# Ojo con el borde de esta regla, que no tiene solución perfecta por regex: el
# futuro de "tú" también termina en "-ás" ("verás", "podrás", "tendrás") y es
# castellano correcto. Se resuelve como todo lo demás en este archivo —lista
# corta de permitidas— y no al revés, porque dejar pasar el futuro obligaría a
# permitir "-rás" entero, y ahí se cuela el voseo de los verbos cuya raíz
# termina en r ("esperás", "mejorás", "borrás"). Si aparece un futuro nuevo,
# es un renglón acá; si se colara un voseo, no lo agarra nadie.
PERMITIDAS_VS = {
    # terminan en "-ás/-és/-ís" y son castellano correcto
    "además", "atrás", "detrás", "jamás", "quizás", "demás", "compás",
    # plural de "caché", que ya está permitido en singular más arriba
    "cachés",
    "después", "través", "interés", "inglés", "francés", "cortés", "revés",
    "estrés", "país", "ciempiés", "marqués",
    # "tú estás" y "vos estás" se escriben igual: no distingue nada
    "estás",
    # futuro de "tú" (ver el comentario de arriba)
    "verás", "podrás", "tendrás", "harás", "dirás", "serás", "irás", "recibirás",
    "darás", "sabrás", "querrás", "vendrás", "pondrás", "saldrás", "estarás",
    # nombres propios (los seeds traen alumnos y docentes peruanos)
    "andrés", "nicolás", "inés", "tomás", "moisés", "solís",
}
TILDADA_VS = re.compile(r"\b[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}[áéí]s\b")

# Única excepción de línea: la instrucción que le prohíbe el voseo al modelo.
LINEAS_PERMITIDAS = ('nunca "vos"',)


def _archivos():
    for carpeta, patrones in (
        (RAIZ / "frontend" / "src", ("*.tsx", "*.ts")),
        (RAIZ / "backend" / "apps", ("*.py",)),
    ):
        if not carpeta.exists():
            continue
        for patron in patrones:
            yield from carpeta.rglob(patron)


def _voseo_en(linea: str) -> str | None:
    for palabra in TILDADA.findall(linea):
        if palabra.lower() not in PERMITIDAS:
            return palabra
    for palabra in TILDADA_VS.findall(linea):
        if palabra.lower() not in PERMITIDAS_VS:
            return palabra
    for regex in (ENCLITICOS, VOS):
        hallado = regex.search(linea)
        if hallado:
            return hallado.group()
    return None


def test_no_hay_voseo_en_el_producto():
    hallazgos = []
    for archivo in _archivos():
        if archivo.name.startswith("test_") or "node_modules" in str(archivo):
            continue
        for numero, linea in enumerate(
            archivo.read_text(encoding="utf-8", errors="ignore").splitlines(), start=1
        ):
            if any(p in linea for p in LINEAS_PERMITIDAS):
                continue
            hallado = _voseo_en(linea)
            if hallado:
                hallazgos.append(f"{archivo.relative_to(RAIZ)}:{numero} → {hallado}")

    assert not hallazgos, "Voseo rioplatense en el producto:\n  " + "\n  ".join(hallazgos)


def test_la_prueba_agarra_lo_que_antes_se_le_escapaba():
    """Los tres casos reales que la lista de verbos dejó pasar."""
    assert _voseo_en("Registrá tus clases y controlá la asistencia")
    assert _voseo_en("Matriculá a los alumnos")
    assert _voseo_en("Registrate gratis")
    # Y que no marque castellano correcto.
    assert _voseo_en("La app evaluará qué está acá, así que mirá bien") == "mirá"
    assert _voseo_en("El docente ya está acá; encontré lo que buscaba") is None
    assert _voseo_en("const [state, setState] = useState(false)") is None


def test_agarra_el_presente_del_voseo_que_no_termina_en_vocal_tildada():
    """El agujero real: "-ás/-és/-ís" termina en "s", no en la vocal tildada.

    Los dos primeros son citas literales de lo que estuvo en producción
    —KPI del calendario y error de la config de IA— hasta el 2026-08-25.
    """
    assert _voseo_en("Tenés 172 lectivos + 35 gestión.") == "Tenés"
    assert _voseo_en("No tenés configuración previa.") == "tenés"
    assert _voseo_en("Si querés, podés borrar tu clave") == "querés"
    assert _voseo_en("¿Vivís en Huánuco?") == "Vivís"
    # Castellano correcto que también termina en "-ás/-és/-ís": no se marca.
    assert _voseo_en("Además, después de la sesión, el país y el interés") is None
    assert _voseo_en("Quizás más atrás, al revés, en inglés") is None
    # El borde real: futuro de "tú", "estás" y nombres propios, todos válidos.
    assert _voseo_en("Al entrar verás el banner y podrás cerrarlo") is None
    assert _voseo_en("Estás usando la contraseña predeterminada") is None
    assert _voseo_en('("María", "Rojas"), ("Nicolás", "Silva")') is None
