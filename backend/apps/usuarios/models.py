from django.contrib.auth.models import AbstractUser
from django.db import models

from .tenant import OwnedManager


class EstudianteManager(OwnedManager):
    """Manager con helpers para filtrar estudiantes por matrícula."""

    def matriculados(self, anio_lectivo=None, seccion_id=None, situaciones=None, activos=True):
        """Estudiantes con matrícula vigente en el año lectivo."""
        from apps.core.models import ConfiguracionInstitucional
        if anio_lectivo is None:
            cfg = ConfiguracionInstitucional.get_solo()
            anio_lectivo = cfg.anio_lectivo_activo or 2026
        if situaciones is None:
            situaciones = ["matriculado", "suspendido"]
        qs = super().get_queryset().select_related("usuario")
        if activos:
            qs = qs.filter(usuario__activo=True)
        qs = qs.filter(
            matriculas__anio_lectivo=anio_lectivo,
            matriculas__situacion__in=situaciones,
        ).distinct()
        if seccion_id is not None:
            qs = qs.filter(matriculas__seccion_id=seccion_id, matriculas__anio_lectivo=anio_lectivo)
        return qs

    def por_seccion(self, seccion_id, anio_lectivo=None):
        return self.matriculados(anio_lectivo=anio_lectivo, seccion_id=seccion_id)


class Rol(models.TextChoices):
    """Roles del sistema — reflejan actores de TOGAF Fase B.
    Ampliado en 2026-07-07 con los actores reales de la I.E.:
    subdirector, secretaria, auxiliar, psicologa, conserje."""
    DIRECTOR = "director", "Director"
    SUBDIRECTOR = "subdirector", "Subdirector"
    DOCENTE = "docente", "Docente"
    ADMIN_TIC = "admin_tic", "Administrador TIC"
    SECRETARIA = "secretaria", "Secretaría"
    AUXILIAR = "auxiliar", "Auxiliar de educación"
    PSICOLOGA = "psicologa", "Psicólogo/a"
    CONSERJE = "conserje", "Portería / Conserjería"
    PADRE = "padre", "Padre de Familia"
    ESTUDIANTE = "estudiante", "Estudiante"


# Grupos funcionales para simplificar permisos
ROLES_DIRECTIVOS = ("director", "subdirector")
ROLES_ADMINISTRATIVOS = ("secretaria", "admin_tic", "conserje")
ROLES_ACADEMICOS = ("docente", "psicologa", "auxiliar")
ROLES_STAFF = ROLES_DIRECTIVOS + ROLES_ADMINISTRATIVOS + ROLES_ACADEMICOS
ROLES_COMUNIDAD = ("padre", "estudiante")
ROLES_EXTERNOS = ()


class Usuario(AbstractUser):
    """
    Usuario base. Extiende AbstractUser con: rol, dni, telefono.
    AUTH_USER_MODEL apunta a este modelo — debe configurarse ANTES de la primera migración.
    """
    rol = models.CharField(max_length=20, choices=Rol.choices)
    dni = models.CharField(max_length=8, unique=True, null=True, blank=True)
    telefono = models.CharField(max_length=15, blank=True)
    activo = models.BooleanField(default=True)
    es_docente = models.BooleanField(
        default=False,
        help_text="Director/subdirector que también dicta clases. Habilita asignaciones y horario docente.",
    )
    es_administrador = models.BooleanField(
        default=False,
        help_text="Puede crear estudiantes/secciones/ambientes/otros docentes. En Edición Docente reemplaza al director. "
                  "Se auto-marca True para director y admin_tic (post_save). En Edición Docente, el primer docente creado se auto-marca.",
    )
    debe_cambiar_password = models.BooleanField(
        default=False,
        help_text="True cuando el usuario tiene contraseña predeterminada y debe cambiarla.",
    )
    ultimo_acceso_ip = models.GenericIPAddressField(null=True, blank=True)
    ultimo_acceso_en = models.DateTimeField(null=True, blank=True)

    # ── Multi-tenancy: modo cuenta ─────────────────────────────────────
    # "institucional" = pertenece a una I.E. (usa la config singleton)
    # "personal"      = docente individual (sub-app lite, aislado de la IE)
    MODO_INSTITUCIONAL = "institucional"
    MODO_PERSONAL = "personal"
    MODO_CHOICES = [
        (MODO_INSTITUCIONAL, "Institucional"),
        (MODO_PERSONAL, "Personal (docente solo)"),
    ]
    modo_cuenta = models.CharField(
        max_length=15, choices=MODO_CHOICES, default=MODO_INSTITUCIONAL,
        db_index=True,
        help_text="'personal' = docente en sub-app aislada. 'institucional' = miembro de una I.E.",
    )
    # ── Cuando el docente personal se une a una I.E. ─────────────────────
    integrado_a_ie_en = models.DateTimeField(
        null=True, blank=True,
        help_text="Fecha en que su cuenta personal se integró a una I.E. (si aplica).",
    )

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "usuarios"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_rol_display()})"


