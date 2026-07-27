from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel
from apps.usuarios.models import Estudiante, Usuario


class TipoCaso(models.TextChoices):
    """Los 7 protocolos oficiales de RM 383-2025-MINEDU."""
    # Protocolo 01
    P1_VIOLENCIA_FISICA_PSICO = "p1_violencia_fisica_psico", "P1 · Violencia física y/o psicológica"
    # Protocolo 02
    P2_BULLYING_CIBERBULLYING = "p2_bullying_ciber", "P2 · Acoso (bullying / ciberbullying)"
    # Protocolo 03
    P3_ARMAS = "p3_armas", "P3 · Violencia con uso de armas"
    # Protocolo 04
    P4_VIOLENCIA_SEXUAL = "p4_violencia_sexual", "P4 · Violencia sexual entre estudiantes"
    # Protocolo 05
    P5_CASTIGO_FISICO_HUM = "p5_castigo_fisico", "P5 · Castigo físico y humillante (personal IE)"
    # Protocolo 06
    P6_HOSTIGAMIENTO_SEX = "p6_hostigamiento_sex", "P6 · Hostigamiento sexual (personal IE)"
    # Protocolo 07
    P7_ENTORNO_FAMILIAR = "p7_entorno_familiar", "P7 · Violencia por entorno familiar/comunitario"
    OTRO = "otro", "Otro (fuera de protocolos oficiales)"


# RM 383-2025 · Plazo hábil por protocolo
PLAZO_HABIL_POR_PROTOCOLO = {
    "p1_violencia_fisica_psico": 30,
    "p2_bullying_ciber": 30,
    "p3_armas": 20,  # más urgente
    "p4_violencia_sexual": 30,
    "p5_castigo_fisico": 30,
    "p6_hostigamiento_sex": 30,
    "p7_entorno_familiar": 1,  # denuncia el mismo día
    "otro": 30,
}


# Definiciones de referencia RM 383-2025 (para la UI)
DEFINICION_PROTOCOLO = {
    "p1_violencia_fisica_psico": "Violencia física (daño intencional a integridad corporal) o psicológica (daño emocional por acción u omisión).",
    "p2_bullying_ciber": "Hostigamiento reiterado (presencial o digital) con abuso de poder. Se considera bullying con ≥2 ocurrencias.",
    "p3_armas": "Uso de armas de fuego o blancas para intimidar, coaccionar, amenazar o agredir.",
    "p4_violencia_sexual": "Violación, tocamientos, actos libidinosos o acoso sexual entre estudiantes.",
    "p5_castigo_fisico": "Uso de fuerza o trato humillante por parte del personal educativo con fines de corrección.",
    "p6_hostigamiento_sex": "Violencia sexual perpetrada por personal educativo hacia estudiantes.",
    "p7_entorno_familiar": "Violencia física, psicológica o sexual contra el estudiante por parte de su entorno familiar o comunitario.",
    "otro": "Casos que no encajan en los 7 protocolos oficiales.",
}


class EstadoCaso(models.TextChoices):
    RECIBIDO = "recibido", "Recibido / En análisis"
    EN_ATENCION = "en_atencion", "En atención"
    DERIVADO = "derivado", "Derivado a instancia externa"
    CERRADO = "cerrado", "Cerrado con acuerdos"
    CERRADO_FALSO = "falso", "Cerrado — no sostenido tras verificación"


class GravedadCaso(models.TextChoices):
    LEVE = "leve", "Leve"
    MODERADA = "moderada", "Moderada"
    GRAVE = "grave", "Grave"


PLAZO_LEGAL_DIAS = 30  # Fallback si tipo no reconocido


