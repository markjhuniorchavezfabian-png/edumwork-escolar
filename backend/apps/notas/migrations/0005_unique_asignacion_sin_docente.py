from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('notas', '0003_anio_lectivo'),
        ('notas', '0004_horarioclase'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='asignaciondocente',
            unique_together={('seccion', 'area', 'anio_lectivo')},
        ),
    ]
