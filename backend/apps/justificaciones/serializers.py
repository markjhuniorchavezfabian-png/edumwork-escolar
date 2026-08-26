from rest_framework import serializers

from apps.core.imagenes import validar_upload_serializer

from .models import Justificacion
from apps.core.archivos import ArchivosFirmadosMixin


class JustificacionSerializer(ArchivosFirmadosMixin, serializers.ModelSerializer):
    estudiante_nombre = serializers.SerializerMethodField(read_only=True)
    estudiante_seccion = serializers.SerializerMethodField(read_only=True)
    motivo_label = serializers.CharField(source="get_motivo_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    reportada_por_nombre = serializers.SerializerMethodField(read_only=True)
    revisada_por_nombre = serializers.SerializerMethodField(read_only=True)
    puede_gestionar = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Justificacion
        fields = [
            "id",
            "estudiante", "estudiante_nombre", "estudiante_seccion",
            "fecha_falta",
            "motivo", "motivo_label",
            "descripcion", "constancia",
            "reportada_por", "reportada_por_nombre",
            "estado", "estado_label",
            "revisada_por", "revisada_por_nombre",
            "fecha_revision", "razon_rechazo",
            "puede_gestionar",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = [
            "id", "reportada_por", "revisada_por", "fecha_revision",
            "creado_en", "actualizado_en",
        ]

    def get_estudiante_nombre(self, obj):
        u = obj.estudiante.usuario
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_estudiante_seccion(self, obj):
        return f"{obj.estudiante.grado} {obj.estudiante.seccion}".strip()

    def get_reportada_por_nombre(self, obj):
        return obj.reportada_por.get_full_name() or obj.reportada_por.username

    def get_revisada_por_nombre(self, obj):
        return (obj.revisada_por.get_full_name() or obj.revisada_por.username) if obj.revisada_por else None

    def validate_constancia(self, value):
        return validar_upload_serializer(value, "constancia")

    def get_puede_gestionar(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        from apps.justificaciones.views import puede_gestionar_justificacion
        return puede_gestionar_justificacion(request.user, obj)
