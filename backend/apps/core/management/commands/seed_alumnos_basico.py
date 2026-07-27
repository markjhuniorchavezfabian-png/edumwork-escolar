"""
Crea la capa base de alumnos y secciones para el demo.

Qué hace:
  - Fija nivel="primaria" en secciones 1ro-6to existentes (estaban vacías)
  - Crea sección "Inicial 3 años A" y la asigna a karol como tutora
  - Crea 6 alumnos de inicial para karol
  - Crea 5 alumnos de primaria para docente1 (5to A)
  - Vincula estudiante1 a 5to A

Idempotente: usa get_or_create en todo.

Uso:
    python manage.py seed_alumnos_basico
    python manage.py seed_alumnos_basico --reset  # borra alumnos creados y repuebla
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.usuarios.models import Usuario, Seccion, Estudiante, Rol


ALUMNOS_INICIAL = [
    ("Luis",       "Quispe Flores",    "ini001", "72100001"),
    ("Valeria",    "Tucto Ramírez",    "ini002", "72100002"),
    ("Ángel",      "Rojas Sánchez",    "ini003", "72100003"),
    ("Sofía",      "Mendoza Cruz",     "ini004", "72100004"),
    ("Mateo",      "Chávez Huanca",    "ini005", "72100005"),
    ("Isabella",   "Torres Vásquez",   "ini006", "72100006"),
]

ALUMNOS_5TO_A = [
    ("Carlos",     "Pérez Aguilar",    "5to001", "72200001"),
    ("Lucía",      "García Vargas",    "5to002", "72200002"),
    ("Diego",      "Huanca Trujillo",  "5to003", "72200003"),
    ("Camila",     "Rojas Mendoza",    "5to004", "72200004"),
    ("Sebastián",  "Quispe Cáceres",   "5to005", "72200005"),
]


class Command(BaseCommand):
    help = "Crea secciones y alumnos base para demo (karol=inicial, docente1=5toA)"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Borra alumnos creados por este seed y repuebla")

    @transaction.atomic
    def handle(self, *args, **opts):
        reset = opts.get("reset", False)
        self.stdout.write(self.style.MIGRATE_HEADING("→ Seed alumnos básico"))

        self._fijar_nivel_secciones()
        self._crear_seccion_inicial(reset)
        self._crear_alumnos_primaria(reset)
        self._crear_asignaciones(reset)

        self.stdout.write(self.style.SUCCESS("\n✓ Listo."))
        self._resumen()

    def _fijar_nivel_secciones(self):
        n = Seccion.objects.filter(nivel="").update(nivel="primaria")
        self.stdout.write(f"  secciones actualizadas a nivel=primaria: {n}")

    def _crear_seccion_inicial(self, reset):
        karol = Usuario.objects.filter(username="karol").first()
        if not karol:
            self.stdout.write("  karol no existe, skip sección inicial")
            return

        seccion, created = Seccion.objects.get_or_create(
            nivel="inicial", grado="3 años", letra="A",
            defaults={"tutor": karol},
        )
        if not created and seccion.tutor_id != karol.id:
            seccion.tutor = karol
            seccion.save(update_fields=["tutor"])
        self.stdout.write(f"  sección Inicial 3 años A: {'creada' if created else 'ya existe'}")

        if reset:
            usernames = [u for _, _, u, _ in ALUMNOS_INICIAL]
            Usuario.objects.filter(username__in=usernames).delete()

        creados = 0
        for nombre, apellido, username, dni in ALUMNOS_INICIAL:
            u, is_new = Usuario.objects.get_or_create(
                username=username,
                defaults={
                    "rol": Rol.ESTUDIANTE,
                    "first_name": nombre,
                    "last_name": apellido,
                },
            )
            if is_new:
                u.set_password(f"{dni[:6]}2026")
                u.save()
                creados += 1

            Estudiante.objects.get_or_create(
                usuario=u,
                defaults={
                    "seccion_obj": seccion,
                    "grado": "3 años",
                    "seccion": "A",
                    "codigo_matricula": f"INI2026{dni[-3:]}",
                },
            )
        self.stdout.write(f"  alumnos inicial 3 años: +{creados} (total={len(ALUMNOS_INICIAL)})")

    def _crear_alumnos_primaria(self, reset):
        docente1 = Usuario.objects.filter(username="docente1").first()
        seccion_5a = Seccion.objects.filter(nivel="primaria", grado="5to", letra="A").first()

        if not seccion_5a:
            self.stdout.write("  sección 5to A no encontrada, skip alumnos primaria")
            return

        if docente1 and seccion_5a.tutor_id != docente1.id:
            seccion_5a.tutor = docente1
            seccion_5a.save(update_fields=["tutor"])
            self.stdout.write("  docente1 asignada como tutora de 5to A")

        # Vincular estudiante1 a 5to A
        est1_user = Usuario.objects.filter(username="estudiante1").first()
        if est1_user:
            est1_perfil = Estudiante.objects.filter(usuario=est1_user).first()
            if est1_perfil and est1_perfil.seccion_obj_id != seccion_5a.id:
                est1_perfil.seccion_obj = seccion_5a
                est1_perfil.grado = "5to"
                est1_perfil.seccion = "A"
                est1_perfil.save(update_fields=["seccion_obj", "grado", "seccion"])
                self.stdout.write("  estudiante1 vinculado a 5to A")

        if reset:
            usernames = [u for _, _, u, _ in ALUMNOS_5TO_A]
            Usuario.objects.filter(username__in=usernames).delete()

        creados = 0
        for nombre, apellido, username, dni in ALUMNOS_5TO_A:
            u, is_new = Usuario.objects.get_or_create(
                username=username,
                defaults={
                    "rol": Rol.ESTUDIANTE,
                    "first_name": nombre,
                    "last_name": apellido,
                },
            )
            if is_new:
                u.set_password(f"{dni[:6]}2026")
                u.save()
                creados += 1

            Estudiante.objects.get_or_create(
                usuario=u,
                defaults={
                    "seccion_obj": seccion_5a,
                    "grado": "5to",
                    "seccion": "A",
                    "codigo_matricula": f"5A2026{dni[-3:]}",
                },
            )
        self.stdout.write(f"  alumnos 5to A: +{creados} (total={len(ALUMNOS_5TO_A)})")

    def _crear_asignaciones(self, reset):
        from apps.notas.models import AsignacionDocente
        from apps.notas.views import AREAS_PROFESOR_AULA

        PARES = [
            ("karol",    "inicial",  "3 años", "A"),
            ("docente1", "primaria", "5to",    "A"),
        ]
        creadas = 0
        for username, nivel, grado, letra in PARES:
            docente = Usuario.objects.filter(username=username).first()
            seccion = Seccion.objects.filter(nivel=nivel, grado=grado, letra=letra).first()
            if not docente or not seccion:
                self.stdout.write(f"  asignaciones {username}: docente o sección no encontrada, skip")
                continue
            if reset:
                AsignacionDocente.objects.filter(docente=docente, seccion=seccion).delete()
            for area, num_comp in AREAS_PROFESOR_AULA.items():
                _, created = AsignacionDocente.objects.get_or_create(
                    docente=docente, seccion=seccion, area=area,
                    defaults={"num_competencias": num_comp},
                )
                if created:
                    creadas += 1
        self.stdout.write(f"  asignaciones docente-área creadas: +{creadas}")

    def _resumen(self):
        self.stdout.write("\n── Estado final ──")
        for s in Seccion.objects.all().order_by("nivel", "grado", "letra"):
            n_est = Estudiante.objects.filter(seccion_obj=s).count()
            tutor = s.tutor.username if s.tutor_id else "—"
            self.stdout.write(f"  {s.nivel or '?'} {s.grado} {s.letra}: {n_est} alumnos, tutor={tutor}")
