"""Seed de inventario TIC: 45 equipos distribuidos por ambientes."""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.inventario.models import Equipo, EstadoEquipo, TipoEquipo


PLANTILLAS = [
    ("pc",        "HP",       "ProDesk 400 G6",     Decimal("2800.00")),
    ("pc",        "Lenovo",   "ThinkCentre M75s",   Decimal("2650.00")),
    ("pc",        "Dell",     "OptiPlex 3080",      Decimal("2900.00")),
    ("laptop",    "HP",       "ProBook 445 G8",     Decimal("3400.00")),
    ("laptop",    "Lenovo",   "IdeaPad 3",          Decimal("2200.00")),
    ("proyector", "Epson",    "PowerLite W40",      Decimal("1800.00")),
    ("proyector", "BenQ",     "MS550",              Decimal("1650.00")),
    ("pizarra",   "Promethean","ActivPanel 65",      Decimal("6500.00")),
    ("impresora", "HP",       "LaserJet Pro M404n", Decimal("1200.00")),
    ("impresora", "Epson",    "EcoTank L3250",      Decimal("850.00")),
    ("tablet",    "Samsung",  "Galaxy Tab A8",      Decimal("900.00")),
    ("switch",    "TP-Link",  "TL-SG108",           Decimal("120.00")),
    ("router",    "TP-Link",  "Archer C6",          Decimal("180.00")),
    ("servidor",  "Dell",     "PowerEdge T40",      Decimal("6800.00")),
]

UBICACIONES = ["AIP", "AIP", "AIP", "Aula 1ro A", "Aula 2do A", "Aula 3ro A", "Aula 4to A", "Aula 5to A",
               "Dirección", "Secretaría", "Sala de docentes", "Laboratorio"]

ESTADOS = ["operativo"] * 75 + ["mantenimiento"] * 10 + ["reparacion"] * 10 + ["baja"] * 5


class Command(BaseCommand):
    help = "Crea inventario de equipos TIC para el demo."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true")
        parser.add_argument("--cantidad", type=int, default=45)

    def handle(self, *args, **options):
        if options["reset"]:
            n = Equipo.objects.count()
            Equipo.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Eliminados {n} equipos previos."))
        elif Equipo.objects.exists():
            self.stdout.write("Ya hay equipos. Usa --reset.")
            return

        rng = random.Random(42)
        hoy = date.today()
        creados = 0
        for i in range(options["cantidad"]):
            tipo, marca, modelo, valor = rng.choice(PLANTILLAS)
            ubicacion = rng.choice(UBICACIONES)
            estado = rng.choice(ESTADOS)
            fecha_adq = hoy - timedelta(days=rng.randint(30, 1800))
            Equipo.objects.create(
                codigo_inventario=f"IE-CV-{i + 1:04d}",
                tipo=tipo,
                marca=marca,
                modelo=modelo,
                numero_serie=f"SN{rng.randint(100000, 999999)}",
                ubicacion=ubicacion,
                estado=estado,
                fecha_adquisicion=fecha_adq,
                valor_referencial=valor,
                observaciones="",
            )
            creados += 1
        self.stdout.write(self.style.SUCCESS(f"\n{creados} equipos creados."))
