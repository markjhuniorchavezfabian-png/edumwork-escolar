"""
Seed del calendario escolar según RM 501-2025-MINEDU (año 2026)
y feriados oficiales nacionales del Perú.
"""
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from apps.calendario.models import AnioEscolar, DiaCalendario, TipoDia


FERIADOS_NACIONALES = {
    # (mes, dia, nombre)
    (1, 1, "Año Nuevo"),
    (5, 1, "Día del Trabajo"),
    (6, 7, "Batalla de Arica y Día de la Bandera"),
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
    help = "Seedea año escolar + semanas de gestión + feriados oficiales según RM 501-2025-MINEDU."

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

        if anio == 2026:
            inicio = date(2026, 3, 2)
            norma = "RM 501-2025-MINEDU"
        elif anio == 2025:
            inicio = date(2025, 3, 17)
            norma = "RM 556-2024-MINEDU"
        else:
            inicio = date(anio, 3, 2)
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
            self.stdout.write(self.style.SUCCESS(f"Creado año escolar {anio}: {inicio} → {fin} ({norma})"))
        else:
            ae.norma_referencia = norma
            ae.fecha_inicio = inicio
            ae.save(update_fields=["norma_referencia", "fecha_inicio"])
            self.stdout.write(f"Año escolar {anio} actualizado con {norma}.")

        # Sembrar Semanas de Gestión oficiales MINEDU (8 semanas = bloques hábiles según RM 501-2025-MINEDU)
        bloques_gestion = [
            # Bloque 1 (Semanas 1 y 2): Previo al inicio lectivo (planificación anual y bienvenida)
            (date(anio, 3, 2), date(anio, 3, 13), "Semanas de Gestión 1 y 2 · Planificación anual y bienvenida"),
            # Bloque 2 (Semana 3): Corte primer bimestre (evaluación y refuerzo)
            (date(anio, 5, 18), date(anio, 5, 22), "Semana de Gestión 3 · Evaluación del I Bimestre y refuerzo escolar"),
            # Bloque 3 (Semanas 4 y 5): Vacaciones escolares de medio año (reajuste curricular)
            (date(anio, 7, 27), date(anio, 8, 7), "Semanas de Gestión 4 y 5 · Evaluación y reajuste curricular medio año"),
            # Bloque 4 (Semana 6): Corte tercer bimestre (balance y metas)
            (date(anio, 10, 12), date(anio, 10, 16), "Semana de Gestión 6 · Balance pedagógico del III Bimestre"),
            # Bloque 5 (Semanas 7 y 8): Cierre de año escolar (consolidados, SIAGIE)
            (date(anio, 12, 21), date(anio, 12, 31), "Semanas de Gestión 7 y 8 · Balance anual y cierre de actas SIAGIE"),
        ]

        gestion_count = 0
        for f_ini, f_fin, desc in bloques_gestion:
            curr = f_ini
            while curr <= f_fin:
                if curr.weekday() < 5:  # Lunes a viernes
                    # No sobreescribir feriados si ya existen
                    mes_dia = (curr.month, curr.day)
                    if mes_dia not in [(m, d) for m, d, _ in FERIADOS_NACIONALES]:
                        _, c = DiaCalendario.objects.get_or_create(
                            fecha=curr,
                            defaults={
                                "tipo": TipoDia.GESTION,
                                "descripcion": desc,
                                "anio_lectivo": anio,
                            },
                        )
                        if c:
                            gestion_count += 1
                curr += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f"{gestion_count} días de gestión escolar sembrados para {anio}."))

        # Seedear feriados nacionales
        creados = 0
        for mes, dia, nombre in FERIADOS_NACIONALES:
            try:
                fecha = date(anio, mes, dia)
            except ValueError:
                continue
            _, c = DiaCalendario.objects.update_or_create(
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
            f"{creados} feriados nacionales creados/actualizados para {anio}."
        ))
