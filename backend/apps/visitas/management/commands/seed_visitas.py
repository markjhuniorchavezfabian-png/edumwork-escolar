"""Seed de 25 visitas de ejemplo distribuidas en el último mes."""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.usuarios.models import Rol, Usuario
from apps.visitas.models import MotivoVisita, Visita


NOMBRES = [
    "María Elena Torres", "Carlos Andrés Vargas", "Luisa Fernanda Ríos",
    "Pedro Alberto Sánchez", "Elena Cristina Muñoz", "Roberto Carlos Peña",
    "Ana Lucía Mendoza", "José Manuel Quispe", "Rosa María Huamán",
    "Juan Carlos Flores", "Silvia Fernández Cruz", "Manuel Alejandro Ortiz",
    "Gladys Rocío Herrera", "Alberto Luis Reyes", "Fernanda Sofía Gómez",
]

MOTIVOS_ANFITRIONES = [
    (MotivoVisita.APODERADO, "Dirección"),
    (MotivoVisita.APODERADO, "Tutoría de aula"),
    (MotivoVisita.APODERADO, "Psicología"),
    (MotivoVisita.PROVEEDOR, "Administración TIC"),
    (MotivoVisita.PROVEEDOR, "Secretaría"),
    (MotivoVisita.UGEL, "Dirección"),
    (MotivoVisita.AUTORIDAD, "Dirección"),
    (MotivoVisita.ENTREVISTA, "Dirección"),
    (MotivoVisita.OTRO, "Secretaría"),
]


class Command(BaseCommand):
    help = "Crea 25 visitas de ejemplo."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")
        parser.add_argument("--cantidad", type=int, default=25)

    def handle(self, *args, **options):
        registrador = Usuario.objects.filter(rol=Rol.ADMIN_TIC).first() or Usuario.objects.filter(rol=Rol.DIRECTOR).first()
        if not registrador:
            self.stdout.write(self.style.ERROR("Falta seed_usuarios."))
            return

        if options["reset"]:
            n = Visita.objects.count()
            Visita.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Eliminadas {n} visitas."))
        elif Visita.objects.exists():
            self.stdout.write("Ya hay visitas. Usa --reset.")
            return

        rng = random.Random(42)
        ahora = timezone.now()
        creadas = 0

        for i in range(options["cantidad"]):
            nombre = rng.choice(NOMBRES)
            motivo, anfitrion = rng.choice(MOTIVOS_ANFITRIONES)
            dni = f"{rng.randint(10000000, 79999999)}"

            # Distribuir en 30 días. 20% son de hoy para que "hoy" tenga volumen visible
            if i < 3:
                horas_atras = rng.uniform(0.5, 8)  # visitas de hoy
            else:
                horas_atras = rng.uniform(24, 24 * 30)

            entrada = ahora - timedelta(hours=horas_atras)

            v = Visita.objects.create(
                dni=dni,
                nombre_completo=nombre,
                telefono=f"9{rng.randint(10000000, 99999999)}",
                motivo=motivo,
                a_quien_visita=anfitrion,
                observaciones="" if rng.random() > 0.3 else "Programada previamente por teléfono",
                registrado_por=registrador,
            )
            Visita.objects.filter(pk=v.pk).update(hora_entrada=entrada)

            # 85% ya salieron
            if rng.random() < 0.85:
                dur_min = rng.randint(10, 90)
                v.hora_salida = entrada + timedelta(minutes=dur_min)
                v.salida_registrada_por = registrador
                v.save(update_fields=["hora_salida", "salida_registrada_por"])
            creadas += 1

        self.stdout.write(self.style.SUCCESS(f"\n{creadas} visitas creadas."))
