"""Seed de estudiantes y asistencia para el demo.
Crea ~30 estudiantes distribuidos en secciones + 20 días de asistencia
con distribución realista (85% presente, 8% tardanza, 5% ausente, 2% justificado)."""
import csv
import random
import secrets
from datetime import date, time, timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.asistencia.models import EstadoAsistencia, RegistroAsistencia
from apps.core.models import ConfiguracionInstitucional
from apps.usuarios.models import Estudiante, Matricula, Padre, Rol, Seccion, Usuario


def _generar_password_unico(codigo_matricula: str) -> str:
    """Password legible pero único: prefijo del código + 5 chars aleatorios."""
    suf = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(5))
    return f"est{codigo_matricula[-4:]}{suf}"


NOMBRES = [
    ("Juan", "Quispe"), ("María", "Huamán"), ("Carlos", "Vargas"), ("Ana", "Rojas"),
    ("Luis", "Mendoza"), ("Sofía", "Torres"), ("Diego", "Ramírez"), ("Camila", "Fernández"),
    ("Sebastián", "Cruz"), ("Valentina", "Flores"), ("Mateo", "Ríos"), ("Isabella", "Castro"),
    ("Alejandro", "Silva"), ("Lucía", "Gutiérrez"), ("Gabriel", "Vega"), ("Emma", "Chávez"),
    ("Daniel", "Espinoza"), ("Micaela", "León"), ("Adrián", "Salazar"), ("Renata", "Ortiz"),
    ("Fabián", "Morales"), ("Antonella", "Herrera"), ("Bruno", "Peña"), ("Ariana", "Muñoz"),
    ("Nicolás", "Aguilar"), ("Fernanda", "Delgado"), ("Rodrigo", "Sánchez"), ("Paula", "Reyes"),
    ("Andrés", "Pérez"), ("Valeria", "Gómez"),
]

SECCIONES = [("1ro", "A"), ("2do", "A"), ("3ro", "A"), ("4to", "A"), ("5to", "A")]


class Command(BaseCommand):
    help = "Crea estudiantes + registros de asistencia para el demo."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Elimina asistencia previa.")

    def handle(self, *args, **options):
        rng = random.Random(42)

        docente = Usuario.objects.filter(rol=Rol.DOCENTE).first()
        if not docente:
            self.stdout.write(self.style.ERROR("Falta seed_usuarios primero."))
            return

        cfg = ConfiguracionInstitucional.get_solo()
        anio_lectivo = cfg.anio_lectivo_activo or 2026

        # 1. Crear estudiantes que falten (password único por estudiante → export CSV)
        estudiantes_existentes = Estudiante.objects.count()
        estudiantes_meta = 30
        creados_con_password: list[tuple[str, str, str, str]] = []
        if estudiantes_existentes < estudiantes_meta:
            faltan = estudiantes_meta - estudiantes_existentes
            self.stdout.write(f"Creando {faltan} estudiantes...")
            for i in range(faltan):
                nombre, apellido = rng.choice(NOMBRES)
                grado, seccion = rng.choice(SECCIONES)
                username = f"est{estudiantes_existentes + i + 1:03d}"
                codigo = f"20260{estudiantes_existentes + i + 1:03d}"

                if Usuario.objects.filter(username=username).exists():
                    continue

                password = _generar_password_unico(codigo)
                usuario = Usuario(
                    username=username,
                    first_name=nombre,
                    last_name=apellido,
                    rol=Rol.ESTUDIANTE,
                )
                usuario.set_password(password)
                usuario.save()

                est = Estudiante.objects.create(
                    usuario=usuario,
                    grado=grado,
                    seccion=seccion,
                )
                seccion_obj, _ = Seccion.objects.get_or_create(
                    grado=grado, letra=seccion,
                    defaults={"nombre": f"{grado} {seccion}"},
                )
                Matricula.objects.create(
                    estudiante=est,
                    seccion=seccion_obj,
                    anio_lectivo=anio_lectivo,
                    codigo_matricula=codigo,
                    situacion="matriculado",
                )
                creados_con_password.append((username, f"{nombre} {apellido}", f"{grado} {seccion}", password))

        # Exportar credenciales a CSV (solo si creamos nuevos) — para entregar impresas
        if creados_con_password:
            # Preferir MEDIA_ROOT (writable en Docker) sobre BASE_DIR
            base_out = Path(getattr(settings, "MEDIA_ROOT", settings.BASE_DIR))
            base_out.mkdir(parents=True, exist_ok=True)
            salida = base_out / "credenciales_estudiantes.csv"
            try:
                with open(salida, "w", newline="", encoding="utf-8") as f:
                    w = csv.writer(f)
                    w.writerow(["username", "nombre_completo", "seccion", "password_inicial"])
                    w.writerows(creados_con_password)
                self.stdout.write(self.style.WARNING(
                    f"⚠  Credenciales guardadas en {salida} — entregar a estudiantes y BORRAR el archivo."
                ))
            except PermissionError:
                self.stdout.write(self.style.ERROR(
                    f"No se pudo escribir {salida}. Consultá los passwords manualmente vía shell."
                ))

        estudiantes = list(Estudiante.objects.select_related("usuario"))
        self.stdout.write(self.style.SUCCESS(f"Total estudiantes: {len(estudiantes)}"))

        # 2. Vincular padre1 a los primeros 2 estudiantes (para el demo)
        padre_usr = Usuario.objects.filter(username="padre1").first()
        if padre_usr:
            padre, _ = Padre.objects.get_or_create(usuario=padre_usr)
            for hijo in estudiantes[:2]:
                padre.hijos.add(hijo)

        # 3. Seed de asistencia
        if options["reset"]:
            n = RegistroAsistencia.objects.count()
            RegistroAsistencia.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Eliminados {n} registros previos."))
        elif RegistroAsistencia.objects.exists():
            self.stdout.write("Ya hay asistencia. Usa --reset para regenerar.")
            return

        hoy = timezone.now().date()
        dias = 20  # 20 días atrás
        creados = 0

        distribucion = ["presente"] * 85 + ["tardanza"] * 8 + ["ausente"] * 5 + ["justificado"] * 2

        for d in range(dias):
            fecha = hoy - timedelta(days=d)
            # Saltar fines de semana
            if fecha.weekday() >= 5:
                continue
            for est in estudiantes:
                estado = rng.choice(distribucion)
                hora = None
                justif = ""
                if estado == "tardanza":
                    hora = time(hour=7, minute=rng.randint(15, 45))
                elif estado == "presente":
                    hora = time(hour=7, minute=rng.randint(0, 10))
                elif estado == "justificado":
                    justif = rng.choice([
                        "Cita médica en Essalud",
                        "Trámite en RENIEC",
                        "Enfermedad familiar",
                        "Actividad deportiva escolar",
                    ])
                RegistroAsistencia.objects.create(
                    estudiante=est,
                    fecha=fecha,
                    estado=estado,
                    hora_llegada=hora,
                    justificacion=justif,
                    marcado_por=docente,
                )
                creados += 1

        self.stdout.write(self.style.SUCCESS(f"\nSeed de asistencia: {creados} registros creados."))
