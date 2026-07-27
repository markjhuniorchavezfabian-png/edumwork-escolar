"""Seed de QA: 1 mes de asistencia + notas B1 completas con C garantizados.
Asegura que Alertas tempranas, chat IA y todos los flujos tengan datos reales."""
import random
from datetime import date, time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

ESCALAS = ["AD", "A", "B", "C"]
ESCALAS_PESO = [0.15, 0.55, 0.20, 0.10]  # 10% C para activar alertas

AREAS_COMP = {
    "Comunicación": 3,
    "Matemática": 3,
    "Ciencia y Tecnología": 2,
    "Historia, Geografía y Economía": 2,
    "Arte y Cultura": 1,
    "Educación Física": 1,
    "Inglés": 2,
}


class Command(BaseCommand):
    help = "Seed QA: 30 días asistencia + notas B1 completas para todos los estudiantes."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Borra asistencia y notas previas.")

    def handle(self, *args, **opts):
        rng = random.Random(99)
        reset = opts["reset"]

        from apps.asistencia.models import RegistroAsistencia
        from apps.notas.models import AsignacionDocente, NotaBimestre
        from apps.usuarios.models import Estudiante, Usuario, Rol

        docente = Usuario.objects.filter(rol=Rol.DOCENTE).first()
        if not docente:
            self.stdout.write(self.style.ERROR("Corre seed_usuarios primero."))
            return

        estudiantes = list(Estudiante.objects.filter(
            situacion_matricula="matriculado"
        ).select_related("usuario", "seccion_obj"))

        if not estudiantes:
            self.stdout.write(self.style.ERROR("No hay estudiantes. Corre seed_asistencia primero."))
            return

        self.stdout.write(f"Estudiantes: {len(estudiantes)}")

        # ── 1. Asistencia: 30 días hábiles ─────────────────────────────────────
        if reset:
            n = RegistroAsistencia.objects.all().delete()[0]
            self.stdout.write(self.style.WARNING(f"  Eliminados {n} registros de asistencia."))

        hoy = timezone.localdate()
        dist = (["presente"] * 82 + ["tardanza"] * 8 +
                ["ausente"] * 8 + ["justificado"] * 2)

        # Forzar 3-6 ausencias en 4 estudiantes específicos para activar alertas
        estudiantes_riesgo = estudiantes[:4]

        dias_habiles = []
        d = hoy
        while len(dias_habiles) < 22:  # ~1 mes de días hábiles
            if d.weekday() < 5:
                dias_habiles.append(d)
            d -= timedelta(days=1)

        creados_asist = 0
        for fecha in dias_habiles:
            for est in estudiantes:
                if RegistroAsistencia.objects.filter(estudiante=est, fecha=fecha).exists():
                    continue
                # Estudiantes de riesgo: más ausencias en los últimos 20 días
                es_riesgo = est in estudiantes_riesgo
                if es_riesgo and fecha >= hoy - timedelta(days=20):
                    estado = rng.choices(
                        ["presente", "ausente", "tardanza"],
                        weights=[60, 30, 10], k=1
                    )[0]
                else:
                    estado = rng.choice(dist)

                hora = None
                justif = ""
                if estado == "tardanza":
                    hora = time(hour=7, minute=rng.randint(15, 45))
                elif estado == "presente":
                    hora = time(hour=7, minute=rng.randint(0, 10))
                elif estado == "justificado":
                    justif = rng.choice([
                        "Cita médica en Essalud",
                        "Trámite en RENIEC",
                        "Enfermedad familiar",
                    ])

                RegistroAsistencia.objects.create(
                    estudiante=est, fecha=fecha, estado=estado,
                    hora_llegada=hora, justificacion=justif,
                    marcado_por=docente,
                )
                creados_asist += 1

        self.stdout.write(self.style.SUCCESS(f"  Asistencia: {creados_asist} registros creados."))

        # ── 2. Notas B1 completas ───────────────────────────────────────────────
        if reset:
            n = NotaBimestre.objects.filter(bimestre="1").delete()[0]
            self.stdout.write(self.style.WARNING(f"  Eliminadas {n} notas B1 previas."))

        anio = timezone.now().year
        asigs = list(AsignacionDocente.objects.filter(
            anio_lectivo=anio
        ).select_related("seccion", "docente"))

        if not asigs:
            self.stdout.write(self.style.WARNING("  Sin asignaciones. Corre seed_demo_completa primero."))
        else:
            creadas_notas = 0
            for asig in asigs:
                ests_seccion = [e for e in estudiantes if e.seccion_obj_id == asig.seccion_id]
                num_comp = asig.num_competencias or AREAS_COMP.get(asig.area, 2)
                for est in ests_seccion:
                    for comp in range(1, num_comp + 1):
                        # Estudiantes de riesgo: más peso en B y C
                        es_riesgo = est in estudiantes_riesgo
                        if es_riesgo:
                            cal = rng.choices(ESCALAS, weights=[0.05, 0.30, 0.35, 0.30], k=1)[0]
                        else:
                            cal = rng.choices(ESCALAS, weights=ESCALAS_PESO, k=1)[0]

                        obj, created = NotaBimestre.objects.get_or_create(
                            estudiante=est,
                            anio_lectivo=anio,
                            area=asig.area,
                            bimestre="1",
                            competencia=comp,
                            defaults={"calificacion": cal},
                        )
                        if created:
                            creadas_notas += 1
                        elif not obj.calificacion:
                            obj.calificacion = cal
                            obj.save(update_fields=["calificacion"])
                            creadas_notas += 1

            self.stdout.write(self.style.SUCCESS(f"  Notas B1: {creadas_notas} registros creados/actualizados."))

        # ── 3. Resumen de alertas esperadas ─────────────────────────────────────
        from apps.asistencia.models import RegistroAsistencia as RA
        from django.db.models import Count
        inicio_mes = hoy.replace(day=1)
        top = (RA.objects.filter(fecha__gte=inicio_mes, estado="ausente")
               .values("estudiante__usuario__first_name", "estudiante__usuario__last_name")
               .annotate(f=Count("id")).order_by("-f")[:5])

        self.stdout.write("\n--- Estudiantes con más faltas este mes ---")
        for r in top:
            self.stdout.write(f"  {r['estudiante__usuario__last_name']} {r['estudiante__usuario__first_name']}: {r['f']} faltas")

        notas_c = NotaBimestre.objects.filter(calificacion="C", bimestre="1").count()
        self.stdout.write(f"\nNotas en C (B1): {notas_c}")
        self.stdout.write(self.style.SUCCESS("\n✓ Seed QA completo."))