class Docente(models.Model):
    """Perfil extendido para usuarios con rol=DOCENTE."""
    TURNO_CHOICES = [
        ("manana", "Mañana"),
        ("tarde", "Tarde"),
        ("completa", "Jornada Completa"),
    ]
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="perfil_docente"
    )
    especialidad = models.CharField(max_length=100, blank=True)
    fecha_ingreso = models.DateField(null=True, blank=True)
    turno = models.CharField(max_length=15, choices=TURNO_CHOICES, default="manana")
    hora_entrada_jornada = models.TimeField(
        null=True, blank=True,
        help_text="Hora de ingreso esperada si no tiene clase a primera hora (ej. 07:45 o 13:00)",
    )

    class Meta:
        db_table = "docentes"

    def __str__(self):
        return f"Docente: {self.usuario}"


class NivelEducativo(models.TextChoices):
    INICIAL = "inicial", "Inicial"
    PRIMARIA = "primaria", "Primaria"
    SECUNDARIA = "secundaria", "Secundaria"


class Seccion(models.Model):
    """Sección educativa (ej: '5to A'). Un tutor titular + docentes asignados."""
    TURNO_CHOICES = [
        ("manana", "Mañana"),
        ("tarde", "Tarde"),
        ("completa", "Jornada Completa"),
    ]
    nombre = models.CharField(max_length=30, help_text="Ej: '5to A'")
    nivel = models.CharField(
        max_length=15, choices=NivelEducativo.choices, blank=True,
        help_text="Para colegios integrados, indica si es Inicial, Primaria o Secundaria.",
    )
    grado = models.CharField(max_length=20)
    letra = models.CharField(max_length=5)
    turno = models.CharField(max_length=15, choices=TURNO_CHOICES, default="manana")
    hora_inicio = models.TimeField(
        null=True, blank=True,
        help_text="Hora de entrada de la sección (ej. 07:45 o 13:00). Si es null se usa la institucional.",
    )
    hora_fin = models.TimeField(
        null=True, blank=True,
        help_text="Hora de salida de la sección (ej. 13:15 o 18:30).",
    )
    tutor = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="secciones_como_tutor",
        limit_choices_to={"rol": "docente"},
    )
    docentes = models.ManyToManyField(
        Usuario,
        related_name="secciones_asignadas",
        blank=True,
        limit_choices_to={"rol": "docente"},
        help_text="Docentes que dictan clase en esta sección",
    )
    # ── Multi-tenant: NULL en modo institucional; docente-dueño en modo personal ──
    owner = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, null=True, blank=True,
        related_name="+", db_index=True,
        help_text="En modo personal: docente dueño. En institucional: NULL.",
    )

    objects = OwnedManager()

    class Meta:
        db_table = "secciones"
        unique_together = [("nivel", "grado", "letra")]
        ordering = ["nivel", "grado", "letra"]

    def __str__(self):
        return self.nombre


class SexoChoices(models.TextChoices):
    MASCULINO = "M", "Masculino"
    FEMENINO = "F", "Femenino"


class GrupoSanguineo(models.TextChoices):
    O_POS = "O+", "O+"
    O_NEG = "O-", "O-"
    A_POS = "A+", "A+"
    A_NEG = "A-", "A-"
    B_POS = "B+", "B+"
    B_NEG = "B-", "B-"
    AB_POS = "AB+", "AB+"
    AB_NEG = "AB-", "AB-"
    NO_SABE = "NS", "No se sabe"


class SituacionMatricula(models.TextChoices):
    MATRICULADO = "matriculado", "Matriculado"
    RETIRADO = "retirado", "Retirado"
    TRASLADADO = "trasladado", "Trasladado"
    EGRESADO = "egresado", "Egresado"
    SUSPENDIDO = "suspendido", "Suspendido"


