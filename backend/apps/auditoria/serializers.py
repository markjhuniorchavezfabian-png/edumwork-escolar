from rest_framework import serializers
from .models import Auditoria


class AuditoriaSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Auditoria
        fields = [
            "id", "usuario_username", "tipo", "tipo_label",
            "modelo", "objeto_id", "descripcion", "cambios",
            "ip_origen", "creado_en",
        ]
