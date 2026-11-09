from rest_framework import serializers

from apps.core.imagenes import validar_upload_serializer

from .models import Curso, Entrega, Leccion, Recurso, Tarea
from apps.core.archivos import ArchivosFirmadosMixin


class RecursoSerializer(serializers.ModelSerializer):
    tipo_label = serializers.CharField(source="get_tipo_display", read_only=True)
    youtube_id = serializers.CharField(read_only=True)

    class Meta:
        model = Recurso
        fields = [
            "id", "leccion", "orden", "tipo", "tipo_label",
            "titulo", "descripcion", "url", "contenido", "youtube_id",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "youtube_id", "tipo_label", "creado_en", "actualizado_en"]


class LeccionSerializer(serializers.ModelSerializer):
    recursos = RecursoSerializer(many=True, read_only=True)
    tareas_count = serializers.SerializerMethodField()

    class Meta:
        model = Leccion
        fields = [
            "id", "curso", "orden", "titulo", "contenido", "publicada",
            "recursos", "tareas_count",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "recursos", "tareas_count", "creado_en", "actualizado_en"]

    def get_tareas_count(self, obj):
        return obj.tareas.count()


class TareaSerializer(serializers.ModelSerializer):
    curso_titulo = serializers.CharField(source="curso.titulo", read_only=True)
    leccion_titulo = serializers.CharField(source="leccion.titulo", read_only=True, default=None)
    entregas_count = serializers.SerializerMethodField()
    mi_entrega = serializers.SerializerMethodField()

    class Meta:
        model = Tarea
        fields = [
            "id", "curso", "curso_titulo", "leccion", "leccion_titulo",
            "titulo", "descripcion", "fecha_entrega", "puntaje_maximo",
            "permite_archivo", "permite_texto", "publicada",
            "entregas_count", "mi_entrega",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "curso_titulo", "leccion_titulo",
                            "entregas_count", "mi_entrega",
                            "creado_en", "actualizado_en"]

    def get_entregas_count(self, obj):
        return obj.entregas.count()

    def get_mi_entrega(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        user = request.user
        if user.rol != "estudiante":
            return None
        est = getattr(user, "perfil_estudiante", None)
        if not est:
            return None
        e = obj.entregas.filter(estudiante=est).first()
        if not e:
            return None
        return {
            "id": e.id, "estado": e.estado, "estado_label": e.estado_label,
            "entregada_en": e.entregada_en.isoformat() if e.entregada_en else None,
            "nota": str(e.nota) if e.nota is not None else None,
        }


class CursoSerializer(ArchivosFirmadosMixin, serializers.ModelSerializer):
    docente_nombre = serializers.SerializerMethodField()
    lecciones_count = serializers.SerializerMethodField()
    tareas_count = serializers.SerializerMethodField()
    secciones_detalle = serializers.SerializerMethodField()
    hijos_matriculados = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = [
            "id", "titulo", "descripcion", "area", "color",
            "docente", "docente_nombre",
            "secciones", "secciones_detalle", "hijos_matriculados",
            "imagen_portada", "activo",
            "lecciones_count", "tareas_count",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "docente", "docente_nombre",
                            "secciones_detalle", "hijos_matriculados",
                            "lecciones_count", "tareas_count",
                            "creado_en", "actualizado_en"]

    def get_docente_nombre(self, obj):
        u = obj.docente
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_lecciones_count(self, obj):
        return obj.lecciones.filter(publicada=True).count()

    def get_tareas_count(self, obj):
        return obj.tareas.filter(publicada=True).count()

    def get_secciones_detalle(self, obj):
        return [{"id": s.id, "nombre": s.nombre or f"{s.grado} {s.letra}".strip()} for s in obj.secciones.all()]

    def get_hijos_matriculados(self, obj):
        request = self.context.get("request")
        if request and getattr(request.user, "rol", None) == "padre":
            try:
                from apps.usuarios.models import Matricula
                from apps.core.models import ConfiguracionInstitucional
                anio = ConfiguracionInstitucional.get_solo().anio_lectivo_activo or 2026
                hijos = request.user.perfil_padre.hijos.all()
                matriculas = Matricula.objects.filter(
                    estudiante__in=hijos,
                    seccion__in=obj.secciones.all(),
                    anio_lectivo=anio,
                ).select_related("estudiante__usuario", "seccion")
                return [{
                    "estudiante_id": m.estudiante.id,
                    "nombre": m.estudiante.usuario.get_full_name(),
                    "seccion": m.seccion.nombre,
                } for m in matriculas]
            except Exception:
                pass
        return []

    def validate_imagen_portada(self, value):
        return validar_upload_serializer(value, "imagen_portada")


class EntregaSerializer(ArchivosFirmadosMixin, serializers.ModelSerializer):
    estudiante_nombre = serializers.SerializerMethodField()
    tarea_titulo = serializers.CharField(source="tarea.titulo", read_only=True)
    estado_label = serializers.CharField(source="get_estado_display", read_only=True)
    calificada_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Entrega
        fields = [
            "id", "tarea", "tarea_titulo",
            "estudiante", "estudiante_nombre",
            "texto", "archivo", "estado", "estado_label",
            "entregada_en",
            "nota", "comentario_docente",
            "calificada_por", "calificada_por_nombre", "calificada_en",
        ]
        read_only_fields = ["id", "estudiante", "estudiante_nombre", "tarea_titulo",
                            "estado_label", "entregada_en",
                            "calificada_por", "calificada_por_nombre", "calificada_en"]

    def get_estudiante_nombre(self, obj):
        u = obj.estudiante.usuario
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_calificada_por_nombre(self, obj):
        if not obj.calificada_por:
            return None
        u = obj.calificada_por
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def validate_archivo(self, value):
        return validar_upload_serializer(value, "archivo")


class AvisoSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField(read_only=True)

    class Meta:
        from .models import Aviso
        model = Aviso
        fields = ["id", "curso", "autor", "autor_nombre", "titulo", "contenido",
                  "fijado", "creado_en", "actualizado_en"]
        read_only_fields = ["id", "autor", "autor_nombre", "creado_en", "actualizado_en"]

    def get_autor_nombre(self, obj):
        if not obj.autor:
            return "Sistema"
        u = obj.autor
        return f"{u.first_name} {u.last_name}".strip() or u.username
