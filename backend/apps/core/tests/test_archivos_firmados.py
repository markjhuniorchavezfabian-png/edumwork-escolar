"""Los archivos subidos no se sirven como estáticos, y ningún serializer se
queda afuera del cambio.

El agujero: `nginx.conf.template` servía `/media/` entero con caché público
por siete días, y `docker-compose.prod.yml` monta ese volumen dentro del
contenedor de nginx. Fotos de estudiantes, adjuntos de convivencia,
justificaciones y licencias médicas del personal, descargables por cualquiera
con la URL.

La prueba que más importa es `test_ningun_serializer_quedo_sin_firmar`: un
arreglo que hay que aplicar en ocho lugares falla por el que se olvida, no por
los siete que se hicieron bien. Esa prueba recorre los serializers en vez de
confiar en una lista escrita a mano.
"""
import importlib
import pkgutil
from pathlib import Path

import pytest
from django.conf import settings
from django.core import signing
from django.db.models import FileField
from rest_framework import serializers as S
from rest_framework.test import APIClient

from apps.core import archivos

NGINX = Path(settings.BASE_DIR).parent / "frontend" / "nginx.conf.template"


def test_ningun_serializer_quedo_sin_firmar():
    """Recorre los serializers del proyecto: cualquiera que exponga un campo
    de archivo tiene que llevar el mixin.

    Escrita así y no con una lista fija porque el día que alguien agregue un
    modelo con adjunto, una lista no se entera — y es exactamente cuando esta
    prueba tendría que saltar.
    """
    import apps

    sin_firmar = []
    for modulo in pkgutil.iter_modules(apps.__path__):
        try:
            mod = importlib.import_module(f"apps.{modulo.name}.serializers")
        except Exception:
            continue
        for nombre in dir(mod):
            cls = getattr(mod, nombre)
            if not (isinstance(cls, type) and issubclass(cls, S.ModelSerializer)):
                continue
            modelo = getattr(getattr(cls, "Meta", None), "model", None)
            if modelo is None:
                continue
            campos = [f.name for f in modelo._meta.get_fields() if isinstance(f, FileField)]
            if not campos:
                continue
            declarados = getattr(cls.Meta, "fields", None)
            expuestos = [
                c for c in campos
                if declarados in ("__all__", None) or c in (declarados or ())
            ]
            if expuestos and not issubclass(cls, archivos.ArchivosFirmadosMixin):
                sin_firmar.append(f"apps.{modulo.name}.{nombre} → {expuestos}")

    assert not sin_firmar, (
        "Estos serializers devuelven la ruta directa a /media/, que ya no se "
        "sirve —y si volviera a servirse, quedarían públicos:\n  "
        + "\n  ".join(sin_firmar)
    )


# ── El token ────────────────────────────────────────────────────────────────


