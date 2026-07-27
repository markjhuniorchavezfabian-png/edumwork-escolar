from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Usuario


class TipoAmbiente(models.TextChoices):
    """Categorización realista para IE peruana."""
    AULA_REGULAR = "aula_regular", "Aula regular"
    AIP = "aip", "Aula de Innovación Pedagógica (AIP)"
    LABORATORIO = "laboratorio", "Laboratorio"
    BIBLIOTECA = "biblioteca", "Biblioteca"
    SALA_MUSICA = "sala_musica", "Sala de Música / Arte"
    SALA_DOCENTES = "sala_docentes", "Sala de Docentes"
    DIRECCION = "direccion", "Dirección / Subdirección"
    SECRETARIA = "secretaria", "Secretaría"
    ADMINISTRATIVO = "administrativo", "Otro administrativo"
    PATIO = "patio", "Patio / Losa deportiva"
    AUDITORIO = "auditorio", "Auditorio / Salón de actos"
    ALMACEN = "almacen", "Almacén / Depósito"
    SS_HH = "ss_hh", "Servicios higiénicos"
    OTRO = "otro", "Otro"


TIPOS_RESERVABLES = ("aip", "laboratorio", "biblioteca", "sala_musica", "auditorio")


class Ambiente(BaseModel):
    """Espacio físico de la I.E.
    Se distingue de Sección: un Ambiente es el espacio (Aula 5A, AIP, Biblioteca),
    una Sección es el grupo humano. En turnos mañana/tarde varias secciones
    pueden compartir el mismo Ambiente."""

    nombre = models.CharField(max_length=100, help_text="Ej: 'Aula 5to A', 'AIP', 'Laboratorio de Química'")
    codigo = models.CharField(max_length=20, unique=True, help_text="Código interno único (ej: A-5A, LAB-QUI)")
    tipo = models.CharField(max_length=20, choices=TipoAmbiente.choices, default=TipoAmbiente.AULA_REGULAR)

    piso = models.CharField(max_length=20, blank=True, help_text="Ej: 'Planta baja', 'Piso 2'")
    edificio = models.CharField(max_length=50, blank=True, help_text="Ej: 'Edificio principal', 'Anexo'")
    capacidad = models.PositiveIntegerField(null=True, blank=True, help_text="Capacidad estimada")

    responsable = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ambientes_a_cargo",
        help_text="Docente/personal responsable del ambiente",
    )

    reservable = models.BooleanField(
        default=False,
        help_text="¿Se pueden hacer reservas de uso de este ambiente?",
    )
    activo = models.BooleanField(default=True)
    notas = models.TextField(blank=True)

    class Meta:
        db_table = "ambientes"
        ordering = ["tipo", "nombre"]

    def __str__(self):
        return self.nombre

    @property
    def es_reservable(self):
        return self.reservable or self.tipo in TIPOS_RESERVABLES


class EstadoBitacora(models.TextChoices):
    OK = "ok", "Todo en orden"
    OBSERVACION = "observacion", "Con observación"
    INCIDENTE = "incidente", "Incidente (reportar)"


class BitacoraUsoAmbiente(BaseModel):
    """Registro de uso de un ambiente por parte de un docente/personal.

    Se crea escaneando el QR del ambiente y opcionalmente al cerrar la sesión
    se pide reportar el estado. Si el estado es 'incidente', se sugiere abrir
    una incidencia del módulo Incidencias TI.
    """
    ambiente = models.ForeignKey(
        Ambiente, on_delete=models.CASCADE, related_name="bitacoras",
    )
    usuario = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="usos_ambientes",
    )
    motivo = models.CharField(
        max_length=100, blank=True,
        help_text="Ej: 'Clase de Comunicación 3A', 'Reunión de padres', 'Ensayo teatro'",
    )
    inicio = models.DateTimeField(auto_now_add=True)
    fin = models.DateTimeField(null=True, blank=True)

    estado_salida = models.CharField(
        max_length=15, choices=EstadoBitacora.choices, blank=True,
        help_text="Estado del ambiente al cerrar la sesión",
    )
    observaciones = models.TextField(blank=True)
    incidencia_relacionada = models.ForeignKey(
        "incidencias.Incidencia", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="bitacoras_origen",
    )

    class Meta:
        db_table = "ambientes_bitacoras"
        ordering = ["-inicio"]
        indexes = [
            models.Index(fields=["ambiente", "-inicio"]),
            models.Index(fields=["usuario", "-inicio"]),
        ]

    def __str__(self):
        return f"{self.ambiente.codigo} · {self.usuario.username} · {self.inicio:%d/%m %H:%M}"

    @property
    def abierta(self):
        return self.fin is None
