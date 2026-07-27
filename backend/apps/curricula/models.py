from django.db import models


class AreaCurricular(models.Model):
    NIVELES = [
        ("inicial", "Inicial"),
        ("primaria", "Primaria"),
        ("secundaria", "Secundaria"),
    ]
    nombre = models.CharField(max_length=100)
    nivel = models.CharField(max_length=20, choices=NIVELES)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "curricula_area"
        unique_together = [("nombre", "nivel")]
        ordering = ["nivel", "orden", "nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.get_nivel_display()})"


class Competencia(models.Model):
    area = models.ForeignKey(
        AreaCurricular, on_delete=models.CASCADE, related_name="competencias"
    )
    numero = models.PositiveSmallIntegerField()
    nombre = models.CharField(max_length=300)

    class Meta:
        db_table = "curricula_competencia"
        unique_together = [("area", "numero")]
        ordering = ["area", "numero"]

    def __str__(self):
        return f"{self.area.nombre} · C{self.numero}: {self.nombre[:60]}"


class Capacidad(models.Model):
    competencia = models.ForeignKey(
        Competencia, on_delete=models.CASCADE, related_name="capacidades"
    )
    nombre = models.CharField(max_length=300)
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "curricula_capacidad"
        ordering = ["competencia", "orden"]

    def __str__(self):
        return f"{self.competencia} → {self.nombre[:60]}"


class Desempeno(models.Model):
    GRADOS = [
        # Inicial
        ("i3a", "Inicial 3 años"),
        ("i4a", "Inicial 4 años"),
        ("i5a", "Inicial 5 años"),
        # Primaria
        ("p1",  "1° Primaria"),
        ("p2",  "2° Primaria"),
        ("p3",  "3° Primaria"),
        ("p4",  "4° Primaria"),
        ("p5",  "5° Primaria"),
        ("p6",  "6° Primaria"),
        # Secundaria
        ("s1",  "1° Secundaria"),
        ("s2",  "2° Secundaria"),
        ("s3",  "3° Secundaria"),
        ("s4",  "4° Secundaria"),
        ("s5",  "5° Secundaria"),
    ]
    competencia = models.ForeignKey(
        Competencia, on_delete=models.CASCADE, related_name="desempenos",
    )
    grado = models.CharField(max_length=4, choices=GRADOS, null=True, blank=True)
    descripcion = models.TextField()
    orden = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "curricula_desempeno"
        ordering = ["competencia", "grado", "orden"]

    def __str__(self):
        return f"{self.capacidad} [{self.grado}]"
