from rest_framework import serializers
from .models import Docente, Estudiante, Matricula, Padre, Usuario
from apps.core.archivos import ArchivosFirmadosMixin


class UsuarioSerializer(serializers.ModelSerializer):
    rol_label = serializers.CharField(source="get_rol_display", read_only=True)
    nombre_completo = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            "id", "username", "first_name", "last_name", "nombre_completo",
            "email", "rol", "rol_label", "dni", "telefono", "activo", "es_docente",
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "creado_en", "actualizado_en", "nombre_completo", "rol_label"]

    def get_nombre_completo(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def validate_dni(self, value):
        return value or None

    def validate_email(self, value):
        return value or None


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6, required=False, allow_blank=True)
    # Campos opcionales para perfil extendido
    especialidad = serializers.CharField(required=False, allow_blank=True)
    grado = serializers.CharField(required=False, allow_blank=True)
    seccion = serializers.CharField(required=False, allow_blank=True)
    codigo_matricula = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = [
            "username", "password", "first_name", "last_name",
            "email", "rol", "dni", "telefono",
            "especialidad", "grado", "seccion", "codigo_matricula",
        ]

    def create(self, validated_data):
        dni = validated_data.get("dni", "") or ""
        password = validated_data.pop("password", "") or ""
        if not password:
            password = (dni[:6] + "2026") if len(dni) >= 6 else "cambiar2026"

        # Normalizar username a minúsculas
        validated_data["username"] = validated_data["username"].lower()

        especialidad = validated_data.pop("especialidad", "")
        grado = validated_data.pop("grado", "")
        seccion = validated_data.pop("seccion", "")
        codigo_matricula = validated_data.pop("codigo_matricula", "") or None

        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.save()
        usuario._password_generado = password

        # Crear perfil extendido si corresponde
        if usuario.rol == "docente":
            Docente.objects.get_or_create(usuario=usuario, defaults={"especialidad": especialidad})
        elif usuario.rol == "estudiante":
            from apps.core.models import ConfiguracionInstitucional
            from apps.usuarios.models import Seccion
            cfg = ConfiguracionInstitucional.get_solo()
            estudiante, _ = Estudiante.objects.get_or_create(
                usuario=usuario,
                defaults={"grado": grado, "seccion": seccion},
            )
            seccion_obj = None
            if grado and seccion:
                seccion_obj = Seccion.objects.filter(grado=grado, letra=seccion).first()
            Matricula.objects.get_or_create(
                estudiante=estudiante,
                anio_lectivo=cfg.anio_lectivo_activo or 2026,
                defaults={
                    "seccion": seccion_obj,
                    "codigo_matricula": codigo_matricula,
                    "situacion": "matriculado",
                },
            )
        elif usuario.rol == "padre":
            Padre.objects.get_or_create(usuario=usuario)

        return usuario