class Matricula(models.Model):
    """Inscripción anual de un estudiante en una sección.

    Un estudiante puede tener una matrícula por año lectivo. Esto permite
    historial, traslados, reingresos y repetición sin duplicar la persona.
    """
    estudiante = models.ForeignKey(
        "Estudiante",
        on_delete=models.CASCADE,
        related_name="matriculas",
    )
    seccion = models.ForeignKey(
        Seccion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="matriculas",
    )
    anio_lectivo = models.PositiveSmallIntegerField(db_index=True)
    codigo_matricula = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        help_text="Código SIAGIE o interno de matrícula para el año lectivo.",
    )
    situacion = models.CharField(
        max_length=15,
        choices=SituacionMatricula.choices,
        default=SituacionMatricula.MATRICULADO,
    )
    fecha_matricula = models.DateField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "matriculas"
        unique_together = [("estudiante", "anio_lectivo")]
        ordering = ["-anio_lectivo", "-creado_en"]

    def __str__(self):
        return f"Matrícula {self.anio_lectivo}: {self.estudiante.usuario.get_full_name()}"


class Estudiante(models.Model):
    """Perfil extendido para usuarios con rol=ESTUDIANTE.
    Ficha completa según requisitos MINEDU + SIAGIE + Ley 29733.

    A partir del refactor de matrícula, la sección, código y situación de matrícula
    viven en el modelo `Matricula` (1:N por año lectivo). Este modelo conserva solo
    los datos personales/académicos estáticos del estudiante.
    """
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="perfil_estudiante"
    )
    # ── Datos académicos (estáticos / legacy) ───────────────────────────
    # `grado` y `seccion` se mantienen como caché legible de la última matrícula.
    grado = models.CharField(max_length=20, blank=True)
    seccion = models.CharField(max_length=5, blank=True)
    fecha_ingreso = models.DateField(null=True, blank=True, help_text="Fecha de ingreso a la I.E.")
    colegio_procedencia = models.CharField(max_length=200, blank=True)

    # ── Datos personales ────────────────────────────────────────────────
    fecha_nacimiento = models.DateField(null=True, blank=True)
    sexo = models.CharField(max_length=1, choices=SexoChoices.choices, blank=True)
    lugar_nacimiento = models.CharField(max_length=200, blank=True, help_text="Ciudad, Provincia")
    nacionalidad = models.CharField(max_length=50, default="Peruana", blank=True)
    lengua_materna = models.CharField(
        max_length=50, blank=True, default="Castellano",
        help_text="Ej: Castellano, Quechua, Aymara, Awajún",
    )
    religion = models.CharField(max_length=50, blank=True, default="Sin declarar")

    # ── Dirección ───────────────────────────────────────────────────────
    direccion = models.CharField(max_length=300, blank=True)
    referencia_direccion = models.CharField(max_length=200, blank=True)
    distrito = models.CharField(max_length=100, blank=True, default="Amarilis")
    provincia = models.CharField(max_length=100, blank=True, default="Huánuco")
    departamento = models.CharField(max_length=100, blank=True, default="Huánuco")

    # ── Ficha médica ────────────────────────────────────────────────────
    grupo_sanguineo = models.CharField(
        max_length=3, choices=GrupoSanguineo.choices,
        default=GrupoSanguineo.NO_SABE, blank=True,
    )
    alergias = models.TextField(
        blank=True, help_text="Alergias conocidas (alimentos, medicamentos, etc.)",
    )
    medicamentos = models.TextField(
        blank=True, help_text="Medicamentos que toma regularmente",
    )
    condicion_medica = models.TextField(
        blank=True, help_text="Enfermedades crónicas, discapacidades, condiciones especiales",
    )
    tiene_seguro = models.BooleanField(default=False)
    tipo_seguro = models.CharField(
        max_length=50, blank=True,
        help_text="Ej: SIS, ESSALUD, EPS, Particular",
    )

    # ── Contacto de emergencia (además del apoderado) ───────────────────
    contacto_emergencia_nombre = models.CharField(max_length=200, blank=True)
    contacto_emergencia_parentesco = models.CharField(
        max_length=50, blank=True,
        help_text="Ej: Madre, Padre, Tío, Abuela",
    )
    contacto_emergencia_telefono = models.CharField(max_length=15, blank=True)

    # ── Datos socioeconómicos (opcionales, útiles para becas/beneficios) ─
    vive_con = models.CharField(
        max_length=100, blank=True,
        help_text="Ej: Ambos padres, Solo madre, Abuelos, Tíos",
    )
    numero_hermanos = models.PositiveSmallIntegerField(null=True, blank=True)
    trabaja = models.BooleanField(default=False)
    tiene_luz = models.BooleanField(default=True)
    tiene_agua = models.BooleanField(default=True)
    tiene_internet = models.BooleanField(default=False)

    # ── Foto ────────────────────────────────────────────────────────────
    foto = models.ImageField(upload_to="estudiantes/fotos/%Y/", blank=True, null=True)

    # ── Timestamps ──────────────────────────────────────────────────────
    creado_en = models.DateTimeField(auto_now_add=True, null=True)
    actualizado_en = models.DateTimeField(auto_now=True, null=True)

    # ── Migración desde EduMWork Docente (p_04) ─────────────────────────
    codigo_migracion = models.UUIDField(
        null=True, blank=True, unique=True, db_index=True,
        help_text=(
            "UUID del estudiante en EduMWork Docente. Lo escribe "
            "`manage.py importar_docente` y es lo que hace idempotente "
            "reimportar al mismo docente. NULL en altas normales."
        ),
    )

    # ── Multi-tenant ────────────────────────────────────────────────────
    owner = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, null=True, blank=True,
        related_name="+", db_index=True,
        help_text="En modo personal: docente dueño. En institucional: NULL.",
    )

    objects = EstudianteManager()

    class Meta:
        db_table = "estudiantes"

    def __str__(self):
        return f"Estudiante: {self.usuario}"

    @property
    def edad(self):
        if not self.fecha_nacimiento:
            return None
        from datetime import date
        hoy = date.today()
        return hoy.year - self.fecha_nacimiento.year - (
            (hoy.month, hoy.day) < (self.fecha_nacimiento.month, self.fecha_nacimiento.day)
        )

    def matricula_para(self, anio_lectivo: int):
        """Devuelve la matrícula del estudiante para un año lectivo."""
        return self.matriculas.filter(anio_lectivo=anio_lectivo).first()

    @property
    def matricula_actual(self):
        from apps.core.models import ConfiguracionInstitucional
        cfg = ConfiguracionInstitucional.get_solo()
        return self.matricula_para(cfg.anio_lectivo_activo or 2026)

    @property
    def seccion_obj(self):
        """Compatibilidad hacia atrás: devuelve la sección de la matrícula actual."""
        m = self.matricula_actual
        return m.seccion if m else None

    @property
    def codigo_matricula(self):
        m = self.matricula_actual
        return m.codigo_matricula if m else None

    @property
    def situacion_matricula(self):
        m = self.matricula_actual
        return m.situacion if m else SituacionMatricula.MATRICULADO


