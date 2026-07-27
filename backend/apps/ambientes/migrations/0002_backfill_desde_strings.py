"""Backfill: crea Ambientes desde los strings 'ubicacion' que ya existen
en Inventario e Incidencias, y vincula por FK cuando sea posible."""
from django.db import migrations


TIPO_POR_NOMBRE = {
    # Palabras clave para inferir el tipo
    "aip": "aip",
    "aula de innovación": "aip",
    "aula de innovacion": "aip",
    "laboratorio": "laboratorio",
    "biblioteca": "biblioteca",
    "sala de música": "sala_musica",
    "sala de musica": "sala_musica",
    "arte": "sala_musica",
    "sala de docentes": "sala_docentes",
    "dirección": "direccion",
    "direccion": "direccion",
    "subdirección": "direccion",
    "subdireccion": "direccion",
    "secretaría": "secretaria",
    "secretaria": "secretaria",
    "patio": "patio",
    "losa": "patio",
    "auditorio": "auditorio",
    "salón de actos": "auditorio",
    "almacén": "almacen",
    "almacen": "almacen",
    "ss.hh": "ss_hh",
    "baño": "ss_hh",
    "aula": "aula_regular",
}


def inferir_tipo(nombre: str) -> str:
    low = (nombre or "").lower()
    for palabra, tipo in TIPO_POR_NOMBRE.items():
        if palabra in low:
            return tipo
    return "otro"


def generar_codigo(nombre: str) -> str:
    """Ej: 'Aula 5to A' → 'A-5A'  ·  'Laboratorio de Química' → 'LAB-QUI'."""
    low = (nombre or "").lower()
    if "aula" in low:
        # extrae parte después de aula
        resto = low.replace("aula", "").strip()
        return f"AULA-{resto.upper().replace(' ', '')}"[:20]
    if "aip" in low:
        return "AIP"
    if "biblio" in low:
        return "BIB"
    if "labor" in low:
        return f"LAB-{low.split('laboratorio')[-1].strip().upper().replace(' ', '')[:8]}"
    if "secreta" in low:
        return "SEC"
    if "direcc" in low:
        return "DIR"
    if "docent" in low:
        return "SD"
    # Fallback: primeras 3 letras + hash
    limpio = "".join(c for c in nombre if c.isalnum())[:12].upper()
    return f"AMB-{limpio}"[:20]


def poblar(apps, schema_editor):
    Ambiente = apps.get_model("ambientes", "Ambiente")
    Equipo = apps.get_model("inventario", "Equipo")
    Incidencia = apps.get_model("incidencias", "Incidencia")

    # Recolectar strings únicos de ubicacion
    ubicaciones = set()
    ubicaciones.update(Equipo.objects.exclude(ubicacion="").values_list("ubicacion", flat=True))
    ubicaciones.update(Incidencia.objects.exclude(ubicacion="").values_list("ubicacion", flat=True))

    # Crear Ambientes
    codigos_usados = set()
    for nombre in sorted(ubicaciones):
        nombre = nombre.strip()
        if not nombre:
            continue
        tipo = inferir_tipo(nombre)
        codigo_base = generar_codigo(nombre)
        codigo = codigo_base
        n = 1
        while codigo in codigos_usados or Ambiente.objects.filter(codigo=codigo).exists():
            n += 1
            codigo = f"{codigo_base}-{n}"
        codigos_usados.add(codigo)

        amb, creado = Ambiente.objects.get_or_create(
            nombre=nombre,
            defaults={
                "codigo": codigo,
                "tipo": tipo,
                "activo": True,
            },
        )
        # Vincular equipos e incidencias con el mismo string
        Equipo.objects.filter(ubicacion=nombre, ambiente__isnull=True).update(ambiente=amb)


def revertir(apps, schema_editor):
    Ambiente = apps.get_model("ambientes", "Ambiente")
    Ambiente.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("ambientes", "0001_initial"),
        ("inventario", "0002_equipo_ambiente_alter_equipo_ubicacion"),
        ("incidencias", "0002_incidencia_foto_comentarioincidencia"),
    ]
    operations = [
        migrations.RunPython(poblar, revertir),
    ]
