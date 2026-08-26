"""Cómo se entregan las contraseñas iniciales que genera un seed.

POR QUÉ EXISTE
`seed_asistencia` escribía `credenciales_estudiantes.csv` con nombres y
contraseñas en texto plano, y elegía la carpeta así:

    # Preferir MEDIA_ROOT (writable en Docker) sobre BASE_DIR
    base_out = Path(getattr(settings, "MEDIA_ROOT", settings.BASE_DIR))

La razón era buena —MEDIA_ROOT es escribible dentro del contenedor— y el
resultado fue dejar las contraseñas en la única carpeta que nginx publicaba
al mundo. El recordatorio de borrarlas era una advertencia en pantalla, o sea
dependía de que alguien se acordara.

CRITERIO
Por defecto no se escribe nada: las credenciales salen por pantalla, que es
donde ya está mirando quien corre el comando. Si alguien quiere el archivo
para imprimirlo, tiene que decir dónde con `--csv RUTA`, y ahí sabe qué creó
y dónde borrarlo.

Escribir dentro de MEDIA_ROOT se rechaza, aunque lo pidan a mano: esa carpeta
es la que se sirve, y el error que se cometió una vez no debe poder repetirse
con un argumento.
"""
import csv
import os
from pathlib import Path

from django.conf import settings


class DestinoInseguro(Exception):
    """La ruta pedida cae dentro de la carpeta que se publica."""


def _dentro_de_media(destino: Path) -> bool:
    media = Path(getattr(settings, "MEDIA_ROOT", "")).resolve()
    if not str(media):
        return False
    try:
        return destino.resolve().is_relative_to(media)
    except (OSError, ValueError):
        return False


def escribir_csv(destino: str, cabecera: list[str], filas: list) -> Path:
    """Guarda las credenciales donde el operador pidió, con permisos 0600."""
    ruta = Path(destino).expanduser()
    if _dentro_de_media(ruta):
        raise DestinoInseguro(
            f"{ruta} está dentro de MEDIA_ROOT, que es la carpeta que se sirve. "
            "Elige otra ruta."
        )
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cabecera)
        w.writerows(filas)
    # Sólo el dueño puede leerlo: son contraseñas en texto plano.
    os.chmod(ruta, 0o600)
    return ruta


def mostrar(stdout, estilo, cabecera: list[str], filas: list, destino: str | None):
    """Por pantalla, o al archivo que se haya pedido explícitamente."""
    if destino:
        try:
            ruta = escribir_csv(destino, cabecera, filas)
        except DestinoInseguro as e:
            stdout.write(estilo.ERROR(str(e)))
            return
        stdout.write(estilo.WARNING(
            f"⚠  {len(filas)} credenciales en {ruta} (permisos 0600). "
            "Entrégalas y borra el archivo."
        ))
        return

    stdout.write(estilo.WARNING(
        f"⚠  {len(filas)} credenciales iniciales. No se guardó ningún archivo: "
        "cópialas de acá, o vuelve a correr con --csv RUTA si necesitas el "
        "listado para imprimir."
    ))
    stdout.write("  " + " | ".join(cabecera))
    for fila in filas:
        stdout.write("  " + " | ".join(str(x) for x in fila))