class ParentescoChoices(models.TextChoices):
    PADRE = "padre", "Padre"
    MADRE = "madre", "Madre"
    ABUELO = "abuelo", "Abuelo/a"
    TIO = "tio", "Tío/a"
    HERMANO = "hermano", "Hermano/a mayor"
    APODERADO = "apoderado", "Apoderado legal"
    OTRO = "otro", "Otro"


class Padre(models.Model):
    """Perfil extendido para usuarios con rol=PADRE.
    Ficha completa según requisitos MINEDU + Ley 29733.
    Nota: el modelo se llama `Padre` por compatibilidad, pero abarca cualquier
    apoderado legal (madre, abuelos, tíos, tutor). Ver campo `parentesco`."""
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="perfil_padre"
    )
    hijos = models.ManyToManyField(Estudiante, related_name="padres", blank=True)

    # ── Ficha del apoderado ─────────────────────────────────────────────
    parentesco = models.CharField(
        max_length=15, choices=ParentescoChoices.choices, blank=True,
    )
    ocupacion = models.CharField(max_length=100, blank=True)
    grado_instruccion = models.CharField(
        max_length=50, blank=True,
        help_text="Ej: Sin estudios, Primaria, Secundaria, Técnica, Universitaria",
    )
    lugar_trabajo = models.CharField(max_length=200, blank=True)
    telefono_trabajo = models.CharField(max_length=15, blank=True)

    # ── Consentimiento Ley 29733 (Protección de Datos Personales) ──────
    # Requerido para procesar datos de menores por parte de la I.E.
    consentimiento_datos = models.BooleanField(
        default=False,
        help_text="Consentimiento explícito para el tratamiento de datos de sus hijos (Ley 29733)",
    )
    consentimiento_fecha = models.DateTimeField(null=True, blank=True)
    consentimiento_ip = models.GenericIPAddressField(null=True, blank=True)

    # ── Preferencias de comunicación ────────────────────────────────────
    prefiere_whatsapp = models.BooleanField(default=True)
    acepta_notificaciones_urgentes = models.BooleanField(default=True)

    class Meta:
        db_table = "padres"

    def __str__(self):
        return f"Padre: {self.usuario}"


