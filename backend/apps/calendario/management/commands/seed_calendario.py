"""
Seed del calendario escolar según RM 556-2024-MINEDU (año 2025)
y feriados oficiales nacionales del Perú.
"""
from datetime import date
from django.core.management.base import BaseCommand
from apps.calendario.models import AnioEscolar, DiaCalendario, TipoDia


FERIADOS_NACIONALES = {
    # (mes, dia, nombre)
    (1, 1, "Año Nuevo"),
    (5, 1, "Día del Trabajo"),
    (6, 7, "Batalla de Arica y Día de la Bandera"),  # solo algunos años
    (6, 29, "San Pedro y San Pablo"),
    (7, 23, "Día de la Fuerza Aérea"),
    (7, 28, "Fiestas Patrias – Día de la Independencia"),
    (7, 29, "Fiestas Patrias – Día de las FFAA"),
    (8, 6, "Batalla de Junín"),
    (8, 30, "Santa Rosa de Lima"),
    (10, 8, "Combate de Angamos"),
    (11, 1, "Día de Todos los Santos"),
    (12, 8, "Inmaculada Concepción"),
    (12, 9, "Batalla de Ayacucho"),
    (12, 25, "Navidad"),
}


class Command(BaseCommand):
    help = "Seedea año escolar + feriados oficiales según RM 556-2024-MINEDU."

    def add_arguments(self, parser):
        parser.add_argument("--anio", type=int, default=2026)
        parser.add_argument("--reset", action="store_true")

    def handle(self, *args, **opts):
        anio = opts["anio"]

        if opts["reset"]:
            n_ae = AnioEscolar.objects.filter(anio=anio).count()
            n_dc = DiaCalendario.objects.filter(anio_lectivo=anio).count()
            AnioEscolar.objects.filter(anio=anio).delete()
            DiaCalendario.objects.filter(anio_lectivo=anio).delete()
            self.stdout.write(f"  Eliminados: {n_ae} año escolar + {n_dc} días.")

        # Año escolar típico peruano (verificar norma anual)
        # RM 556-2024: 17-mar-2025 → 31-dic-2025
        if anio == 2025:
            inicio = date(2025, 3, 17)
            norma = "RM 556-2024-MINEDU"
        else:
            # Aproximación: mismo patrón para otros años
            inicio = date(anio, 3, 3)  # ~primer lunes de marzo
            norma = f"Aproximado (verificar norma del año {anio})"
        fin = date(anio, 12, 31)

        ae, creado = AnioEscolar.objects.get_or_create(
            anio=anio,
            defaults={
                "fecha_inicio": inicio,
                "fecha_fin": fin,
                "norma_referencia": norma,
                "activo": True,
            },
        )
        if creado:
            self.stdout.write(self.style.SUCCESS(f"Creado año escolar {anio}: {inicio} → {fin}"))
        else:
            self.stdout.write(f"Año escolar {anio} ya existía.")

        # Seedear feriados nacionales
        creados = 0
        for mes, dia, nombre in FERIADOS_NACIONALES:
            try:
                fecha = date(anio, mes, dia)
            except ValueError:
                continue
            _, c = DiaCalendario.objects.get_or_create(
                fecha=fecha,
                defaults={
                    "tipo": TipoDia.FERIADO_NACIONAL,
                    "descripcion": nombre,
                    "anio_lectivo": anio,
                },
            )
            if c:
                creados += 1

        self.stdout.write(self.style.SUCCESS(
            f"{creados} feriados nacionales creados para {anio}."
        ))
