"""Aula Virtual — repositorio de material de estudio + tareas.

Diseño:
  Curso        (docente crea, para 1+ secciones)
    └── Leccion    (unidades ordenadas dentro del curso)
          ├── Recurso    (video YouTube, PDF link, imagen, texto)
          └── Tarea      (con fecha de entrega, puntaje)
                └── Entrega  (del estudiante, con archivo/texto/nota)

Filosofía: NO se hostean videos ni PDFs pesados — el docente pega links
externos (YouTube, Drive, OneDrive). La app solo guarda metadata.
Esto mantiene el hosting barato y evita problemas de almacenamiento."""
from datetime import datetime

from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.models import Estudiante, Seccion, Usuario


def _anio_actual():
    return datetime.now().year


# ─────────────────────────────────────────────────────────────────────────────
class Curso(BaseModel):
    """Un curso creado por un docente para una o más secciones."""
    titulo = models.CharField(max_length=150)
    anio_lectivo = models.PositiveSmallIntegerField(
        default=_anio_actual,
        help_text="Año lectivo al que corresponde el curso.",
    )
    descripcion = models.TextField(blank=True)
    docente = models.ForeignKey(
        Usuario, on_delete=models.PROTECT, related_name="cursos_dictados",
        limit_choices_to={"rol__in": ["docente", "admin_tic", "director", "psicologa"]},
    )
    secciones = models.ManyToManyField(
        Seccion, related_name="cursos", blank=True,
        help_text="Secciones que ven este curso. Vacío = solo el docente lo ve.",
    )
    area = models.CharField(
        max_length=50, blank=True,
        help_text="Área curricular: Comunicación, Matemática, CTA, etc.",
    )
    color = models.CharField(
        max_length=20, default="#2E75B6",
        help_text="Color para diferenciar visualmente el curso",
    )
    activo = models.BooleanField(default=True)
    imagen_portada = models.ImageField(
        upload_to="cursos/portadas/%Y/", blank=True, null=True,
    )

    class Meta:
        db_table = "aulavirt_cursos"
        ordering = ["-creado_en"]

    def __str__(self):
        return f"{self.titulo} — {self.docente.username}"


# ─────────────────────────────────────────────────────────────────────────────
class Leccion(BaseModel):
    """Unidad temática dentro de un curso. Ordenable."""
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name="lecciones")
    orden = models.PositiveIntegerField(default=0, help_text="Orden de aparición dentro del curso")
    titulo = models.CharField(max_length=150)
    contenido = models.TextField(
        blank=True, help_text="Texto/markdown que introduce la lección (opcional)"
    )
    publicada = models.BooleanField(
        default=True, help_text="Si es False, el docente sigue redactando y el estudiante no la ve"
    )

    class Meta:
        db_table = "aulavirt_lecciones"
        ordering = ["curso", "orden", "creado_en"]

    def __str__(self):
        return f"{self.curso.titulo} · {self.titulo}"


# ─────────────────────────────────────────────────────────────────────────────
class TipoRecurso(models.TextChoices):
    VIDEO_YOUTUBE = "video_youtube", "Video de YouTube"
    VIDEO_LINK = "video_link", "Video (otro link)"
    PDF = "pdf", "PDF"
    DOCUMENTO = "documento", "Documento (Word/Google Docs)"
    IMAGEN = "imagen", "Imagen"
    ENLACE = "enlace", "Enlace externo"
    TEXTO = "texto", "Texto/Markdown"


