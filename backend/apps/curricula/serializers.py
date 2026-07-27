from rest_framework import serializers

from .models import AreaCurricular, Capacidad, Competencia, Desempeno


class DesempenoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Desempeno
        fields = ["id", "grado", "descripcion", "orden"]


class CapacidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Capacidad
        fields = ["id", "nombre", "orden"]


class CompetenciaSerializer(serializers.ModelSerializer):
    capacidades = CapacidadSerializer(many=True, read_only=True)
    desempenos = DesempenoSerializer(many=True, read_only=True)

    class Meta:
        model = Competencia
        fields = ["id", "numero", "nombre", "capacidades", "desempenos"]


class CompetenciaResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Competencia
        fields = ["id", "numero", "nombre"]


class AreaSerializer(serializers.ModelSerializer):
    competencias = CompetenciaSerializer(many=True, read_only=True)

    class Meta:
        model = AreaCurricular
        fields = ["id", "nombre", "nivel", "orden", "competencias"]


class AreaResumenSerializer(serializers.ModelSerializer):
    num_competencias = serializers.IntegerField(
        source="competencias.count", read_only=True
    )

    class Meta:
        model = AreaCurricular
        fields = ["id", "nombre", "nivel", "orden", "num_competencias"]
