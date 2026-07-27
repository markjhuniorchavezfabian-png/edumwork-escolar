# Stub: esta migración ya está aplicada en la BD del container.
# Se creó en algún punto en el container y quedó en django_migrations pero el archivo se perdió.
# Django solo lee esto para construir el grafo — no re-ejecuta la operación.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0008_ultimo_acceso'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='es_docente',
            field=models.BooleanField(
                default=False,
                help_text='Director/subdirector que también dicta clases. Habilita asignaciones y horario docente.',
            ),
        ),
    ]