def test_un_token_valido_devuelve_la_ruta_real(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    (tmp_path / "incidencias").mkdir()
    archivo = tmp_path / "incidencias" / "foto.jpg"
    archivo.write_bytes(b"\xff\xd8imagen")

    assert archivos.ruta_de(archivos.firmar("incidencias/foto.jpg")) == archivo.resolve()


def test_un_token_manipulado_no_sirve(tmp_path, settings):
    """Sin la SECRET_KEY no se puede fabricar un enlace."""
    settings.MEDIA_ROOT = tmp_path
    token = archivos.firmar("incidencias/foto.jpg")
    assert archivos.ruta_de(token[:-3] + "xyz") is None
    assert archivos.ruta_de("cualquier-cosa") is None


def test_un_token_vencido_no_sirve(tmp_path, settings, monkeypatch):
    settings.MEDIA_ROOT = tmp_path
    (tmp_path / "x.jpg").write_bytes(b"x")
    token = archivos.firmar("x.jpg")
    assert archivos.ruta_de(token) is not None

    # Se lo envejece moviendo el límite, no esperando ocho horas.
    monkeypatch.setattr(archivos, "VIGENCIA_SEGUNDOS", -1)
    assert archivos.ruta_de(token) is None


def test_no_se_puede_salir_de_media_con_un_token(tmp_path, settings):
    """Defensa en profundidad: aunque la ruta venga firmada por nosotros, un
    bug en lo que se firma no debe convertirse en leer cualquier archivo del
    servidor."""
    settings.MEDIA_ROOT = tmp_path / "media"
    (tmp_path / "media").mkdir()
    (tmp_path / "secreto.env").write_text("SECRET_KEY=xxx")

    # Se firma a mano una ruta que escapa, como si el bug ya existiera.
    token = signing.dumps("../secreto.env", salt=archivos.SALT)
    assert archivos.ruta_de(token) is None


def test_un_directorio_no_se_sirve(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    (tmp_path / "incidencias").mkdir()
    assert archivos.ruta_de(archivos.firmar("incidencias")) is None


# ── El endpoint ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_el_endpoint_entrega_el_archivo_y_no_lo_deja_cachear(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    (tmp_path / "foto.jpg").write_bytes(b"\xff\xd8contenido")

    resp = APIClient().get(f"/api/archivos/{archivos.firmar('foto.jpg')}/")
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content) == b"\xff\xd8contenido"
    # El agujero anterior servía esto con `public` por 7 días: las cachés
    # intermedias también guardaban copia.
    assert resp["Cache-Control"] == "private, no-store"


@pytest.mark.django_db
def test_un_token_invalido_da_404_y_no_dice_por_que(tmp_path, settings):
    """404 para firma mala, vencida o que apunte afuera: distinguirlas le
    diría a quien prueba tokens cuál de las tres falló."""
    settings.MEDIA_ROOT = tmp_path
    assert APIClient().get("/api/archivos/inventado/").status_code == 404


@pytest.mark.django_db
def test_un_adjunto_html_o_svg_se_descarga_en_vez_de_abrirse(tmp_path, settings):
    """Se sirven desde el mismo origen que la app: un SVG con script podría
    leer el token de localStorage."""
    settings.MEDIA_ROOT = tmp_path
    (tmp_path / "malo.svg").write_bytes(b"<svg onload='alert(1)'></svg>")

    resp = APIClient().get(f"/api/archivos/{archivos.firmar('malo.svg')}/")
    assert resp["Content-Disposition"].startswith("attachment")
    assert resp["X-Content-Type-Options"] == "nosniff"


# ── La configuración de producción ─────────────────────────────────────────


@pytest.mark.skipif(not NGINX.exists(), reason="no está la plantilla de nginx")
def test_nginx_no_sirve_media_entero():
    """Es el archivo donde estaba el agujero, y es config que se rompe en
    silencio: nadie se entera hasta que alguien la busca a mano."""
    contenido = NGINX.read_text()
    desde = contenido.index("location /media/ {") + len("location /media/ {")
    bloque = contenido[desde:contenido.index("}", desde)]

    assert "location /media/logos/" in contenido
    assert "return 404" in bloque, (
        "nginx volvió a servir /media/ entero: fotos de estudiantes y adjuntos "
        "de convivencia quedan descargables sin sesión"
    )
    assert "alias /usr/share/nginx/html/media/;" not in contenido
    assert "Cache-Control" not in bloque


# ── Las contraseñas iniciales de los seeds ─────────────────────────────────
#
# Borrar los CSV que había arreglaba el síntoma: `seed_asistencia` los volvía
# a escribir, y elegía MEDIA_ROOT "porque es writable en Docker" — o sea la
# única carpeta que nginx publicaba. El recordatorio de borrarlos era una
# advertencia en pantalla.


def test_no_se_pueden_escribir_credenciales_dentro_de_media(tmp_path, settings):
    """Ni pidiéndolo a mano: es la carpeta que se sirve, y el error que se
    cometió una vez no debe poder repetirse pasando un argumento."""
    from apps.core import credenciales

    settings.MEDIA_ROOT = tmp_path / "media"
    (tmp_path / "media").mkdir()

    with pytest.raises(credenciales.DestinoInseguro):
        credenciales.escribir_csv(
            str(tmp_path / "media" / "creds.csv"), ["u"], [["ana"]],
        )
    assert not (tmp_path / "media" / "creds.csv").exists()


def test_el_csv_de_credenciales_solo_lo_lee_su_dueno(tmp_path, settings):
    from apps.core import credenciales

    settings.MEDIA_ROOT = tmp_path / "media"
    ruta = credenciales.escribir_csv(
        str(tmp_path / "fuera" / "creds.csv"),
        ["username", "password_inicial"], [["ana", "x7k2"]],
    )
    assert oct(ruta.stat().st_mode)[-3:] == "600", "son contraseñas en texto plano"


def test_por_defecto_los_seeds_no_dejan_ningun_archivo(tmp_path, settings, capsys):
    """El default seguro: salen por pantalla, que es donde ya está mirando
    quien corre el comando."""
    from django.core.management.color import no_style

    from apps.core import credenciales

    settings.MEDIA_ROOT = tmp_path / "media"

    class Salida:
        def __init__(self): self.lineas = []
        def write(self, t): self.lineas.append(str(t))

    salida = Salida()
    credenciales.mostrar(
        salida, no_style(), ["username", "password_inicial"],
        [["ana", "x7k2"]], None,
    )
    texto = "\n".join(salida.lineas)
    assert "x7k2" in texto, "las credenciales tienen que verse en pantalla"
    assert "No se guardó ningún archivo" in texto
    assert not list(tmp_path.rglob("*.csv")), "dejó un archivo sin que se lo pidieran"
