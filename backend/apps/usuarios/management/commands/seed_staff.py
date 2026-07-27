"""Crea usuarios de staff de ejemplo para una institución educativa:
subdirector, secretaría, 2 auxiliares, psicóloga, conserjería, docentes de área."""
from django.core.management.base import BaseCommand

from apps.usuarios.models import Docente, Rol, Usuario


STAFF = [
    # Directivos
    {"username": "subdirector",  "password": "sub2026",     "rol": Rol.SUBDIRECTOR, "first_name": "Elena",  "last_name": "Ramírez"},
    # Administrativos
    {"username": "secretaria1",  "password": "sec2026",     "rol": Rol.SECRETARIA,  "first_name": "Rosa",   "last_name": "Delgado"},
    {"username": "conserjeria",  "password": "conserje2026","rol": Rol.CONSERJE,    "first_name": "Portería", "last_name": "Principal"},
    # Académicos
    {"username": "auxiliar1",    "password": "aux2026",     "rol": Rol.AUXILIAR,    "first_name": "Miguel", "last_name": "Vargas"},
    {"username": "auxiliar2",    "password": "aux2026",     "rol": Rol.AUXILIAR,    "first_name": "Julia",  "last_name": "Ortiz"},
    {"username": "psicologa1",   "password": "psi2026",     "rol": Rol.PSICOLOGA,   "first_name": "Diana",  "last_name": "Herrera"},
    # Docentes por área (ampliando el seed original)
    {"username": "doc_musica",   "password": "mus2026",     "rol": Rol.DOCENTE,     "first_name": "Roberto","last_name": "Sánchez", "especialidad": "Música"},
    {"username": "doc_edufis",   "password": "efi2026",     "rol": Rol.DOCENTE,     "first_name": "Carlos", "last_name": "Peña",   "especialidad": "Educación Física"},
    {"username": "doc_comuni",   "password": "com2026",     "rol": Rol.DOCENTE,     "first_name": "Silvia", "last_name": "Flores", "especialidad": "Comunicación"},
    {"username": "doc_ciencias", "password": "cie2026",     "rol": Rol.DOCENTE,     "first_name": "Mario",  "last_name": "Ríos",   "especialidad": "Ciencia y Tecnología"},
    {"username": "doc_ingles",   "password": "ing2026",     "rol": Rol.DOCENTE,     "first_name": "Nora",   "last_name": "Torres", "especialidad": "Inglés"},
]


class Command(BaseCommand):
    help = "Crea el staff de ejemplo de la institución (director, subdirector, secretaría, auxiliares, psicóloga, conserjería, docentes por área)."

    def handle(self, *args, **options):
        creados = 0
        existentes = 0

        for datos in STAFF:
            username = datos["username"]
            if Usuario.objects.filter(username=username).exists():
                existentes += 1
                self.stdout.write(f"  ya existe: {username}")
                continue

            password = datos.pop("password")
            especialidad = datos.pop("especialidad", "")
            usuario = Usuario(**datos)
            usuario.set_password(password)
            usuario.save()
            self.stdout.write(self.style.SUCCESS(f"  creado: {username} ({usuario.get_rol_display()})"))

            if usuario.rol == Rol.DOCENTE and especialidad:
                Docente.objects.get_or_create(usuario=usuario, defaults={"especialidad": especialidad})

            creados += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nSeed staff: {creados} creados, {existentes} ya existían."
        ))
