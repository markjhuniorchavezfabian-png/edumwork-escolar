from rest_framework import serializers
from .models import Ambiente


class AmbienteSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    responsable_nombre = serializers.SerializerMethodField(read_only=True)
    cantidad_equipos = serializers.SerializerMethodField(read_only=True)
    es_reservable = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ambiente
        fields = [
            "id", "nombre", "codigo",
            "tipo", "tipo_label",
            "piso", "edificio", "capacidad",
            "responsable", "responsable_nombre",
            "reservable", "es_reservable", "activo", "notas",
            "cantidad_equipos",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en"]

    def get_responsable_nombre(self, obj):
        return obj.responsable.get_full_name() if obj.responsable else None

    def get_cantidad_equipos(self, obj):
        # Import diferido para evitar circular
        from apps.inventario.models import Equipo
        return Equipo.objects.filter(ambiente=obj).count()
