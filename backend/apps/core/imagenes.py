"""Compresión automática de imágenes subidas para ahorrar espacio en BD/media.
Redimensiona a max 1200×1200 px y comprime a JPEG calidad 85% (o WebP)."""
import io
from pathlib import Path

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

MAX_LADO_PX = 1200
CALIDAD_JPEG = 85
TAMANO_MAX_MB = 5


def comprimir_imagen_field(field_file):
    """Recibe un ImageField / FileField ya guardado y lo comprime in-place.
    Retorna True si se comprimió, False si no aplica."""
    if not field_file or not field_file.name:
        return False

    ext = Path(field_file.name).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"):
        return False  # No es imagen soportada

    try:
        img = Image.open(field_file)
    except (OSError, ValueError, Image.UnidentifiedImageError):
        return False

    # Rotar según EXIF (para fotos de celular)
    img = ImageOps.exif_transpose(img)

    if img.mode in ("RGBA", "LA", "P"):
        # Fondo blanco para transparencias al convertir a JPEG
        fondo = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        fondo.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        img = fondo
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Redimensionar si excede el máximo
    if img.width > MAX_LADO_PX or img.height > MAX_LADO_PX:
        img.thumbnail((MAX_LADO_PX, MAX_LADO_PX), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=CALIDAD_JPEG, optimize=True)
    buf.seek(0)

    # Reemplazar el archivo original con la versión comprimida
    nuevo_nombre = str(Path(field_file.name).with_suffix(".jpg"))
    field_file.save(nuevo_nombre, ContentFile(buf.read()), save=False)
    return True


def validar_tamano_archivo(archivo):
    """Valida que no exceda TAMANO_MAX_MB. Levanta ValidationError si sí."""
    from django.core.exceptions import ValidationError
    tam_mb = archivo.size / 1024 / 1024
    if tam_mb > TAMANO_MAX_MB:
        raise ValidationError(f"El archivo excede {TAMANO_MAX_MB} MB (subiste {tam_mb:.1f} MB).")


def validar_upload_serializer(archivo, campo="archivo"):
    """Helper para validate_<field>() en serializers. Enforza límite duro de tamaño."""
    from rest_framework import serializers as drf_s
    if archivo is None:
        return archivo
    tam_mb = archivo.size / 1024 / 1024
    if tam_mb > TAMANO_MAX_MB:
        raise drf_s.ValidationError(
            f"El archivo '{campo}' excede el máximo permitido de {TAMANO_MAX_MB} MB "
            f"(subiste {tam_mb:.1f} MB)."
        )
    return archivo
