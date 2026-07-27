# Renombrada de 0009_multi_tenant.py a 0010 para no conflictar con 0009_add_es_docente
# que ya fue aplicada en la BD del container.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0009_add_es_docente'),
    ]

    operations = [
        migrations.AddField(
            model_name='estudiante',
            name='owner',
            field=models.ForeignKey(blank=True, help_text='En modo personal: docente dueño. En institucional: NULL.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='+', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='seccion',
            name='owner',
            field=models.ForeignKey(blank=True, help_text='En modo personal: docente dueño. En institucional: NULL.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='+', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='usuario',
            name='integrado_a_ie_en',
            field=models.DateTimeField(blank=True, help_text='Fecha en que su cuenta personal se integró a una I.E. (si aplica).', null=True),
        ),
        migrations.AddField(
            model_name='usuario',
            name='modo_cuenta',
            field=models.CharField(choices=[('institucional', 'Institucional'), ('personal', 'Personal (docente solo)')], db_index=True, default='institucional', help_text="'personal' = docente en sub-app aislada. 'institucional' = miembro de una I.E.", max_length=15),
        ),
    ]
