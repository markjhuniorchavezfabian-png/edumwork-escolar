from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.comunicados.models import Comunicado
from apps.usuarios.models import Rol, Seccion, Usuario


COMUNICADOS = [
    {"titulo": "Suspensión de clases el viernes 10 de julio",
     "cuerpo": "Se les informa que el próximo viernes 10 de julio no habrá clases debido a la Semana de Gestión. Los estudiantes podrán retirarse a las 12:00 h.",
     "categoria": "administrativo", "alcance": "toda_ie"},
    {"titulo": "Simulacro de sismo — próximo miércoles",
     "cuerpo": "El miércoles 9 de julio a las 10:00 h se realizará el simulacro nacional de sismo. Se solicita la colaboración de todos los docentes y estudiantes.",
     "categoria": "actividad", "alcance": "toda_ie"},
    {"titulo": "Reunión de padres — 5to A",
     "cuerpo": "Estimados padres de familia del 5to A, les convocamos a la reunión ordinaria del primer bimestre este sábado 12 de julio a las 9:00 a.m. en el auditorio.",
     "categoria": "convocatoria", "alcance": "seccion", "seccion_nombre": "5to A"},
    {"titulo": "Actualización del cuadro de honor",
     "cuerpo": "Se publica en el frontis institucional el cuadro de honor del primer bimestre. Felicitaciones a los estudiantes destacados.",
     "categoria": "academico", "alcance": "padres"},
    {"titulo": "Recordatorio: entrega de libretas",
     "cuerpo": "La entrega de libretas del primer bimestre se realizará del 15 al 17 de julio. Cada docente comunicará el horario específico a los padres.",
     "categoria": "recordatorio", "alcance": "padres"},
    {"titulo": "Charla de convivencia y bullying",
     "cuerpo": "Este viernes se realizará una charla sobre convivencia escolar y prevención del bullying dirigida a todos los estudiantes.",
     "categoria": "actividad", "alcance": "toda_ie"},
    {"titulo": "Reunión del CONEI",
     "cuerpo": "Se convoca a los miembros del Consejo Educativo Institucional a reunión ordinaria el lunes 14 de julio a las 4:00 p.m.",
     "categoria": "convocatoria", "alcance": "staff"},
]


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")

    def handle(self, *args, **options):
        director = Usuario.objects.filter(rol=Rol.DIRECTOR).first()
        subdir = Usuario.objects.filter(rol=Rol.SUBDIRECTOR).first()
        docente = Usuario.objects.filter(rol=Rol.DOCENTE).first()
        if not director:
            self.stdout.write(self.style.ERROR("Ejecuta seed_usuarios y seed_staff primero."))
            return

        if options["reset"]:
            n = Comunicado.objects.count()
            Comunicado.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Eliminados {n} comunicados."))
        elif Comunicado.objects.exists():
            self.stdout.write("Ya hay comunicados. Usa --reset.")
            return

        ahora = timezone.now()
        for i, datos in enumerate(COMUNICADOS):
            seccion_nombre = datos.pop("seccion_nombre", None)
            seccion = Seccion.objects.filter(nombre=seccion_nombre).first() if seccion_nombre else None
            autor = docente if i % 3 == 0 else (subdir or director)

            c = Comunicado.objects.create(
                autor=autor,
                seccion=seccion,
                **datos,
            )
            # Backdate para variar
            dias = i * 2
            Comunicado.objects.filter(pk=c.pk).update(
                fecha_publicacion=ahora - timedelta(days=dias)
            )

        self.stdout.write(self.style.SUCCESS(f"{len(COMUNICADOS)} comunicados creados."))
