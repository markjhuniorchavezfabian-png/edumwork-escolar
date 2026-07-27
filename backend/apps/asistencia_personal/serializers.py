from rest_framework import serializers
from .models import RegistroPersonal


class RegistroPersonalSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField(read_only=True)
    usuario_rol = serializers.CharField(source="usuario.rol", read_only=True)
    usuario_rol_label = serializers.CharField(source="usuario.get_rol_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    marcado_por_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RegistroPersonal
        fields = [
            "id", "usuario", "usuario_nombre", "usuario_rol", "usuario_rol_label",
            "fecha", "hora_entrada", "hora_salida",
            "estado", "estado_label", "auto_tardanza",
            "observaciones", "documento_licencia",
            "marcado_por", "marcado_por_nombre",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "auto_tardanza", "creado_en", "actualizado_en"]

    def get_usuario_nombre(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username

    def get_marcado_por_nombre(self, obj):
        return (obj.marcado_por.get_full_name() or obj.marcado_por.username) if obj.marcado_por else None
