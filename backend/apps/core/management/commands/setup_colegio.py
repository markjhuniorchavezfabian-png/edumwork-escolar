"""Configura el colegio en la base de datos tras la instalación.
Invocado por install_colegio.sh con los datos ingresados interactivamente."""
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Configura nombre del colegio y crea el usuario director inicial."

    def add_arguments(self, parser):
        parser.add_argument("--nombre", required=True)
        parser.add_argument("--codigo-modular", default="")
        parser.add_argument("--ugel", default="")
        parser.add_argument("--email-institucional", default="")
        parser.add_argument("--director-nombre", required=True)
        parser.add_argument("--director-email", required=True)
        parser.add_argument("--director-password", required=True)

    def handle(self, *args, **options):
        from apps.core.models import ConfiguracionInstitucional
        from apps.usuarios.models import Rol

        nombre = options["nombre"]
        codigo = options["codigo_modular"]
        ugel = options["ugel"]
        email_institucional = options["email_institucional"]
        dir_nombre = options["director_nombre"]
        dir_email = options["director_email"]
        dir_pass = options["director_password"]

        # 1. Configuración institucional
        cfg = ConfiguracionInstitucional.get_solo()
        cfg.nombre_institucion = nombre
        if codigo:
            cfg.codigo_modular = codigo
        if ugel:
            cfg.ugel = ugel
        if email_institucional:
            cfg.email_institucional = email_institucional
        cfg.save()
        self.stdout.write(f"  Institución configurada: {nombre}")

        # 2. Crear/actualizar usuario director
        User = get_user_model()
        nombres = dir_nombre.split()
        first = nombres[0] if nombres else "Director"
        last = " ".join(nombres[1:]) if len(nombres) > 1 else ""

        director, creado = User.objects.update_or_create(
            username="director",
            defaults={
                "email": dir_email,
                "first_name": first,
                "last_name": last,
                "rol": Rol.DIRECTOR,
                "activo": True,
                "is_staff": True,
            },
        )
        director.set_password(dir_pass)
        director.save()

        accion = "creado" if creado else "actualizado"
        self.stdout.write(f"  Usuario director {accion}: {dir_email}")

        # 3. Crear roles auxiliares mínimos si no existen
        roles_base = [
            ("docente1", "Docente", "Ejemplo", Rol.DOCENTE),
        ]
        for username, fn, ln, rol in roles_base:
            if not User.objects.filter(username=username).exists():
                u = User.objects.create_user(
                    username=username,
                    password="cambiar2026",
                    first_name=fn,
                    last_name=ln,
                    rol=rol,
                    activo=True,
                )
                self.stdout.write(f"  Usuario base creado: {username} (contraseña: cambiar2026)")

        self.stdout.write(self.style.SUCCESS("setup_colegio completado."))