class Recurso(BaseModel):
    """Material de una lección: video, PDF, link, imagen, texto."""
    leccion = models.ForeignKey(Leccion, on_delete=models.CASCADE, related_name="recursos")
    orden = models.PositiveIntegerField(default=0)
    tipo = models.CharField(max_length=20, choices=TipoRecurso.choices)
    titulo = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)

    # Un solo campo url que puede contener YouTube link, Drive link, imagen url, etc.
    url = models.URLField(blank=True, max_length=500)
    # Texto/markdown embebido (para tipo TEXTO)
    contenido = models.TextField(blank=True)

    class Meta:
        db_table = "aulavirt_recursos"
        ordering = ["leccion", "orden", "creado_en"]

    def clean(self):
        # Validaciones básicas
        if self.tipo == TipoRecurso.TEXTO and not self.contenido:
            raise ValidationError("El tipo 'texto' requiere contenido.")
        if self.tipo != TipoRecurso.TEXTO and not self.url:
            raise ValidationError("Este tipo de recurso requiere una URL.")

    def __str__(self):
        return f"{self.leccion.titulo} · {self.get_tipo_display()}: {self.titulo}"

    @property
    def youtube_id(self):
        """Extrae el ID del video YouTube desde la URL, para embed."""
        if self.tipo != TipoRecurso.VIDEO_YOUTUBE or not self.url:
            return ""
        # Formatos: youtube.com/watch?v=ID, youtu.be/ID, /embed/ID
        import re
        m = re.search(r"(?:v=|youtu\.be/|/embed/)([A-Za-z0-9_-]{11})", self.url)
        return m.group(1) if m else ""


# ─────────────────────────────────────────────────────────────────────────────
class Tarea(BaseModel):
    """Actividad que los estudiantes deben entregar."""
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name="tareas")
    leccion = models.ForeignKey(
        Leccion, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="tareas",
        help_text="Opcional: asociar la tarea a una lección específica",
    )
    titulo = models.CharField(max_length=150)
    descripcion = models.TextField()
    fecha_entrega = models.DateTimeField()
    puntaje_maximo = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    permite_archivo = models.BooleanField(default=True)
    permite_texto = models.BooleanField(default=True)
    publicada = models.BooleanField(default=True)

    class Meta:
        db_table = "aulavirt_tareas"
        ordering = ["-fecha_entrega"]

    def __str__(self):
        return f"{self.curso.titulo} · {self.titulo}"


# ─────────────────────────────────────────────────────────────────────────────
class EstadoEntrega(models.TextChoices):
    PENDIENTE = "pendiente", "Pendiente"
    ENTREGADA = "entregada", "Entregada"
    TARDIA = "tardia", "Tardía"
    CALIFICADA = "calificada", "Calificada"


class Entrega(BaseModel):
    """Entrega del estudiante a una tarea, con opcional calificación docente."""
    tarea = models.ForeignKey(Tarea, on_delete=models.CASCADE, related_name="entregas")
    estudiante = models.ForeignKey(
        Estudiante, on_delete=models.CASCADE, related_name="entregas",
    )
    texto = models.TextField(blank=True)
    archivo = models.FileField(upload_to="cursos/entregas/%Y/%m/", blank=True, null=True)

    estado = models.CharField(max_length=15, choices=EstadoEntrega.choices, default=EstadoEntrega.ENTREGADA)
    entregada_en = models.DateTimeField(auto_now_add=True)

    # Calificación
    nota = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    comentario_docente = models.TextField(blank=True)
    calificada_por = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="entregas_calificadas",
    )
    calificada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "aulavirt_entregas"
        unique_together = [("tarea", "estudiante")]
        ordering = ["-entregada_en"]
        indexes = [
            models.Index(fields=["tarea", "estudiante"]),
            models.Index(fields=["estado", "-entregada_en"]),
        ]

    def __str__(self):
        return f"{self.tarea.titulo} · {self.estudiante} · {self.estado_label}"

    @property
    def estado_label(self):
        return dict(EstadoEntrega.choices).get(self.estado, self.estado)


class Aviso(BaseModel):
    """Anuncio/recordatorio del docente en un curso. Visible para todos los miembros."""
    curso = models.ForeignKey(Curso, on_delete=models.CASCADE, related_name="avisos")
    autor = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, related_name="avisos_creados",
    )
    titulo = models.CharField(max_length=200)
    contenido = models.TextField()
    fijado = models.BooleanField(default=False)

    class Meta:
        db_table = "aulavirt_avisos"
        ordering = ["-fijado", "-creado_en"]

    def __str__(self):
        return f"[{self.curso}] {self.titulo}"
