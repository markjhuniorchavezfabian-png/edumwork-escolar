from rest_framework import serializers
from .models import Equipo


class EquipoSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    ambiente_nombre = serializers.CharField(source="ambiente.nombre", read_only=True, default=None)
    ambiente_tipo = serializers.CharField(source="ambiente.tipo", read_only=True, default=None)
    ambiente_codigo = serializers.CharField(source="ambiente.codigo", read_only=True, default=None)

    class Meta:
        model = Equipo
        fields = [
            "id", "codigo_inventario", "tipo", "tipo_label",
            "marca", "modelo", "numero_serie",
            "ubicacion", "ambiente", "ambiente_nombre", "ambiente_tipo", "ambiente_codigo",
            "estado", "estado_label",
            "fecha_adquisicion", "valor_referencial",
            "observaciones", "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en", "tipo_label", "estado_label",
                            "ambiente_nombre", "ambiente_tipo", "ambiente_codigo"]
