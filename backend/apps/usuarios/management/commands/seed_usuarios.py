import csv
import secrets
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from apps.usuarios.models import Usuario, Rol, Estudiante, Matricula, Padre, Seccion
from apps.core.models import ConfiguracionInstitucional
from apps.core import credenciales


USUARIOS_SEED = [
    {"username": "director",    "password": "director2026",  "rol": Rol.DIRECTOR,    "first_name": "Luis",    "last_name": "Pérez"},
    {"username": "docente1",    "password": "docente2026",   "rol": Rol.DOCENTE,     "first_name": "Ana",     "last_name": "García"},
    {"username": "tic1",        "password": "tic2026",       "rol": Rol.ADMIN_TIC,   "first_name": "Carlos",  "last_name": "Flores"},
    {"username": "padre1",      "password": "padre2026",     "rol": Rol.PADRE,       "first_name": "Rosa",    "last_name": "Huanca"},
    {"username": "estudiante1", "password": "estu2026",      "rol": Rol.ESTUDIANTE,  "first_name": "Juan",    "last_name": "Quispe"},
]


def _genpass():
    """Password random legible: 4 letras + 4 dígitos."""
    letras = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz") for _ in range(4))
    numeros = "".join(secrets.choice("23456789") for _ in range(4))
    return f"{letras}{numeros}"


class Command(BaseCommand):
    help = "Crea usuarios de prueba para todos los roles del sistema"

    def add_arguments(self, parser):
        parser.add_argument(
            "--produccion",
            action="store_true",
            help="Genera passwords únicos random en vez de los demo.",
        )
        parser.add_argument(
            "--csv", default="",
            help=(
                "Ruta donde guardar las credenciales iniciales. Sin esto se "
                "muestran por pantalla y no se escribe ningún archivo."
            ),
        )

    def handle(self, *args, **options):
        modo_prod = options.get("produccion", False)
        creados: list[tuple[str, str, str]] = []
        estudiante_obj = None

        for datos in USUARIOS_SEED:
            username = datos["username"]
            if Usuario.objects.filter(username=username).exists():
                self.stdout.write(f"  ya existe: {username}")
                if username == "estudiante1":
                    estudiante_obj = Usuario.objects.get(username=username)
                continue

            password = _genpass() if modo_prod else datos["password"]
            datos_sin_pass = {k: v for k, v in datos.items() if k != "password"}
            usuario = Usuario(**datos_sin_pass)
            usuario.set_password(password)
            usuario.save()

            if modo_prod:
                creados.append((username, usuario.get_rol_display(), password))
            self.stdout.write(self.style.SUCCESS(f"  creado: {username} ({usuario.get_rol_display()})"))

            if usuario.rol == Rol.DOCENTE:
                from apps.usuarios.models import Docente
                Docente.objects.get_or_create(usuario=usuario, defaults={"especialidad": "Matemáticas"})

            if usuario.rol == Rol.ESTUDIANTE:
                estudiante_perfil, _ = Estudiante.objects.get_or_create(
                    usuario=usuario,
                    defaults={"grado": "5to", "seccion": "A"},
                )
                cfg = ConfiguracionInstitucional.get_solo()
                anio = cfg.anio_lectivo_activo or 2026
                seccion, _ = Seccion.objects.get_or_create(
                    grado="5to", letra="A",
                    defaults={"nombre": "5to A", "nivel": "secundaria"},
                )
                Matricula.objects.get_or_create(
                    estudiante=estudiante_perfil,
                    anio_lectivo=anio,
                    defaults={"seccion": seccion, "codigo_matricula": "2026001", "situacion": "matriculado"},
                )
                estudiante_obj = usuario

        if estudiante_obj:
            padre_usuario = Usuario.objects.filter(username="padre1").first()
            if padre_usuario:
                padre_perfil, _ = Padre.objects.get_or_create(usuario=padre_usuario)
                est_perfil = Estudiante.objects.filter(usuario=estudiante_obj).first()
                if est_perfil:
                    padre_perfil.hijos.add(est_perfil)

        # Mismo criterio que en `seed_asistencia`: por defecto no queda un
        # archivo con contraseñas en texto plano esperando que alguien se
        # acuerde de borrarlo.
        if creados:
            credenciales.mostrar(
                self.stdout, self.style,
                ["username", "rol", "password_inicial"],
                creados,
                options.get("csv") or None,
            )

        self.stdout.write(self.style.SUCCESS("\nSeed completado. Usuarios listos para pruebas."))
