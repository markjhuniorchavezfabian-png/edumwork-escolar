from rest_framework import serializers

from apps.core.imagenes import validar_upload_serializer
from apps.usuarios.models import Rol

from .models import ComentarioIncidencia, EstadoIncidencia, Incidencia
from apps.core.archivos import ArchivosFirmadosMixin


CAMPOS_SOLO_ADMIN = {"estado", "notas_admin", "asignado_a", "solucion", "prioridad"}


class ComentarioIncidenciaSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField(read_only=True)
    autor_rol = serializers.CharField(source="autor.rol", read_only=True)

    class Meta:
        model = ComentarioIncidencia
        fields = ["id", "incidencia", "autor", "autor_nombre", "autor_rol", "texto", "creado_en"]
        read_only_fields = ["id", "autor", "autor_nombre", "autor_rol", "creado_en"]

    def get_autor_nombre(self, obj):
        u = obj.autor
        return f"{u.first_name} {u.last_name}".strip() or u.username


class IncidenciaSerializer(ArchivosFirmadosMixin, serializers.ModelSerializer):
    reportado_por_nombre = serializers.SerializerMethodField(read_only=True)
    asignado_a_nombre = serializers.SerializerMethodField(read_only=True)
    estudiante_afectado_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Incidencia
        fields = [
            "id",
            "titulo",
            "descripcion",
            "ubicacion",
            "tipo",
            "prioridad",
            "estado",
            "reportado_por",
            "reportado_por_nombre",
            "asignado_a",
            "asignado_a_nombre",
            "fecha_atencion",
            "fecha_resolucion",
            "notas_admin",
            "solucion",
            "foto",
            "estudiante_afectado",
            "estudiante_afectado_nombre",
            "creado_en",
            "actualizado_en",
        ]
        read_only_fields = [
            "id",
            "reportado_por",
            "reportado_por_nombre",
            "asignado_a_nombre",
            "estudiante_afectado_nombre",
            "fecha_atencion",
            "fecha_resolucion",
            "creado_en",
            "actualizado_en",
        ]

    def validate_foto(self, value):
        return validar_upload_serializer(value, "foto")

    def get_reportado_por_nombre(self, obj):
        u = obj.reportado_por
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_estudiante_afectado_nombre(self, obj):
        if not obj.estudiante_afectado_id:
            return None
        u = obj.estudiante_afectado.usuario
        seccion = f"{obj.estudiante_afectado.grado} {obj.estudiante_afectado.seccion}".strip()
        nombre = f"{u.first_name} {u.last_name}".strip() or u.username
        return f"{nombre} ({seccion})" if seccion else nombre

    def get_asignado_a_nombre(self, obj):
        if not obj.asignado_a:
            return None
        u = obj.asignado_a
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def validate(self, attrs):
        request = self.context.get("request")
        instance = self.instance

        # Reglas al actualizar
        if request and instance is not None:
            user = request.user
            nuevo_estado = attrs.get("estado", instance.estado)

            # Si el docente es owner y solo puede cerrar sus resueltas:
            if user.rol == Rol.DOCENTE:
                # Solo permitir cambiar estado a 'cerrada' desde 'resuelta'
                campos_solicitados = set(self.initial_data.keys()) if hasattr(self, "initial_data") else set()
                no_permitidos = campos_solicitados & CAMPOS_SOLO_ADMIN - {"estado"}
                if no_permitidos:
                    raise serializers.ValidationError(
                        {c: "No tiene permiso para modificar este campo." for c in no_permitidos}
                    )
                if "estado" in campos_solicitados:
                    if not (instance.estado == EstadoIncidencia.RESUELTA and nuevo_estado == EstadoIncidencia.CERRADA):
                        raise serializers.ValidationError(
                            {"estado": "Solo puede cerrar una incidencia en estado 'resuelta'."}
                        )

            # Validación: al marcar 'resuelta' debe existir solucion no vacía
            if nuevo_estado == EstadoIncidencia.RESUELTA:
                nueva_solucion = attrs.get("solucion", instance.solucion)
                if not nueva_solucion or not nueva_solucion.strip():
                    raise serializers.ValidationError(
                        {"solucion": "Debe indicar la solución al marcar la incidencia como resuelta."}
                    )

        return attrs
