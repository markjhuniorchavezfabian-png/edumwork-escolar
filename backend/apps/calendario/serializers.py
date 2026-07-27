from rest_framework import serializers
from .models import AnioEscolar, DiaCalendario


class DiaCalendarioSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = DiaCalendario
        fields = ["id", "fecha", "tipo", "tipo_label", "descripcion", "anio_lectivo"]


class AnioEscolarSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnioEscolar
        fields = ["id", "anio", "fecha_inicio", "fecha_fin", "norma_referencia", "activo"]
