"""Completa TODAS las secciones con alumnos de nombres realistas — para demo y QA.

`seed_alumnos_basico` solo puebla Inicial 3 años y 5to A. El resto de secciones
quedaba vacío, y en una base de trabajo se llenaba de usuarios sueltos de prueba
tipo "Alumno5 Prueba5" que después salen en la pantalla del padre durante una
demo. Este comando llena cualquier sección que exista hasta el cupo indicado,
con nombres y apellidos peruanos (repertorio de Huánuco).

    python manage.py seed_demo_alumnos                  # 8 por sección
    python manage.py seed_demo_alumnos --por-seccion 12
    python manage.py seed_demo_alumnos --reset          # borra los suyos y repuebla

Es determinístico: la misma sección genera siempre los mismos alumnos, así que
correrlo dos veces no cambia la demo ni duplica.

⚠️ Solo para demo/QA. No correr en la base de un colegio real: los alumnos de
verdad entran por `Importar Excel`.
"""

import random
import re
import unicodedata

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import ConfiguracionInstitucional
from apps.usuarios.models import Estudiante, Matricula, Rol, Seccion, Usuario

# Prefijo reservado para lo que crea este comando: permite --reset sin tocar
# alumnos cargados de verdad.
PREFIJO = "demo_"

NOMBRES_F = [
    "Valeria", "Sofía", "Isabella", "Lucía", "Camila", "Ariana", "Dayana",
    "Milagros", "Nayeli", "Xiomara", "Katherine", "Rosmery", "Marisol",
    "Yamile", "Antonella", "Fabiana", "Melany", "Brenda", "Yulisa", "Thalía",
]
NOMBRES_M = [
    "Luis", "Ángel", "Mateo", "Carlos", "Diego", "Sebastián", "Fabián",
    "Anthony", "Brayan", "Piero", "Alessandro", "Jhoel", "Elvis", "Franklin",
    "Jhonatan", "Rodrigo", "Maycol", "Yeltsin", "Adrián", "Josué",
]
APELLIDOS = [
    "Quispe", "Tucto", "Rojas", "Mendoza", "Chávez", "Torres", "Pérez",
    "García", "Huanca", "Cáceres", "Flores", "Ramírez", "Sánchez", "Cruz",
    "Vásquez", "Aguilar", "Vargas", "Trujillo", "Espinoza", "Ponce",
    "Malpartida", "Falcón", "Nolasco", "Jara", "Beraún", "Santillán",
    "Villanueva", "Ríos", "Aranda", "Solís", "Bravo", "Ayma", "Ccama",
]


def _ascii(texto: str) -> str:
    """'Inicial 3 años B' → 'inicial3anosb'. El username no debe llevar tildes ni ñ."""
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", sin_tildes.lower())


class Command(BaseCommand):
    help = "Llena todas las secciones con alumnos de nombres realistas (demo/QA)."

    def add_arguments(self, parser):
        parser.add_argument("--por-seccion", type=int, default=8,
                            help="Cupo de alumnos por sección. Default: 8.")
        parser.add_argument("--reset", action="store_true",
                            help="Borra los alumnos creados por este comando y repuebla.")

    @transaction.atomic
    def handle(self, *args, **opts):
        cupo = opts["por_seccion"]
        cfg = ConfiguracionInstitucional.get_solo()
        anio = cfg.anio_lectivo_activo or 2026

        self.stdout.write(self.style.MIGRATE_HEADING("→ Alumnos de demo"))

        if opts["reset"]:
            borrados, _ = Usuario.objects.filter(username__startswith=PREFIJO).delete()
            self.stdout.write(self.style.WARNING(f"  eliminados {borrados} registros previos"))

        secciones = Seccion.objects.all().order_by("nivel", "grado", "letra")
        if not secciones:
            self.stdout.write(self.style.ERROR(
                "  No hay secciones. Corré seed_usuarios y seed_alumnos_basico primero."
            ))
            return

        total = 0
        for seccion in secciones:
            creados = self._llenar(seccion, cupo, anio)
            total += creados
            actuales = Matricula.objects.filter(seccion=seccion, anio_lectivo=anio).count()
            self.stdout.write(f"  {str(seccion):28} {actuales:>3} alumnos (+{creados})")

        self.stdout.write(self.style.SUCCESS(f"\n✓ {total} alumnos de demo creados."))
        if total:
            self.stdout.write("  Contraseña de todos: los 6 primeros dígitos del DNI + 2026.")

    def _llenar(self, seccion: Seccion, cupo: int, anio: int) -> int:
        ya = Matricula.objects.filter(seccion=seccion, anio_lectivo=anio).count()
        faltan = cupo - ya
        if faltan <= 0:
            return 0

        # Semilla por sección: los mismos alumnos en cada corrida.
        rnd = random.Random(f"{seccion.nivel}-{seccion.grado}-{seccion.letra}")
        # El nivel va en el slug: "1ro A" de primaria y "1ro A" de secundaria son
        # secciones distintas y sin él se pisaban los usernames.
        nivel = (seccion.nivel or "sn")[:3]
        slug = _ascii(f"{nivel}{seccion.grado}{seccion.letra}")

        creados, indice = 0, 0
        while creados < faltan:
            indice += 1
            if indice > cupo + 50:  # red de seguridad, nunca debería pasar
                break

            nombre = rnd.choice(rnd.choice([NOMBRES_F, NOMBRES_M]))
            paterno, materno = rnd.sample(APELLIDOS, 2)
            username = f"{PREFIJO}{slug}_{indice:02d}"
            dni = f"7{abs(hash(username)) % 10_000_000:07d}"

            # El username puede estar tomado por una corrida anterior: se salta
            # al siguiente índice en vez de darse por vencido, si no la sección
            # nunca llega al cupo.
            if Usuario.objects.filter(username=username).exists():
                continue

            usuario = Usuario.objects.create(
                username=username,
                first_name=nombre,
                last_name=f"{paterno} {materno}",
                rol=Rol.ESTUDIANTE,
                dni=dni if not Usuario.objects.filter(dni=dni).exists() else None,
                debe_cambiar_password=True,
            )
            usuario.set_password(f"{dni[:6]}2026")
            usuario.save(update_fields=["password"])

            estudiante = Estudiante.objects.create(
                usuario=usuario, grado=seccion.grado, seccion=seccion.letra,
            )
            Matricula.objects.create(
                estudiante=estudiante, seccion=seccion, anio_lectivo=anio,
                situacion="matriculado",
            )
            creados += 1

        return creados
