from datetime import datetime

from django.db import models

from apps.core.models import BaseModel
from apps.usuarios.tenant import OwnedManager
from apps.usuarios.models import Docente, Estudiante, Seccion, Usuario


def _anio_actual():
    return datetime.now().year


# RVM 094-2020-MINEDU — conclusiones descriptivas estándar por NL
CONCLUSIONES_NL = {
    "AD": "Logro destacado. El estudiante evidencia el logro de los aprendizajes previstos, demostrando incluso un manejo solvente y muy satisfactorio en todas las tareas propuestas.",
    "A": "Logro esperado. El estudiante evidencia el logro de los aprendizajes previstos en el tiempo programado.",
    "B": "En proceso. El estudiante está en camino de lograr los aprendizajes previstos, para lo cual requiere acompañamiento durante un tiempo razonable para lograrlo.",
    "C": "En inicio. El estudiante está empezando a desarrollar los aprendizajes previstos o evidencia dificultades para el desarrollo de éstos y necesita mayor tiempo de acompañamiento e intervención del docente de acuerdo con su ritmo y estilo de aprendizaje.",
}


# RVM 048-2024-MINEDU — Reglas de conclusión descriptiva OBLIGATORIA por nivel
# Devuelve True si según la norma la conclusión es obligatoria dado (nivel, NL).
CONCLUSION_OBLIGATORIA_POR_NIVEL = {
    "inicial":   {"A", "B", "C"},   # Ciclo II (3-5 años): obligatorio si NL ∈ {A, B, C}
    "primaria":  {"B", "C"},        # Primaria: obligatorio si NL ∈ {B, C}
    "secundaria": {"C"},            # Secundaria: obligatorio solo si NL = C
}

# RVM 048-2024-MINEDU — Conversión oficial letra → puntos para calificativo de área
LETRA_A_PUNTOS_OFICIAL = {"AD": 4.0, "A": 3.0, "B": 2.5, "C": 1.0}


def conclusion_obligatoria(nivel: str, nl: str) -> bool:
    """RVM 048-2024. Verifica si la conclusión descriptiva es obligatoria."""
    if not nl or not nivel:
        return False
    return nl in CONCLUSION_OBLIGATORIA_POR_NIVEL.get(nivel.lower(), set())


def calificativo_area(niveles_logro: list[str]) -> float | None:
    """RVM 048-2024. Fórmula oficial:
       (Σ puntos_competencias / (n × 4)) × 10 → rango 2.5 a 10.
       Retorna None si no hay competencias válidas."""
    puntos = [LETRA_A_PUNTOS_OFICIAL.get(nl) for nl in niveles_logro if nl in LETRA_A_PUNTOS_OFICIAL]
    if not puntos:
        return None
    suma = sum(puntos)
    denom = len(puntos) * 4
    return round((suma / denom) * 10, 3)


class AsignacionDocente(models.Model):
    """Docente asignado a enseñar un área en una sección específica.
    Es el vínculo que permite al docente ver y registrar notas de sus estudiantes."""
    docente = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name="asignaciones",
        limit_choices_to={"activo": True},
    )
    seccion = models.ForeignKey(
        Seccion, on_delete=models.CASCADE, related_name="asignaciones_docentes",
    )
    area = models.CharField(max_length=80, help_text="Ej: Matemática, Comunicación")
    num_competencias = models.PositiveSmallIntegerField(
        default=1,
        help_text="Número de competencias que tiene el área en esta sección",
    )
    anio_lectivo = models.PositiveSmallIntegerField(
        default=_anio_actual,
        help_text="Año lectivo al que corresponde esta asignación.",
    )
    owner = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, null=True, blank=True,
        related_name="+", db_index=True,
        help_text="Modo personal: docente dueño. Institucional: NULL.",
    )

    objects = OwnedManager()

    class Meta:
        db_table = "asignaciones_docentes"
        unique_together = [("seccion", "area", "anio_lectivo")]
        ordering = ["anio_lectivo", "seccion__grado", "seccion__letra", "area"]

    def __str__(self):
        return f"{self.docente.get_full_name()} → {self.seccion} · {self.area} [{self.anio_lectivo}]"


class NotaBimestre(BaseModel):
    """Nota de un estudiante para una competencia específica de un área en un bimestre.
    NL = Nivel de Logro (AD/A/B/C). conclusión descriptiva auto-generada o personalizada."""
    ESCALA = [
        ("AD", "AD — Logro destacado"),
        ("A", "A — Logro esperado"),
        ("B", "B — En proceso"),
        ("C", "C — En inicio"),
    ]
    BIMESTRE = [
        ("1", "1er bimestre"),
        ("2", "2do bimestre"),
        ("3", "3er bimestre"),
        ("4", "4to bimestre"),
    ]

    estudiante = models.ForeignKey(
        Estudiante, on_delete=models.CASCADE, related_name="notas"
    )
    anio_lectivo = models.PositiveSmallIntegerField(
        default=_anio_actual,
        help_text="Año lectivo al que corresponde la nota.",
    )
    area = models.CharField(max_length=80)
    bimestre = models.CharField(max_length=1, choices=BIMESTRE)
    competencia = models.PositiveSmallIntegerField(
        default=1, help_text="Número de competencia dentro del área (01, 02, ...)"
    )
    calificacion = models.CharField(max_length=2, choices=ESCALA, blank=True)
    calificacion_numerica = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True,
    )
    conclusion_descriptiva = models.TextField(
        blank=True,
        help_text="Auto-generada según RVM 094-2020-MINEDU; editable por el docente.",
    )
    observaciones = models.TextField(blank=True)
    owner = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, null=True, blank=True,
        related_name="+", db_index=True,
        help_text="Modo personal: docente dueño. Institucional: NULL.",
    )

    objects = OwnedManager()

    class Meta:
        db_table = "notas_bimestre"
        unique_together = [("estudiante", "anio_lectivo", "area", "bimestre", "competencia")]
        ordering = ["anio_lectivo", "bimestre", "area", "competencia"]

    def save(self, *args, **kwargs):
        # Auto-convertir calificación numérica a letra (escala MINEDU estándar)
        if self.calificacion_numerica is not None and not self.calificacion:
            n = float(self.calificacion_numerica)
            if n >= 18:
                self.calificacion = "AD"
            elif n >= 14:
                self.calificacion = "A"
            elif n >= 11:
                self.calificacion = "B"
            else:
                self.calificacion = "C"
        # Auto-completar conclusión si está vacía y hay calificación
        if self.calificacion and not self.conclusion_descriptiva:
            self.conclusion_descriptiva = CONCLUSIONES_NL.get(self.calificacion, "")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.estudiante} · {self.anio_lectivo} · {self.area} · B{self.bimestre} · C{self.competencia} · {self.calificacion}"


