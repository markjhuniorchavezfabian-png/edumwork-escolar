"""Los archivos subidos se sirven con una URL firmada y con vencimiento.

EL PROBLEMA QUE RESUELVE
`nginx.conf.template` servía `/media/` entero con `alias` al volumen y
`Cache-Control: public` por siete días, y `docker-compose.prod.yml` monta ese
volumen dentro del contenedor de nginx (`media_data:/usr/share/nginx/html/
media:ro`). O sea: fotos de estudiantes, adjuntos de casos de convivencia,
justificaciones de inasistencia y licencias médicas del personal, descargables
por cualquiera que tuviera la URL, sin sesión, y con copia en cachés
intermedias.

POR QUÉ FIRMA Y NO UN ENDPOINT AUTENTICADO POR MODELO
Porque esta app manda el JWT en un header `Authorization` desde localStorage,
y un `<img src="...">` no manda headers. Para verificar la sesión en cada
descarga habría que reescribir cada pantalla para traer el archivo con axios y
armar un blob — nueve modelos, nueve endpoints y nueve pantallas. Dieciocho
cambios en un sistema que ya está entregado a un colegio son dieciocho lugares
donde equivocarse, y uno que se olvida.

Con firma hay **un solo lugar** donde vive la decisión, y el `<img src>` de
las pantallas no se toca: lo único que cambia es la URL que devuelve el
serializer.

QUÉ GARANTIZA Y QUÉ NO
Garantiza: no se puede adivinar ni enumerar una ruta, no se puede fabricar un
enlace sin la SECRET_KEY, el enlace caduca, y ninguna caché intermedia guarda
copia.

No garantiza: quien reciba un enlace válido lo abre mientras no expire, sin
estar logueado. Es el mismo compromiso que hacen las URLs prefirmadas de S3, y
es la contrapartida de que un `<img src>` no pueda autenticarse. Si alguna
categoría necesita verificación por descarga —convivencia y licencias son las
candidatas— hay que llevarla al patrón de blob, y esto no lo estorba.
"""
from pathlib import Path

from django.conf import settings
from django.core import signing

# El propósito entra en la firma: un token de archivos no vale para nada más
# aunque comparta la SECRET_KEY.
SALT = "media.archivos"

# Cuánto vive un enlace. Ocho horas cubre una jornada escolar —el docente abre
# la app en la mañana y toca un adjunto en la tarde sin que se le rompa— y al
# día siguiente un enlace reenviado ya no sirve.
#
# Bajarlo es más seguro y rompe la pestaña que quedó abierta; subirlo es lo
# contrario. Se cambia acá y en ningún otro lado.
VIGENCIA_SEGUNDOS = getattr(settings, "ARCHIVOS_FIRMA_SEGUNDOS", 8 * 60 * 60)


def firmar(nombre: str) -> str:
    """El token de un archivo, a partir de su ruta relativa dentro de media."""
    return signing.dumps(str(nombre), salt=SALT)


def ruta_de(token: str) -> Path | None:
    """La ruta real de un token válido, o None.

    Devuelve None y no una excepción para todos los casos —firma inválida,
    vencido, o apuntando fuera de media— porque la vista los responde igual:
    404. Distinguirlos le diría a quien prueba tokens cuál de los tres falló.
    """
    try:
        relativa = signing.loads(token, salt=SALT, max_age=VIGENCIA_SEGUNDOS)
    except signing.BadSignature:
        return None

    raiz = Path(settings.MEDIA_ROOT).resolve()
    try:
        destino = (raiz / str(relativa)).resolve()
    except (OSError, ValueError):
        return None

    # Aunque la ruta venga firmada por nosotros, se comprueba que caiga dentro
    # de media. Es defensa en profundidad: un bug en lo que firmamos no debe
    # convertirse en lectura de cualquier archivo del servidor.
    if not destino.is_relative_to(raiz) or not destino.is_file():
        return None
    return destino


def url_firmada(archivo, request=None) -> str | None:
    """La URL con la que el frontend pide este archivo. None si no hay archivo.

    Es lo que los serializers devuelven en lugar de `.url`: esa apuntaba a
    `/media/...`, que ya no se sirve.
    """
    if not archivo:
        return None
    ruta = f"/api/archivos/{firmar(archivo.name)}/"
    return request.build_absolute_uri(ruta) if request is not None else ruta


class ArchivosFirmadosMixin:
    """Los campos de archivo salen como enlace firmado, no como `/media/...`.

    Se aplica agregándolo a las bases del serializer y nada más:

        class IncidenciaSerializer(ArchivosFirmadosMixin, ModelSerializer):

    Va como mixin y no declarando cada campo a mano porque los ocho
    serializers afectados usan el `FileField` que DRF genera solo. Declararlos
    uno por uno significaría repetir en cada uno los `required` y `allow_null`
    que correspondan a su modelo — ocho lugares para equivocarse en algo que
    no aporta nada. Así el cambio por serializer es una palabra, y el campo
    sigue aceptando la subida igual que antes: sólo cambia lo que se devuelve.
    """

    def _campos_de_archivo(self) -> list[str]:
        from django.db.models import FileField

        modelo = getattr(getattr(self, "Meta", None), "model", None)
        if modelo is None:
            return []
        return [
            f.name for f in modelo._meta.get_fields()
            if isinstance(f, FileField)
        ]

    def to_representation(self, instance):
        datos = super().to_representation(instance)
        peticion = self.context.get("request")
        for nombre in self._campos_de_archivo():
            if nombre in datos:
                datos[nombre] = url_firmada(getattr(instance, nombre, None), peticion)
        return datos
