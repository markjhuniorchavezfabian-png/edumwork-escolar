# Generated manually for SIAGIE template adapters.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notas", "0008_alter_asignaciondocente_docente"),
    ]

    operations = [
        migrations.AddField(
            model_name="siagiemapeo",
            name="tipo_template",
            field=models.CharField(
                choices=[("notas", "Notas"), ("asistencia", "Asistencia")],
                db_index=True,
                default="notas",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="siagiemapeo",
            name="hash_header",
            field=models.CharField(db_index=True, max_length=64),
        ),
        migrations.AlterUniqueTogether(
            name="siagiemapeo",
            unique_together={("tipo_template", "hash_header")},
        ),
    ]
