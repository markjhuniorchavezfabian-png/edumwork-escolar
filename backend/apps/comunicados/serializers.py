from rest_framework import serializers

from apps.core.imagenes import validar_upload_serializer
from apps.usuarios.models import Rol
from .models import Comunicado, LecturaComunicado


class ComunicadoSerializer(serializers.ModelSerializer):
    categoria_label = serializers.CharField(source="get_categoria_display", read_only=True)
    alcance_label = serializers.CharField(source="get_alcance_display", read_only=True)
    seccion_nombre = serializers.CharField(source="seccion.nombre", read_only=True, default=None)
    autor_nombre = serializers.SerializerMethodField(read_only=True)
    autor_rol_label = serializers.CharField(source="autor.get_rol_display", read_only=True)
    total_alcance = serializers.SerializerMethodField(read_only=True)
    total_lecturas = serializers.SerializerMethodField(read_only=True)
    porcentaje_lectura = serializers.SerializerMethodField(read_only=True)
    ya_leido = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Comunicado
        fields = [
            "id", "titulo", "cuerpo",
            "categoria", "categoria_label",
            "alcance", "alcance_label",
            "seccion", "seccion_nombre",
            "fecha_publicacion", "fecha_evento",
            "autor", "autor_nombre", "autor_rol_label",
            "adjunto", "activo",
            "total_alcance", "total_lecturas", "porcentaje_lectura", "ya_leido",
        ]
        read_only_fields = ["id", "fecha_publicacion", "autor"]

    def validate_adjunto(self, value):
        return validar_upload_serializer(value, "adjunto")

    def get_autor_nombre(self, obj):
        return obj.autor.get_full_name() or obj.autor.username

    def get_total_alcance(self, obj):
        """Cantidad estimada de personas a las que apunta el comunicado."""
        from apps.usuarios.models import Usuario
        qs = Usuario.objects.filter(activo=True)
        if obj.alcance == "toda_ie":
            return qs.count()
        if obj.alcance == "staff":
            return qs.exclude(rol__in=[Rol.PADRE, Rol.ESTUDIANTE, "ugel"]).count()
        if obj.alcance == "padres":
            return qs.filter(rol=Rol.PADRE).count()
        if obj.alcance == "seccion" and obj.seccion_id:
            # Padres y docentes de esa sección
            from apps.core.models import ConfiguracionInstitucional
            from apps.usuarios.models import Matricula
            cfg = ConfiguracionInstitucional.get_solo()
            anio = cfg.anio_lectivo_activo or 2026
            padres = qs.filter(
                rol=Rol.PADRE,
                perfil_padre__hijos__matriculas__seccion=obj.seccion,
                perfil_padre__hijos__matriculas__anio_lectivo=anio,
            ).distinct().count()
            docentes = obj.seccion.docentes.filter(activo=True).count()
            return padres + docentes
        return 0

    def get_total_lecturas(self, obj):
        return obj.lecturas.count()

    def get_porcentaje_lectura(self, obj):
        total = self.get_total_alcance(obj)
        leidos = self.get_total_lecturas(obj)
        return round(leidos / total * 100, 1) if total else 0.0

    def get_ya_leido(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.lecturas.filter(usuario=request.user).exists()


class LecturaComunicadoSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()
    usuario_rol = serializers.CharField(source="usuario.rol", read_only=True)

    class Meta:
        model = LecturaComunicado
        fields = ["id", "usuario", "usuario_nombre", "usuario_rol", "leido_en", "ip_origen"]

    def get_usuario_nombre(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username
