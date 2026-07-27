"""Catálogo de proveedores LLM soportados.

Política de actualización: la lista de modelos es estática y se actualiza
con cada versión de la app. No se sincroniza con las APIs de los proveedores.
"""

PROVIDERS = [
    ("deepseek", "DeepSeek",          "https://api.deepseek.com",   "deepseek-v4-flash"),
    ("claude",   "Anthropic",         "",                            "claude-haiku-4-5"),
    ("openai",   "OpenAI",            "",                            "gpt-4o-mini"),
    ("gemini",   "Google",            "",                            "gemini-2.0-flash"),
    ("ollama",   "Ollama local",      "http://localhost:11434",      "llama3.2"),
    ("custom",   "Compatible OpenAI", "",                            ""),
]

# Providers que litellm maneja nativamente — NO pasar api_base o rompe el routing
PROVIDERS_NATIVOS = {"gemini", "claude", "openai"}

PROVIDER_CHOICES = [(p[0], p[1]) for p in PROVIDERS]

# Primer elemento de cada lista = recomendado (mejor relación precio/calidad para uso escolar)
MODELOS_SUGERIDOS = {
    "deepseek": ["deepseek-v4-flash", "deepseek-v4-pro"],
    "claude":   ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],
    "openai":   ["gpt-4o-mini", "gpt-4o", "o4-mini"],
    "gemini":   ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash-preview-05-20", "gemini-2.5-pro-preview-06-05"],
    "ollama":   ["llama3.2", "qwen2.5", "mistral", "gemma2"],
    "custom":   [],
}

# Modelo recomendado por proveedor (el más económico que cubre bien las tareas escolares)
MODELO_RECOMENDADO = {
    "deepseek": "deepseek-v4-flash",
    "claude":   "claude-haiku-4-5",
    "openai":   "gpt-4o-mini",
    "gemini":   "gemini-2.0-flash",
    "ollama":   "llama3.2",
    "custom":   "",
}

LITELLM_PREFIX = {
    "deepseek":   "deepseek/",
    "claude":     "anthropic/",
    "openai":     "openai/",
    "gemini":     "gemini/",
    "ollama":     "ollama/",
    "openrouter": "openrouter/",
    "custom":     "openai/",
}

BASE_URL_DEFAULT = {p[0]: p[2] for p in PROVIDERS}
MODELO_DEFAULT = {p[0]: p[3] for p in PROVIDERS}