class CasoConvivencia(BaseModel):
    """Caso de convivencia escolar según protocolos SíseVe MINEDU 2026.
    Riesgo legal directo del director: fallo PJ 2024 declara responsabilidad civil
    por casos no atendidos dentro del plazo. Este módulo cierra ese riesgo."""

    codigo = models.CharField(max_length=20, unique=True, editable=False, blank=True)
    tipo = models.CharField(max_length=30, choices=TipoCaso.choices)
    gravedad = models.CharField(max_length=15, choices=GravedadCaso.choices, default=GravedadCaso.MODERADA)
    estado = models.CharField(max_length=20, choices=EstadoCaso.choices, default=EstadoCaso.RECIBIDO)

    fecha_hecho = models.DateField()
    fecha_reporte = models.DateTimeField(auto_now_add=True)
    fecha_limite = models.DateTimeField(help_text="Auto-calculada: fecha_reporte + 30 días")

    ubicacion = models.CharField(max_length=200, help_text="Lugar donde ocurrió (ej: Aula 3ro A, patio)")
    descripcion = models.TextField(help_text="Descripción del hecho con la mayor cantidad de detalles")

    estudiantes_afectados = models.ManyToManyField(
        Estudiante, related_name="casos_como_afectado", blank=True,
        help_text="Estudiantes víctimas / afectados",
    )
    estudiantes_agresores = models.ManyToManyField(
        Estudiante, related_name="casos_como_agresor", blank=True,
        help_text="Estudiantes señalados como agresores (presunción, no acusación)",
    )

    reportado_por = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="casos_reportados"
    )
    responsable = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="casos_a_cargo",
        help_text="Personal a cargo del seguimiento (psicóloga, tutor, subdirector)",
    )

    # Confidencialidad y notificaciones
    confidencial = models.BooleanField(default=True, help_text="Solo visible para el equipo de convivencia")
    reportado_siseve = models.BooleanField(default=False)
    fecha_reporte_siseve = models.DateTimeField(null=True, blank=True)
    codigo_siseve = models.CharField(max_length=40, blank=True, help_text="Nro de reporte en SíseVe (opcional)")
    registrado_libro_incidencias = models.BooleanField(default=False)
    fecha_registro_libro = models.DateTimeField(null=True, blank=True)

    # RM 383-2025 · CGB (Comité de Gestión de Bienestar)
    responsable_convivencia = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="casos_como_resp_convivencia",
        help_text="Responsable de convivencia escolar del CGB",
    )
    coordinador_tutoria = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="casos_como_coord_tutoria",
        help_text="Coordinador de tutoría del CGB",
    )
    responsable_inclusion = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="casos_como_resp_inclusion",
        help_text="Responsable de inclusión del CGB (si involucra estudiante con discapacidad)",
    )

    # Timeline de pasos oficiales del protocolo (JSON con {paso, completado, fecha})
    pasos_protocolo = models.JSONField(
        default=list, blank=True,
        help_text="Pasos oficiales del protocolo con su estado de avance",
    )

    class Meta:
        db_table = "convivencia_casos"
        ordering = ["-fecha_reporte"]
        indexes = [
            models.Index(fields=["-fecha_reporte"]),
            models.Index(fields=["estado", "fecha_limite"]),
        ]

    def save(self, *args, **kwargs):
        es_nuevo = self.pk is None
        if es_nuevo and not self.fecha_limite:
            # Plazo hábil según protocolo (RM 383-2025)
            dias = PLAZO_HABIL_POR_PROTOCOLO.get(self.tipo, PLAZO_LEGAL_DIAS)
            self.fecha_limite = timezone.now() + timedelta(days=dias)
        # Inicializar pasos_protocolo si están vacíos
        if es_nuevo and not self.pasos_protocolo:
            self.pasos_protocolo = self._pasos_iniciales_por_protocolo()
        super().save(*args, **kwargs)
        if not self.codigo:
            self.codigo = f"CV-{self.pk:05d}"
            super().save(update_fields=["codigo"])

    def _pasos_iniciales_por_protocolo(self):
        """RM 383-2025 · Genera los pasos oficiales del protocolo con estado inicial."""
        # Pasos estándar para P1, P2, P4, P5, P6 (30 días)
        pasos_estandar = [
            {"dia": 1, "accion": "Docente/tutor identifica el hecho e informa al director", "completado": False, "fecha": None},
            {"dia": 2, "accion": "Reunión con CGB: medidas de protección + correctivas", "completado": False, "fecha": None},
            {"dia": 2, "accion": "Primera reunión con padres/apoderados de involucrados", "completado": False, "fecha": None},
            {"dia": 3, "accion": "Registro en Libro de Incidencias + Portal SíseVe", "completado": False, "fecha": None},
            {"dia": "4-19", "accion": "Actividades de prevención + seguimiento tutoría", "completado": False, "fecha": None},
            {"dia": "4-29", "accion": "Reunión evaluación acciones socioemocionales", "completado": False, "fecha": None},
            {"dia": "bimestral", "accion": "Informe bimestral de seguimiento", "completado": False, "fecha": None},
        ]
        # P3 (armas) - 20 días, más urgente
        if self.tipo == "p3_armas":
            return [
                {"dia": 1, "accion": "Cualquier integrante informa al director. Retención segura del arma", "completado": False, "fecha": None},
                {"dia": 2, "accion": "Reunión CGB + comunicación a PNP", "completado": False, "fecha": None},
                {"dia": 3, "accion": "Registro Libro + SíseVe", "completado": False, "fecha": None},
                {"dia": "4-19", "accion": "Actividades prevención uso de armas", "completado": False, "fecha": None},
                {"dia": "bimestral", "accion": "Informe bimestral de seguimiento", "completado": False, "fecha": None},
            ]
        # P7 (entorno familiar) - denuncia el mismo día
        if self.tipo == "p7_entorno_familiar":
            return [
                {"dia": 1, "accion": "Detección: docente/tutor informa al director el día del hecho", "completado": False, "fecha": None},
                {"dia": 1, "accion": "Director denuncia a comisaría/fiscalía/juzgado", "completado": False, "fecha": None},
                {"dia": 1, "accion": "Comunicación al padre/apoderado no involucrado", "completado": False, "fecha": None},
                {"dia": 1, "accion": "Contacto Línea 100 (opcional)", "completado": False, "fecha": None},
                {"dia": 2, "accion": "Registro Libro + SíseVe", "completado": False, "fecha": None},
                {"dia": "4-29", "accion": "Reunión con tutor - acompañamiento socioemocional", "completado": False, "fecha": None},
                {"dia": "bimestral", "accion": "Informe bimestral de seguimiento", "completado": False, "fecha": None},
            ]
        return pasos_estandar

    @property
    def dias_restantes(self):
        delta = self.fecha_limite - timezone.now()
        return delta.days

    @property
    def alerta_plazo(self):
        """Devuelve 'ninguna', 'proximo', 'urgente' o 'vencido' según días restantes."""
        d = self.dias_restantes
        if self.estado in (EstadoCaso.CERRADO, EstadoCaso.CERRADO_FALSO):
            return "ninguna"
        if d < 0:
            return "vencido"
        if d <= 5:
            return "urgente"
        if d <= 10:
            return "proximo"
        return "ninguna"

    def __str__(self):
        return f"{self.codigo} · {self.get_tipo_display()} · {self.get_estado_display()}"


class SeguimientoCaso(BaseModel):
    """Acción o nota de seguimiento del caso.
    Cada intervención genera un registro en la línea de tiempo."""

    caso = models.ForeignKey(CasoConvivencia, on_delete=models.CASCADE, related_name="seguimientos")
    autor = models.ForeignKey(Usuario, on_delete=models.PROTECT)
    accion = models.CharField(
        max_length=40,
        choices=[
            ("entrevista_victima", "Entrevista a víctima"),
            ("entrevista_agresor", "Entrevista a presunto agresor"),
            ("entrevista_padres", "Entrevista a padres"),
            ("mediacion", "Mediación / restauración"),
            ("derivacion", "Derivación (DEMUNA, PNP, MP)"),
            ("acuerdo", "Acuerdo firmado"),
            ("nota", "Nota / observación"),
        ],
        default="nota",
    )
    detalle = models.TextField()
    adjunto = models.FileField(upload_to="convivencia/%Y/%m/", blank=True, null=True)

    class Meta:
        db_table = "convivencia_seguimientos"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.caso.codigo} · {self.get_accion_display()}"
