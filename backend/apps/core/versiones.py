"""Registro de versiones de Sistematic.

Para agregar una nueva versión:
  1. Agrega una entrada al inicio de VERSIONES con is_latest=True.
  2. Cambia is_latest=False en la anterior.
  3. Actualiza VERSION_INSTALADA en settings con el nuevo número.
"""

VERSIONES = [
    {
        "version": "1.1.0",
        "titulo": "Mejoras en costos y sugerencias",
        "fecha": "2026-07-20",
        "precio_actualizacion": None,  # None = gratis / None = consultar
        "es_gratis": True,
        "is_latest": True,
        "novedades": [
            "Página de costos rediseñada con precios referenciales actualizados",
            "Opciones de servidor ampliadas (DigitalOcean, Hetzner, combos con dominio)",
            "Caja de sugerencias integrada vía WhatsApp",
            "Sistema de versiones con historial y precios",
            "Corrección de textos a español peruano",
        ],
    },
    {
        "version": "1.0.0",
        "titulo": "Lanzamiento inicial",
        "fecha": "2026-07-13",
        "precio_actualizacion": None,
        "es_gratis": True,
        "is_latest": False,
        "novedades": [
            "17 módulos funcionales: asistencia, notas, boletas, incidencias, inventario, convivencia, aula virtual y más",
            "11 roles de usuario",
            "IA integrada con soporte para DeepSeek, Claude, OpenAI y Ollama",
            "Boletas PDF oficiales MINEDU",
            "QR en asistencia, inventario, ambientes y visitas",
            "Multi-institución: nombre, logo y datos configurables sin tocar código",
            "Landing page y demo con Ngrok",
        ],
    },
]


def get_versiones():
    """Devuelve la lista de versiones con metadatos de comparación."""
    from django.conf import settings
    instalada = getattr(settings, "VERSION_INSTALADA", "1.0.0")

    resultado = []
    for v in VERSIONES:
        es_instalada = v["version"] == instalada
        # Comparación simple de versiones semánticas
        try:
            partes_v = tuple(int(x) for x in v["version"].split("."))
            partes_i = tuple(int(x) for x in instalada.split("."))
            es_nueva = partes_v > partes_i
        except ValueError:
            es_nueva = False

        resultado.append({
            **v,
            "es_instalada": es_instalada,
            "es_nueva": es_nueva,
        })

    return resultado, instalada
