"""Proceso de cierre y apertura de año lectivo.

Hace 3 cosas:
1. Cambia el año lectivo activo en la config institucional.
2. Copia las asignaciones docente→sección→área al nuevo año.
3. (Opcional) Promueve estudiantes al siguiente grado.

Uso:
    python manage.py cerrar_anio_lectivo --nuevo-anio 2027
    python manage.py cerrar_anio_lectivo --nuevo-anio 2027 --promover-estudiantes
    python manage.py cerrar_anio_lectivo --nuevo-anio 2027 --solo-config
"""
from django.core.management.base import BaseCommand, CommandError


SIGUIENTE_GRADO = {
    # Inicial
    "Inicial 3 años": "Inicial 4 años",
    "Inicial 4 años": "Inicial 5 años",
    "Inicial 5 años": "1ro",
    # Primaria
    "1ro": "2do",
    "2do": "3ro",
    "3ro": "4to",
    "4to": "5to",
    "5to": "6to",
    # Secundaria
    "6to": "1ro",  # (o egresado si es primaria completa — depende del colegio)
    "1er": "2do",
    "2do": "3ro",
    "3ro": "4to",
    "4to": "5to",
    "5to": "egresado",
}


class Command(BaseCommand):
    help = "Cierra el año lectivo actual y abre el nuevo."

    def add_arguments(self, parser):
        parser.add_argument("--nuevo-anio", type=int, required=True, help="Año lectivo a activar (ej: 2027)")
        parser.add_argument("--promover-estudiantes", action="store_true",
                            help="Promover automáticamente a todos los estudiantes al siguiente grado.")
        parser.add_argument("--solo-config", action="store_true",
                            help="Solo actualiza el año activo en la config, sin copiar asignaciones.")
        parser.add_argument("--si", action="store_true", help="Confirmar sin preguntar.")

    def handle(self, *args, **options):
        from apps.core.models import ConfiguracionInstitucional
        from apps.notas.models import AsignacionDocente
        from apps.usuarios.models import Estudiante

        nuevo_anio = options["nuevo_anio"]
        cfg = ConfiguracionInstitucional.get_solo()
        anio_actual = cfg.anio_lectivo_activo

        if nuevo_anio <= anio_actual:
            raise CommandError(f"El nuevo año ({nuevo_anio}) debe ser mayor al actual ({anio_actual}).")

        if not options["si"]:
            self.stdout.write(f"\n{'='*60}")
            self.stdout.write(f"  CIERRE DE AÑO LECTIVO: {anio_actual} → {nuevo_anio}")
            self.stdout.write(f"{'='*60}")
            self.stdout.write(f"  Asignaciones del año {anio_actual}: {AsignacionDocente.objects.filter(anio_lectivo=anio_actual).count()}")
            self.stdout.write(f"  Estudiantes activos: {Estudiante.objects.filter(situacion_matricula='matriculado').count()}")
            respuesta = input("\n  ¿Confirmar? [s/N]: ").strip().lower()
            if respuesta != "s":
                self.stdout.write("  Cancelado.")
                return

        # ── 1. Actualizar año activo ──────────────────────────────────────────
        cfg.anio_lectivo_activo = nuevo_anio
        cfg.save(update_fields=["anio_lectivo_activo"])
        self.stdout.write(self.style.SUCCESS(f"✓ Año lectivo activo → {nuevo_anio}"))

        if options["solo_config"]:
            return

        # ── 2. Copiar asignaciones al nuevo año ───────────────────────────────
        asigs_actuales = AsignacionDocente.objects.filter(anio_lectivo=anio_actual)
        creadas = 0
        for asig in asigs_actuales:
            AsignacionDocente.objects.get_or_create(
                docente=asig.docente,
                seccion=asig.seccion,
                area=asig.area,
                anio_lectivo=nuevo_anio,
                defaults={"num_competencias": asig.num_competencias},
            )
            creadas += 1
        self.stdout.write(self.style.SUCCESS(
            f"✓ Asignaciones copiadas al {nuevo_anio}: {creadas} (mismas que el año anterior)"
        ))
        self.stdout.write("  ⚠  Revisá si cambiaron docentes o secciones antes de empezar el año.")

        # ── 3. Promover estudiantes (opcional) ────────────────────────────────
        if options["promover_estudiantes"]:
            promovidos = 0
            egresados = 0
            for est in Estudiante.objects.filter(situacion_matricula="matriculado"):
                grado_actual = est.grado or ""
                siguiente = SIGUIENTE_GRADO.get(grado_actual)
                if siguiente == "egresado":
                    est.situacion_matricula = "egresado"
                    est.save(update_fields=["situacion_matricula"])
                    egresados += 1
                elif siguiente:
                    # Buscar la sección del siguiente grado con la misma letra
                    from apps.usuarios.models import Seccion
                    letra = est.seccion or "A"
                    nueva_seccion = Seccion.objects.filter(grado__icontains=siguiente, letra=letra).first()
                    est.grado = siguiente
                    if nueva_seccion:
                        est.seccion = nueva_seccion.letra
                        est.seccion_obj = nueva_seccion
                    est.save(update_fields=["grado", "seccion", "seccion_obj"])
                    promovidos += 1
            self.stdout.write(self.style.SUCCESS(
                f"✓ Estudiantes promovidos: {promovidos} | Egresados: {egresados}"
            ))
            self.stdout.write("  ⚠  Verificá manualmente los estudiantes que repiten o cambiaron de sección.")

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS(f"  AÑO {nuevo_anio} ACTIVO. ¡El sistema está listo para el nuevo año!"))
        self.stdout.write(f"{'='*60}\n")
