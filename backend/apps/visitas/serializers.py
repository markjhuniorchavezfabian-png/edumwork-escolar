from rest_framework import serializers
from .models import Visita


class VisitaSerializer(serializers.ModelSerializer):
    motivo_label = serializers.CharField(source="get_motivo_display", read_only=True)
    dentro = serializers.BooleanField(read_only=True)
    duracion_minutos = serializers.IntegerField(read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Visita
        fields = [
            "id", "codigo_gafete",
            "dni", "nombre_completo", "telefono",
            "motivo", "motivo_label", "a_quien_visita", "observaciones",
            "hora_entrada", "hora_salida", "dentro", "duracion_minutos",
            "registrado_por", "registrado_por_nombre",
            "creado_en",
        ]
        read_only_fields = [
            "id", "codigo_gafete", "hora_entrada", "hora_salida",
            "registrado_por", "registrado_por_nombre", "dentro", "duracion_minutos", "creado_en",
        ]

    def get_registrado_por_nombre(self, obj):
        u = obj.registrado_por
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def validate_dni(self, v):
        v = v.strip()
        if len(v) != 8 or not v.isdigit():
            raise serializers.ValidationError("DNI debe tener 8 dígitos.")
        return v
