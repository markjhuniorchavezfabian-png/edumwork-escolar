from rest_framework import serializers
from .models import Reserva


class ReservaSerializer(serializers.ModelSerializer):
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    ambiente_nombre = serializers.CharField(source="ambiente.nombre", read_only=True)
    ambiente_tipo = serializers.CharField(source="ambiente.tipo", read_only=True)
    solicitante_nombre = serializers.SerializerMethodField(read_only=True)
    revisado_por_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Reserva
        fields = [
            "id",
            "ambiente", "ambiente_nombre", "ambiente_tipo",
            "solicitante", "solicitante_nombre",
            "fecha", "hora_inicio", "hora_fin",
            "motivo", "descripcion", "participantes_estimados",
            "estado", "estado_label",
            "revisado_por", "revisado_por_nombre", "fecha_revision", "razon_rechazo",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = [
            "id", "solicitante", "revisado_por", "fecha_revision",
            "creado_en", "actualizado_en",
        ]

    def get_solicitante_nombre(self, obj):
        return obj.solicitante.get_full_name() or obj.solicitante.username

    def get_revisado_por_nombre(self, obj):
        return (obj.revisado_por.get_full_name() or obj.revisado_por.username) if obj.revisado_por else None

    def validate(self, attrs):
        hi = attrs.get("hora_inicio", getattr(self.instance, "hora_inicio", None))
        hf = attrs.get("hora_fin", getattr(self.instance, "hora_fin", None))
        if hi and hf and hi >= hf:
            raise serializers.ValidationError({"hora_fin": "Debe ser posterior a la hora de inicio."})
        return attrs
