from rest_framework import serializers

from apps.usuarios.models import Estudiante
from .models import EstadoAsistencia, RegistroAsistencia


class EstudianteListaSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="pk")
    nombre_completo = serializers.SerializerMethodField()
    dni = serializers.CharField(source="usuario.dni", read_only=True)
    grado = serializers.CharField()
    seccion = serializers.CharField()
    codigo_matricula = serializers.CharField()
    usuario_id = serializers.IntegerField(source="usuario.id", read_only=True)

    class Meta:
        model = Estudiante
        fields = ["id", "nombre_completo", "dni", "grado", "seccion", "codigo_matricula", "usuario_id"]

    def get_nombre_completo(self, obj):
        u = obj.usuario
        return f"{u.first_name} {u.last_name}".strip() or u.username


class RegistroAsistenciaSerializer(serializers.ModelSerializer):
    estudiante_nombre = serializers.SerializerMethodField(read_only=True)
    estudiante_grado = serializers.CharField(source="estudiante.grado", read_only=True)
    estudiante_seccion = serializers.CharField(source="estudiante.seccion", read_only=True)
    marcado_por_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RegistroAsistencia
        fields = [
            "id", "estudiante", "estudiante_nombre", "estudiante_grado", "estudiante_seccion",
            "fecha", "estado", "hora_llegada", "justificacion",
            "marcado_por", "marcado_por_nombre",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "marcado_por", "marcado_por_nombre", "creado_en", "actualizado_en"]

    def get_estudiante_nombre(self, obj):
        u = obj.estudiante.usuario
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_marcado_por_nombre(self, obj):
        u = obj.marcado_por
        return f"{u.first_name} {u.last_name}".strip() or u.username


class MarcaMasivaSerializer(serializers.Serializer):
    """Payload para marcar asistencia de varios estudiantes de una vez."""
    fecha = serializers.DateField()
    registros = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
    )

    def validate_registros(self, valor):
        estados_validos = [c for c, _ in EstadoAsistencia.choices]
        for i, r in enumerate(valor):
            if "estudiante" not in r or "estado" not in r:
                raise serializers.ValidationError(
                    f"Registro {i}: falta 'estudiante' o 'estado'."
                )
            if r["estado"] not in estados_validos:
                raise serializers.ValidationError(
                    f"Registro {i}: estado inválido. Opciones: {estados_validos}"
                )
        return valor
