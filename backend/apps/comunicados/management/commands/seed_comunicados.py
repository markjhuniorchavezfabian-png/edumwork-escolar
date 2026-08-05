from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.comunicados.models import Comunicado
from apps.usuarios.models import Rol, Seccion, Usuario


DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def _dia(fecha):
    """'viernes 14 de agosto' — sin depender del locale del sistema."""
    return f"{DIAS[fecha.weekday()]} {fecha.day} de {MESES[fecha.month - 1]}"


def _proximo(hoy, weekday, semanas=0):
    """Siguiente día de semana pedido (0=lunes), opcionalmente + N semanas."""
    delta = (weekday - hoy.weekday()) % 7 or 7
    return hoy + timedelta(days=delta + 7 * semanas)


def comunicados(hoy):
    """Los cuerpos citan fechas reales próximas a HOY.

    Antes las fechas venían escritas a mano ("viernes 10 de julio") mientras
    que la fecha de publicación se calculaba relativa a hoy: en una demo de
    agosto, el comunicado publicado ayer anunciaba algo de julio. Un director
    lo nota en dos segundos.
    """
    viernes = _proximo(hoy, 4)
    miercoles = _proximo(hoy, 2)
    sabado = _proximo(hoy, 5)
    lunes = _proximo(hoy, 0)
    entrega_ini = _proximo(hoy, 2, semanas=1)
    entrega_fin = entrega_ini + timedelta(days=2)

    return [
        {"titulo": f"Suspensión de clases el {_dia(viernes)}",
         "cuerpo": f"Se les informa que el {_dia(viernes)} no habrá clases debido a la "
                   f"Semana de Gestión. Los estudiantes podrán retirarse a las 12:00 h.",
         "categoria": "administrativo", "alcance": "toda_ie"},
        {"titulo": "Simulacro de sismo",
         "cuerpo": f"El {_dia(miercoles)} a las 10:00 h se realizará el simulacro nacional "
                   f"de sismo. Se solicita la colaboración de todos los docentes y estudiantes.",
         "categoria": "actividad", "alcance": "toda_ie"},
        {"titulo": "Reunión de padres — 5to A",
         "cuerpo": f"Estimados padres de familia del 5to A, les convocamos a la reunión "
                   f"ordinaria del bimestre el {_dia(sabado)} a las 9:00 a.m. en el auditorio.",
         "categoria": "convocatoria", "alcance": "seccion", "seccion_nombre": "5to A"},
        {"titulo": "Actualización del cuadro de honor",
         "cuerpo": "Se publica en el frontis institucional el cuadro de honor del bimestre. "
                   "Felicitaciones a los estudiantes destacados.",
         "categoria": "academico", "alcance": "padres"},
        {"titulo": "Recordatorio: entrega de libretas",
         "cuerpo": f"La entrega de libretas del bimestre se realizará del {entrega_ini.day} "
                   f"al {entrega_fin.day} de {MESES[entrega_fin.month - 1]}. Cada docente "
                   f"comunicará el horario específico a los padres.",
         "categoria": "recordatorio", "alcance": "padres"},
        {"titulo": "Charla de convivencia y bullying",
         "cuerpo": f"El {_dia(viernes)} se realizará una charla sobre convivencia escolar y "
                   f"prevención del bullying dirigida a todos los estudiantes.",
         "categoria": "actividad", "alcance": "toda_ie"},
        {"titulo": "Reunión del CONEI",
         "cuerpo": f"Se convoca a los miembros del Consejo Educativo Institucional a reunión "
                   f"ordinaria el {_dia(lunes)} a las 4:00 p.m.",
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
        lista = comunicados(timezone.localdate())
        for i, datos in enumerate(lista):
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

        self.stdout.write(self.style.SUCCESS(f"{len(lista)} comunicados creados."))
