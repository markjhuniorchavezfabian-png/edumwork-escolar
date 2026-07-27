"""Agrega ambientes especializados no capturados por el backfill:
laboratorios específicos, sala de música, biblioteca, salas administrativas."""
from django.core.management.base import BaseCommand

from apps.ambientes.models import Ambiente


AMBIENTES_EXTRA = [
    # Nombre, código, tipo, piso, capacidad, reservable
    ("Biblioteca escolar",           "BIB",       "biblioteca",    "Piso 1", 40, True),
    ("Sala de Música y Arte",        "MUS",       "sala_musica",   "Piso 1", 30, True),
    ("Laboratorio de Química",       "LAB-QUI",   "laboratorio",   "Piso 2", 25, True),
    ("Laboratorio de Física",        "LAB-FIS",   "laboratorio",   "Piso 2", 25, True),
    ("Laboratorio de Ciencias Naturales", "LAB-CN", "laboratorio",  "Piso 2", 25, True),
    ("Sala de Docentes",             "SD",        "sala_docentes", "Piso 1", 15, False),
    ("Auditorio",                    "AUD",       "auditorio",     "Piso 1", 150, True),
    ("Losa deportiva",               "LOSA",      "patio",         "Exterior", None, True),
    ("Secretaría",                   "SEC",       "secretaria",    "Piso 1", 5, False),
    ("Almacén general",              "ALM",       "almacen",       "Piso 1", None, False),
    ("Departamento de Psicología",   "PSI",       "administrativo","Piso 1", 4, False),
]


class Command(BaseCommand):
    def handle(self, *args, **options):
        creados = 0
        existentes = 0
        for nombre, codigo, tipo, piso, cap, reservable in AMBIENTES_EXTRA:
            if Ambiente.objects.filter(codigo=codigo).exists() or Ambiente.objects.filter(nombre=nombre).exists():
                existentes += 1
                continue
            Ambiente.objects.create(
                nombre=nombre,
                codigo=codigo,
                tipo=tipo,
                piso=piso,
                capacidad=cap,
                reservable=reservable,
                activo=True,
            )
            creados += 1
        self.stdout.write(self.style.SUCCESS(f"{creados} ambientes creados, {existentes} ya existían."))