class UsuarioMeSerializer(serializers.ModelSerializer):
    rol_label = serializers.CharField(source="get_rol_display", read_only=True)
    nombre_completo = serializers.SerializerMethodField(read_only=True)
    puede_gestionar_usuarios = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            "id", "username", "first_name", "last_name", "nombre_completo",
            "email", "rol", "rol_label", "dni", "telefono", "activo",
            "puede_gestionar_usuarios", "debe_cambiar_password", "es_docente",
            "es_administrador",
            "ultimo_acceso_en", "ultimo_acceso_ip",
        ]

    def get_nombre_completo(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.username

    def get_puede_gestionar_usuarios(self, obj):
        from apps.usuarios.permissions import puede_gestionar_usuarios
        return puede_gestionar_usuarios(obj)


class FichaEstudianteSerializer(ArchivosFirmadosMixin, serializers.ModelSerializer):
    """Ficha completa del estudiante — todos los campos oficiales MINEDU/SIAGIE."""
    # Datos del Usuario base (nested)
    dni = serializers.CharField(source="usuario.dni", allow_blank=True, required=False)
    first_name = serializers.CharField(source="usuario.first_name", required=False)
    last_name = serializers.CharField(source="usuario.last_name", required=False)
    email = serializers.EmailField(source="usuario.email", allow_blank=True, required=False)
    telefono = serializers.CharField(source="usuario.telefono", allow_blank=True, required=False)
    nombre_completo = serializers.SerializerMethodField(read_only=True)

    # Sección leíble
    seccion_nombre = serializers.SerializerMethodField(read_only=True)

    # Apoderados
    apoderados_detalle = serializers.SerializerMethodField(read_only=True)

    # Calculados
    edad = serializers.IntegerField(read_only=True)

    # Sección y matrícula (lectura desde Matricula actual)
    seccion_obj = serializers.CharField(read_only=True)
    codigo_matricula = serializers.CharField(read_only=True)
    situacion_matricula = serializers.CharField(read_only=True)

    class Meta:
        model = Estudiante
        fields = [
            "id", "usuario",
            # Usuario nested
            "dni", "first_name", "last_name", "email", "telefono", "nombre_completo",
            # Académicos
            "grado", "seccion", "seccion_obj", "seccion_nombre",
            "codigo_matricula", "situacion_matricula",
            "fecha_ingreso", "colegio_procedencia",
            # Personales
            "fecha_nacimiento", "edad", "sexo",
            "lugar_nacimiento", "nacionalidad", "lengua_materna", "religion",
            # Dirección
            "direccion", "referencia_direccion",
            "distrito", "provincia", "departamento",
            # Médicos
            "grupo_sanguineo", "alergias", "medicamentos", "condicion_medica",
            "tiene_seguro", "tipo_seguro",
            # Contacto emergencia
            "contacto_emergencia_nombre", "contacto_emergencia_parentesco",
            "contacto_emergencia_telefono",
            # Socioeconómico
            "vive_con", "numero_hermanos", "trabaja",
            "tiene_luz", "tiene_agua", "tiene_internet",
            # Apoderados
            "apoderados_detalle",
            # Foto
            "foto",
            # Timestamps
            "creado_en", "actualizado_en",
        ]
        read_only_fields = ["id", "usuario", "nombre_completo", "edad",
                            "seccion_nombre", "apoderados_detalle",
                            "seccion_obj", "codigo_matricula", "situacion_matricula",
                            "creado_en", "actualizado_en"]

    def get_nombre_completo(self, obj):
        u = obj.usuario
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_seccion_nombre(self, obj):
        if obj.seccion_obj:
            return obj.seccion_obj.nombre or f"{obj.seccion_obj.grado} {obj.seccion_obj.letra}"
        return f"{obj.grado} {obj.seccion}".strip() or "—"

    def get_apoderados_detalle(self, obj):
        return [{
            "id": p.pk,
            "usuario_id": p.usuario.pk,
            "nombre": f"{p.usuario.first_name} {p.usuario.last_name}".strip() or p.usuario.username,
            "parentesco": p.parentesco or "",
            "parentesco_label": p.get_parentesco_display() if p.parentesco else "",
            "telefono": p.usuario.telefono,
            "email": p.usuario.email,
            "ocupacion": p.ocupacion,
        } for p in obj.padres.select_related("usuario").all()]

    def update(self, instance, validated_data):
        # Actualiza campos anidados del Usuario base
        usuario_data = validated_data.pop("usuario", {})
        if usuario_data:
            for k, v in usuario_data.items():
                setattr(instance.usuario, k, v)
            instance.usuario.save()

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance


class FichaApoderadoSerializer(serializers.ModelSerializer):
    """Ficha completa del apoderado/padre."""
    dni = serializers.CharField(source="usuario.dni", allow_blank=True, required=False)
    first_name = serializers.CharField(source="usuario.first_name", required=False)
    last_name = serializers.CharField(source="usuario.last_name", required=False)
    email = serializers.EmailField(source="usuario.email", allow_blank=True, required=False)
    telefono = serializers.CharField(source="usuario.telefono", allow_blank=True, required=False)
    nombre_completo = serializers.SerializerMethodField(read_only=True)
    parentesco_label = serializers.CharField(source="get_parentesco_display", read_only=True)
    hijos_detalle = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Padre
        fields = [
            "id", "usuario",
            "dni", "first_name", "last_name", "email", "telefono", "nombre_completo",
            "parentesco", "parentesco_label",
            "ocupacion", "grado_instruccion",
            "lugar_trabajo", "telefono_trabajo",
            "consentimiento_datos", "consentimiento_fecha",
            "prefiere_whatsapp", "acepta_notificaciones_urgentes",
            "hijos", "hijos_detalle",
        ]
        read_only_fields = ["id", "usuario", "nombre_completo", "parentesco_label",
                            "hijos_detalle", "consentimiento_fecha"]

    def get_nombre_completo(self, obj):
        u = obj.usuario
        return f"{u.first_name} {u.last_name}".strip() or u.username

    def get_hijos_detalle(self, obj):
        return [{
            "id": h.pk,
            "nombre": f"{h.usuario.first_name} {h.usuario.last_name}".strip() or h.usuario.username,
            "seccion": h.seccion_obj.nombre if h.seccion_obj else f"{h.grado} {h.seccion}".strip(),
            "codigo_matricula": h.codigo_matricula,
        } for h in obj.hijos.select_related("usuario", "seccion_obj").all()]

    def update(self, instance, validated_data):
        usuario_data = validated_data.pop("usuario", {})
        if usuario_data:
            for k, v in usuario_data.items():
                setattr(instance.usuario, k, v)
            instance.usuario.save()
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        return instance