# ═════════════════════════════════════════════════════════════════════════════
# CÓDIGO DE RECUPERACIÓN DE CONTRASEÑA
# ═════════════════════════════════════════════════════════════════════════════
import secrets
from datetime import timedelta
from django.utils import timezone


def _codigo_6digitos() -> str:
    """Genera un código de 6 dígitos usando secrets (criptográficamente seguro)."""
    return f"{secrets.randbelow(1_000_000):06d}"


class CodigoRecuperacion(models.Model):
    """Código temporal para reset de contraseña generado por un admin/director/secretaría.
    Sirve cuando el usuario olvida su contraseña y no hay email configurado.

    Flujo:
      1. Padre/docente llama al colegio
      2. Admin TIC entra al sistema, busca el usuario, genera código
      3. Admin le comunica el código al usuario por WhatsApp/teléfono personal
      4. Usuario entra a /recuperar → escribe usuario + código + nueva password
    """
    usuario = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="codigos_recuperacion"
    )
    codigo = models.CharField(max_length=6, default=_codigo_6digitos)
    generado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="codigos_generados"
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    expira_en = models.DateTimeField()
    usado_en = models.DateTimeField(null=True, blank=True)
    ip_uso = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "codigos_recuperacion"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["usuario", "usado_en"]),
            models.Index(fields=["codigo", "expira_en"]),
        ]

    def save(self, *args, **kwargs):
        if not self.expira_en:
            self.expira_en = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)

    @property
    def valido(self) -> bool:
        return self.usado_en is None and timezone.now() < self.expira_en

    def __str__(self):
        return f"Código {self.codigo} para {self.usuario.username}"


class InvitacionDocente(models.Model):
    """
    Invitación enviada por un director/admin_tic para que un docente
    (existente en modo personal, o nuevo) se integre a la I.E.

    Flujo:
      1. Director crea invitación → se envía email con token único
      2. Docente abre link → identifica al usuario si ya existe (por email)
      3. Docente acepta → su cuenta cambia a modo=institucional y sus
         datos personales quedan visibles al colegio.
    """
    ESTADO_PENDIENTE = "pendiente"
    ESTADO_ACEPTADA = "aceptada"
    ESTADO_RECHAZADA = "rechazada"
    ESTADO_EXPIRADA = "expirada"
    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, "Pendiente"),
        (ESTADO_ACEPTADA, "Aceptada"),
        (ESTADO_RECHAZADA, "Rechazada"),
        (ESTADO_EXPIRADA, "Expirada"),
    ]

    email = models.EmailField(db_index=True, help_text="Email del docente invitado.")
    token = models.CharField(max_length=64, unique=True, db_index=True)
    invitado_por = models.ForeignKey(
        "Usuario", on_delete=models.SET_NULL, null=True,
        related_name="invitaciones_enviadas",
    )
    docente_target = models.ForeignKey(
        "Usuario", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="invitaciones_recibidas",
        help_text="Si el docente ya tiene cuenta personal, se enlaza acá.",
    )
    area_sugerida = models.CharField(max_length=80, blank=True, default="")
    mensaje = models.TextField(blank=True, default="")
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default=ESTADO_PENDIENTE)
    expira_en = models.DateTimeField()
    aceptada_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "invitaciones_docente"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["email", "estado"]),
            models.Index(fields=["token"]),
        ]

    def save(self, *args, **kwargs):
        import secrets
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        if not self.expira_en:
            self.expira_en = timezone.now() + timedelta(days=14)
        super().save(*args, **kwargs)

    @property
    def valida(self) -> bool:
        return self.estado == self.ESTADO_PENDIENTE and timezone.now() < self.expira_en

    def __str__(self):
        return f"Invitación → {self.email} [{self.estado}]"
