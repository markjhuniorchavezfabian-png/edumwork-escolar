from datetime import time

from django.db import models


class BaseModel(models.Model):
    """Modelo base abstracto. Todos los modelos de negocio heredan de este."""
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ConfiguracionInstitucional(models.Model):
    """Singleton con parámetros configurables institucionales.
    Solo debe existir una fila (siempre pk=1)."""

    # Horas tope (modificables por director)
    hora_tope_entrada_personal = models.TimeField(
        default=time(8, 0),
        help_text="Hora tope de entrada del personal (default: 08:00). Después = tardanza automática.",
    )
    hora_tope_entrada_estudiantes = models.TimeField(
        default=time(8, 0),
        help_text="Hora tope de entrada de estudiantes (default: 08:00).",
    )
    tolerancia_minutos = models.PositiveIntegerField(
        default=0,
        help_text="Minutos de tolerancia después de la hora tope antes de contar como tardanza.",
    )

    # Datos institucionales
    nombre_institucion = models.CharField(max_length=200, default="")
    sigla = models.CharField(max_length=20, default="", blank=True,
        help_text="Sigla corta. Si está vacía se genera automáticamente desde el nombre.")
    codigo_modular = models.CharField(max_length=20, default="")
    direccion = models.CharField(max_length=300, default="")
    ugel = models.CharField(max_length=100, default="")
    dre = models.CharField(max_length=100, default="")
    email_institucional = models.EmailField(
        blank=True, default="",
        help_text="Email de contacto/remitente del colegio. Se usa en notificaciones y como remitente por defecto.")
    logo = models.ImageField(
        upload_to="logos/", null=True, blank=True,
        help_text="Logo de la institución. Se muestra en el sidebar, login y boletas.",
    )

    # Geolocalización — para verificar que la asistencia se marca dentro de la IE
    latitud_ie = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True, default=None,
        help_text="Latitud del centro de la I.E. (configurar desde Configuración institucional).",
    )
    longitud_ie = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True, default=None,
        help_text="Longitud del centro de la I.E. (configurar desde Configuración institucional).",
    )
    radio_permitido_metros = models.PositiveIntegerField(
        default=100,
        help_text="Radio en metros: si el marcado GPS está más lejos, se rechaza.",
    )
    exigir_geolocalizacion = models.BooleanField(
        default=False,
        help_text="Si True, no se permite marcar sin permiso GPS. Si False, se permite pero queda flagueado 'sin geo'.",
    )

    # Plantilla de informe pedagógico (prompt del sistema para IA)
    plantilla_informe = models.TextField(
        blank=True, default="",
        help_text="Prompt del sistema que usa la IA al generar informes pedagógicos. "
                  "Si está vacío se usa el prompt institucional estándar.",
    )

    # Rango de años lectivos disponibles en el sistema
    primer_anio_lectivo = models.PositiveSmallIntegerField(
        default=2026,
        help_text="Primer año con datos en el sistema. Define el rango del selector histórico.",
    )
    # Año lectivo activo (puede diferir del año calendario — en Perú el año escolar va de marzo a diciembre)
    anio_lectivo_activo = models.PositiveSmallIntegerField(
        default=2026,
        help_text="Año lectivo en curso. Todas las notas y asignaciones se filtran por este año por defecto.",
    )

    # Escala de calificación
    ESCALA_CHOICES = [
        ("letras", "Letras AD / A / B / C (MINEDU)"),
        ("numerica", "Numérica 0-20 (se convierte a letras en SIAGIE)"),
    ]
    escala_calificacion = models.CharField(
        max_length=10, choices=ESCALA_CHOICES, default="letras",
        help_text="Letras = AD/A/B/C (inicial y primaria). Numérica = 0-20, se convierte a AD/A/B/C al exportar SIAGIE.",
    )

    # Control de emails por tipo de evento
    email_comunicados_habilitado = models.BooleanField(
        default=False,
        help_text="Si True, se envía email a padres/staff cuando se publica un comunicado. "
                  "Las emergencias siempre envían email. Default: desactivado para ahorrar cuota SMTP.",
    )

    # Configuración SMTP (alternativa a env vars — se aplica dinámicamente)
    smtp_host = models.CharField(max_length=200, blank=True, default="",
        help_text="Servidor SMTP. Ej: smtp.gmail.com")
    smtp_port = models.PositiveSmallIntegerField(default=587)
    smtp_user = models.CharField(max_length=200, blank=True, default="")
    smtp_password = models.TextField(blank=True, default="",
        help_text="Contraseña o app-password del correo.")
    smtp_use_tls = models.BooleanField(default=True)
    smtp_from_email = models.CharField(max_length=200, blank=True, default="")

    # Módulos habilitados por la I.E. (permite ocultar features que no usan)
    modulos_activos = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de códigos de módulos habilitados. Si está vacío, se asumen todos activos.",
    )

    # ── Finanzas, Morosidad y Facturación SUNAT ─────────────────────────
    bloquear_boleta_por_deuda = models.BooleanField(
        default=False,
        help_text="Si True, bloquea la descarga de boletas a familias con pensiones vencidas.",
    )
    max_cuotas_vencidas_bloqueo = models.PositiveSmallIntegerField(
        default=1,
        help_text="Cantidad mínima de cuotas vencidas para activar el bloqueo de boleta.",
    )
    facturacion_sunat_habilitada = models.BooleanField(
        default=False,
        help_text="Activa la emisión automática de comprobantes a SUNAT al confirmar pagos.",
    )
    sunat_api_url = models.CharField(
        max_length=255, blank=True, default="",
        help_text="URL del PSE/API (ej: https://api.nubefact.com/api/v1/...).",
    )
    sunat_api_token = models.CharField(
        max_length=255, blank=True, default="",
        help_text="Token provisto por el PSE para emitir comprobantes.",
    )
    sunat_serie_boleta = models.CharField(
        max_length=10, blank=True, default="B001",
        help_text="Serie para Boletas de Venta Electrónicas.",
    )
    sunat_serie_factura = models.CharField(
        max_length=10, blank=True, default="F001",
        help_text="Serie para Facturas Electrónicas.",
    )
    cuenta_recaudacion_bcp = models.CharField(
        max_length=50, blank=True, default="",
        help_text="Código de servicio o cuenta recaudadora BCP.",
    )
    cuenta_recaudacion_bbva = models.CharField(
        max_length=50, blank=True, default="",
        help_text="Código de recaudo BBVA Continental.",
    )

    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "configuracion_institucional"
        verbose_name = "Configuración institucional"
        verbose_name_plural = "Configuración institucional"

    def save(self, *args, **kwargs):
        # Forzar singleton: siempre pk=1
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Configuración institucional"
