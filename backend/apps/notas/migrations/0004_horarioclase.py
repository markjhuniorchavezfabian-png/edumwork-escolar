# Stub: HorarioClase ya existe en la BD del container (0004_horarioclase aplicada).
# Este archivo restaura el grafo para Django. No re-ejecuta operaciones.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notas', '0003_anio_lectivo'),
    ]

    operations = [
        migrations.CreateModel(
            name='HorarioClase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dia_semana', models.CharField(choices=[('lun', 'Lunes'), ('mar', 'Martes'), ('mie', 'Miércoles'), ('jue', 'Jueves'), ('vie', 'Viernes'), ('sab', 'Sábado')], max_length=3)),
                ('hora_inicio', models.TimeField()),
                ('hora_fin', models.TimeField()),
                ('aula', models.CharField(blank=True, default='', max_length=60)),
                ('asignacion', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='horarios', to='notas.asignaciondocente')),
            ],
            options={
                'db_table': 'horarios_clase',
                'ordering': ['dia_semana', 'hora_inicio'],
                'unique_together': {('asignacion', 'dia_semana', 'hora_inicio')},
            },
        ),
    ]
