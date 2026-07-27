"""Backfill: crea Secciones desde los strings grado/seccion de los estudiantes,
asigna docente1 como tutor y docente asignado de todas (MVP)."""
from django.db import migrations


def poblar_secciones(apps, schema_editor):
    Estudiante = apps.get_model("usuarios", "Estudiante")
    Seccion = apps.get_model("usuarios", "Seccion")
    Usuario = apps.get_model("usuarios", "Usuario")

    docente = Usuario.objects.filter(rol="docente").first()

    combinaciones = (
        Estudiante.objects.exclude(grado="", seccion="")
        .values_list("grado", "seccion")
        .distinct()
    )
    for grado, letra in combinaciones:
        nombre = f"{grado} {letra}".strip()
        seccion, _ = Seccion.objects.get_or_create(
            grado=grado,
            letra=letra,
            defaults={"nombre": nombre, "tutor": docente},
        )
        if docente:
            seccion.docentes.add(docente)
        Estudiante.objects.filter(grado=grado, seccion=letra).update(seccion_obj=seccion)


def revertir(apps, schema_editor):
    Seccion = apps.get_model("usuarios", "Seccion")
    Seccion.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0002_seccion_estudiante_seccion_obj"),
    ]
    operations = [
        migrations.RunPython(poblar_secciones, revertir),
    ]