class HorarioClase(models.Model):
    DIAS = [
        ("lun", "Lunes"), ("mar", "Martes"), ("mie", "Miércoles"),
        ("jue", "Jueves"), ("vie", "Viernes"), ("sab", "Sábado"),
    ]
    asignacion = models.ForeignKey(
        AsignacionDocente, on_delete=models.CASCADE, related_name="horarios"
    )
    dia_semana = models.CharField(max_length=3, choices=DIAS)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    aula = models.CharField(max_length=60, blank=True, default="")

    class Meta:
        db_table = "horarios_clase"
        ordering = ["dia_semana", "hora_inicio"]
        unique_together = [("asignacion", "dia_semana", "hora_inicio")]

    def __str__(self):
        return f"{self.asignacion.area} · {self.asignacion.seccion} · {self.dia_semana} {self.hora_inicio}"


class SiagieMapeo(models.Model):
    """
    Almacena el mapeo columna→campo detectado para un formato SIAGIE específico.
    Clave: hash SHA-256 de la fila de cabecera del Excel oficial.
    Si SIAGIE cambia el formato entre años, el hash cambia → re-mapeo automático.
    """
    hash_header = models.CharField(max_length=64, unique=True, db_index=True)
    mapeo_json = models.JSONField(
        help_text="Diccionario col_idx→campo_sistema. Ej: {3: 'dni', 4: 'apellidos', ...}"
    )
    nivel = models.CharField(
        max_length=20, blank=True, default="",
        choices=[("inicial", "Inicial"), ("primaria", "Primaria"), ("secundaria", "Secundaria"), ("", "Desconocido")],
        help_text="Nivel detectado del template.",
    )
    tiene_conclusiones = models.BooleanField(
        default=False,
        help_text="True si el template incluye columna de conclusiones descriptivas.",
    )
    metodo_deteccion = models.CharField(
        max_length=10, default="ia",
        choices=[("ia", "IA"), ("heuristica", "Heurística"), ("manual", "Manual")],
    )
    fila_datos = models.PositiveSmallIntegerField(
        default=8,
        help_text="Número de fila (1-based) donde empiezan los datos de estudiantes.",
    )
    muestra_header = models.TextField(
        blank=True, default="",
        help_text="Texto de la fila de cabecera original (para diagnóstico).",
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "siagie_mapeo"
        verbose_name = "Mapeo SIAGIE"
        verbose_name_plural = "Mapeos SIAGIE"

    def __str__(self):
        return f"Mapeo SIAGIE [{self.nivel or '?'}] ({self.metodo_deteccion}) — {self.hash_header[:12]}…"


class SiagieRellenoLog(models.Model):
    """
    Audit trail: quién descargó qué template SIAGIE relleno, cuándo, con cuántas filas.
    Sirve para: (1) diagnóstico si algo sale mal, (2) evidencia de uso,
    (3) rate-limiting por usuario/día.
    """
    usuario = models.ForeignKey(
        "usuarios.Usuario", on_delete=models.SET_NULL, null=True,
        related_name="siagie_rellenos",
    )
    accion = models.CharField(
        max_length=20,
        choices=[
            ("analizar", "Analizar template"),
            ("preview", "Preview dry-run"),
            ("rellenar", "Rellenar y descargar"),
        ],
    )
    bimestre = models.CharField(max_length=1, blank=True, default="")
    seccion_id = models.PositiveIntegerField(null=True, blank=True)
    nombre_archivo = models.CharField(max_length=200, blank=True, default="")
    hash_headers = models.CharField(
        max_length=500, blank=True, default="",
        help_text="Hashes de las hojas procesadas, separados por coma.",
    )
    n_hojas = models.PositiveSmallIntegerField(default=0)
    n_filas_rellenadas = models.PositiveIntegerField(default=0)
    metodo_usado = models.CharField(max_length=20, blank=True, default="")
    error = models.TextField(blank=True, default="")
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "siagie_relleno_log"
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["usuario", "-creado_en"]),
            models.Index(fields=["accion", "-creado_en"]),
        ]

    def __str__(self):
        who = self.usuario.username if self.usuario_id else "?"
        return f"{who} · {self.accion} · {self.creado_en:%Y-%m-%d %H:%M}"
