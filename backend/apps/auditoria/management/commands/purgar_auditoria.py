"""Purga la bitácora de auditoría vieja.

La auditoría es el único dato del sistema que crece sin techo: cada asistencia
marcada escribe además una fila de log de ~1 kB. En un colegio de 600 alumnos
son ~114 000 asistencias por año lectivo, o sea ~110 MB anuales **solo de log**
— más que todos los datos operativos juntos. A los pocos años la vista de
Auditoría se arrastra y el backup diario pesa de gusto.

Ejecutar mensualmente vía cron:
    0 4 1 * *  python manage.py purgar_auditoria --meses 18 --aplicar

Sin `--aplicar` solo informa cuánto borraría.

Sobre cuánto conservar: la Ley 29733 no fija un plazo para bitácoras técnicas,
y 18 meses cubre el año lectivo en curso más el anterior completo, que es lo
que una IE puede necesitar mostrar ante UGEL. Si el colegio tiene una política
propia, se ajusta con `--meses`.
"""

import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.auditoria.models import Auditoria

log = logging.getLogger(__name__)

LOTE = 5000


class Command(BaseCommand):
    help = "Borra registros de auditoría más viejos que N meses (por defecto 18)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--meses", type=int, default=18,
            help="Antigüedad a partir de la cual se borra. Default: 18.",
        )
        parser.add_argument(
            "--aplicar", action="store_true",
            help="Borra de verdad. Sin esta bandera solo informa.",
        )

    def handle(self, *args, **opts):
        meses = opts["meses"]
        if meses < 6:
            self.stderr.write(self.style.ERROR(
                "Menos de 6 meses de bitácora deja al colegio sin respaldo ante un "
                "reclamo. Si de verdad lo quieres, hacelo a mano por el admin."
            ))
            return

        corte = timezone.now() - timezone.timedelta(days=meses * 30)
        viejos = Auditoria.objects.filter(creado_en__lt=corte)
        total = viejos.count()
        quedan = Auditoria.objects.count() - total

        self.stdout.write(f"Corte      : {corte:%Y-%m-%d} (más de {meses} meses)")
        self.stdout.write(f"A borrar   : {total:,} registros")
        self.stdout.write(f"Se quedan  : {quedan:,} registros")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("Nada que purgar."))
            return

        if not opts["aplicar"]:
            self.stdout.write(self.style.WARNING(
                "Preview: no se borró nada. Repite con --aplicar."
            ))
            return

        # Por lotes: un DELETE de cientos de miles de filas bloquea la tabla y
        # el colegio queda sin poder marcar asistencia mientras corre.
        borrados = 0
        while True:
            ids = list(
                Auditoria.objects.filter(creado_en__lt=corte)
                .values_list("id", flat=True)[:LOTE]
            )
            if not ids:
                break
            n, _ = Auditoria.objects.filter(id__in=ids).delete()
            borrados += n
            self.stdout.write(f"  … {borrados:,}/{total:,}", ending="\r")

        self.stdout.write("")
        log.info("Auditoría purgada: %s registros anteriores a %s", borrados, corte.date())
        self.stdout.write(self.style.SUCCESS(f"Purgados {borrados:,} registros."))
        self.stdout.write(
            "El espacio en disco lo recupera el autovacuum de Postgres; si necesitas "
            "que sea inmediato: VACUUM FULL auditoria (bloquea la tabla)."
        )
