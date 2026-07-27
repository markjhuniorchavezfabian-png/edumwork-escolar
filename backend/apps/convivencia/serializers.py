from rest_framework import serializers

from apps.core.imagenes import validar_upload_serializer
from .models import CasoConvivencia, SeguimientoCaso


class SeguimientoCasoSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField(read_only=True)
    accion_label = serializers.CharField(source="get_accion_display", read_only=True)

    class Meta:
        model = SeguimientoCaso
        fields = ["id", "caso", "autor", "autor_nombre", "accion", "accion_label",
                  "detalle", "adjunto", "creado_en"]
        read_only_fields = ["id", "autor", "autor_nombre", "creado_en"]

    def validate_adjunto(self, value):
        return validar_upload_serializer(value, "adjunto")

    def get_autor_nombre(self, obj):
        return obj.autor.get_full_name() or obj.autor.username


class CasoConvivenciaSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    gravedad_label = serializers.CharField(source="get_gravedad_display", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    reportado_por_nombre = serializers.SerializerMethodField(read_only=True)
    responsable_nombre = serializers.SerializerMethodField(read_only=True)
    dias_restantes = serializers.IntegerField(read_only=True)
    alerta_plazo = serializers.CharField(read_only=True)
    seguimientos = SeguimientoCasoSerializer(many=True, read_only=True)
    afectados_detalle = serializers.SerializerMethodField(read_only=True)
    agresores_detalle = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CasoConvivencia
        fields = [
            "id", "codigo",
            "tipo", "tipo_label",
            "gravedad", "gravedad_label",
            "estado", "estado_label",
            "fecha_hecho", "fecha_reporte", "fecha_limite",
            "dias_restantes", "alerta_plazo",
            "ubicacion", "descripcion",
            "estudiantes_afectados", "afectados_detalle",
            "estudiantes_agresores", "agresores_detalle",
            "reportado_por", "reportado_por_nombre",
            "responsable", "responsable_nombre",
            "confidencial", "reportado_siseve", "fecha_reporte_siseve",
            "codigo_siseve", "registrado_libro_incidencias", "fecha_registro_libro",
            "responsable_convivencia", "coordinador_tutoria", "responsable_inclusion",
            "pasos_protocolo",
            "seguimientos",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "codigo", "fecha_reporte", "fecha_limite",
                            "dias_restantes", "alerta_plazo", "reportado_por",
                            "seguimientos", "creado_en", "actualizado_en"]

    def get_reportado_por_nombre(self, obj):
        return obj.reportado_por.get_full_name() or obj.reportado_por.username

    def get_responsable_nombre(self, obj):
        return (obj.responsable.get_full_name() or obj.responsable.username) if obj.responsable else None

    def _detalle_est(self, qs):
        return [{
            "id": e.pk,
            "nombre": e.usuario.get_full_name() or e.usuario.username,
            "seccion": f"{e.grado} {e.seccion}",
        } for e in qs.select_related("usuario")]

    def get_afectados_detalle(self, obj):
        return self._detalle_est(obj.estudiantes_afectados.all())

    def get_agresores_detalle(self, obj):
        return self._detalle_est(obj.estudiantes_agresores.all())
