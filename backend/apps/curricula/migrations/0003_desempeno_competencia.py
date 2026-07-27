from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("curricula", "0002_alter_desempeno_options_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="desempeno",
            name="capacidad",
        ),
        migrations.AddField(
            model_name="desempeno",
            name="competencia",
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="desempenos",
                to="curricula.competencia",
            ),
            preserve_default=False,
        ),
        migrations.AlterModelOptions(
            name="desempeno",
            options={"ordering": ["competencia", "grado", "orden"]},
        ),
    ]
