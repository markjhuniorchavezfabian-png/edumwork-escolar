"""Seed rico de incidencias (40 registros) con distribución realista de fechas,
estados, tipos y ubicaciones. Producido para que el demo del Director muestre
KPIs y gráficos con densidad creíble."""
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.incidencias.models import (
    EstadoIncidencia,
    Incidencia,
    PrioridadIncidencia,
    TipoIncidencia,
)
from apps.usuarios.models import Rol, Usuario


UBICACIONES = [
    "Aula 1ro A", "Aula 1ro B", "Aula 2do A", "Aula 2do B",
    "Aula 3ro A", "Aula 3ro B", "Aula 4to A", "Aula 5to A",
    "AIP", "AIP", "AIP",  # AIP repetido a propósito: es el ambiente con más incidencias
    "Dirección", "Secretaría", "Sala de docentes", "Laboratorio",
]

PLANTILLAS = [
    ("proyector", "alta",  "Proyector no enciende en {ubi}",
     "El proyector no responde al botón de encendido. Se verificó el cable de corriente.",
     "Se reemplazó el fusible interno del proyector."),
    ("proyector", "media", "Proyector con imagen borrosa en {ubi}",
     "La imagen sale desenfocada aún ajustando el zoom. Posible desgaste de lámpara.",
     "Se cambió la lámpara del proyector."),
    ("proyector", "media", "Proyector se apaga solo en {ubi}",
     "Cada 15-20 minutos se apaga con luz roja parpadeante. Sobrecalentamiento.",
     "Se limpió el filtro y el ventilador interno."),
    ("pc", "alta",  "PC del docente no arranca en {ubi}",
     "Muestra pantalla azul al iniciar Windows. Sin cambios recientes reportados.",
     "Se restauró el sistema desde punto de restauración anterior."),
    ("pc", "media", "PC lenta al abrir aplicaciones en {ubi}",
     "Demora mucho al abrir Word y navegador. Disco casi lleno.",
     "Se liberó espacio y se desactivaron programas de inicio."),
    ("pc", "alta",  "PC de secretaría reinicia sola",
     "Se reinicia cada hora sin advertencia. Podría ser fuente o tarjeta madre.",
     "Se reemplazó la fuente de poder."),
    ("red", "alta",  "Sin señal WiFi en {ubi}",
     "Toda la zona reporta que no llega la señal desde hace 2 horas.",
     "Se reinició el access point y se actualizó firmware."),
    ("red", "media", "Internet muy lento en {ubi}",
     "Páginas tardan más de 30 segundos en cargar. Otros ambientes normales.",
     "Se cambió el cable UTP y se recrimpó el conector."),
    ("red", "media", "Impresora no aparece en la red en {ubi}",
     "Después del corte de luz de ayer no aparece en la lista de impresoras.",
     "Se reasignó IP fija a la impresora."),
    ("pizarra", "media", "Pizarra digital sin táctil en {ubi}",
     "Proyecta pero no responde al lápiz ni al dedo.",
     "Se recalibró la pizarra desde el software del fabricante."),
    ("pizarra", "baja",  "Pizarra digital con marcas fantasma en {ubi}",
     "Aparecen líneas aleatorias sin tocar la superficie.",
     "Se limpió la superficie y se cambió la pluma del lápiz."),
    ("impresora", "baja",  "Impresora con atascos frecuentes en {ubi}",
     "Cada 3-4 hojas se atasca. Rodillos posiblemente desgastados.",
     "Se limpiaron los rodillos y se reemplazó el kit de mantenimiento."),
    ("impresora", "media", "Impresora imprime con líneas verticales en {ubi}",
     "Todas las hojas salen con rayas negras verticales.",
     "Se reemplazó el toner y se limpió el tambor."),
    ("otro", "baja",  "Cable HDMI dañado en {ubi}",
     "Presenta cortes intermitentes en la imagen del proyector.",
     "Se reemplazó el cable HDMI."),
    ("otro", "baja",  "Mouse inalámbrico no responde en {ubi}",
     "No responde tras cambiar pilas nuevas.",
     "Se re-emparejó el receptor USB con el mouse."),
    ("otro", "baja",  "Teclado con teclas trabadas en {ubi}",
     "Varias teclas atascadas por líquido derramado.",
     "Se reemplazó el teclado."),
]


class Command(BaseCommand):
    help = "Crea 40 incidencias de ejemplo con fechas y estados distribuidos."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Elimina las incidencias existentes antes de crear.")
        parser.add_argument("--cantidad", type=int, default=40, help="Cantidad de incidencias a crear.")

    def handle(self, *args, **options):
        docentes = list(Usuario.objects.filter(rol=Rol.DOCENTE))
        admin_tic = Usuario.objects.filter(rol=Rol.ADMIN_TIC).first()

        if not docentes:
            self.stdout.write(self.style.ERROR(
                "No hay docentes. Ejecute primero: python manage.py seed_usuarios"
            ))
            return

        if options["reset"]:
            n = Incidencia.objects.count()
            Incidencia.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Eliminadas {n} incidencias previas."))
        elif Incidencia.objects.exists():
            self.stdout.write("Ya existen incidencias. Usa --reset para regenerar.")
            return

        rng = random.Random(42)  # semilla fija para reproducibilidad del demo
        ahora = timezone.now()
        cantidad = options["cantidad"]

        # Distribución de estados objetivo:
        # 15% nuevas, 20% en atención, 55% resueltas, 10% cerradas
        distribucion = (
            [EstadoIncidencia.NUEVA] * int(cantidad * 0.15) +
            [EstadoIncidencia.EN_ATENCION] * int(cantidad * 0.20) +
            [EstadoIncidencia.RESUELTA] * int(cantidad * 0.55) +
            [EstadoIncidencia.CERRADA] * int(cantidad * 0.10)
        )
        # Rellenar el remainder
        while len(distribucion) < cantidad:
            distribucion.append(EstadoIncidencia.RESUELTA)
        rng.shuffle(distribucion)

        creadas = 0
        for idx in range(cantidad):
            tipo, prioridad, tit_tmpl, desc, solucion_tmpl = rng.choice(PLANTILLAS)
            ubicacion = rng.choice(UBICACIONES)
            estado = distribucion[idx]
            docente = rng.choice(docentes)

            # Fecha de creación: distribuida en los últimos 30 días
            dias_atras = rng.uniform(0.1, 30)
            creado = ahora - timedelta(days=dias_atras)

            inc = Incidencia(
                titulo=tit_tmpl.format(ubi=ubicacion),
                descripcion=desc,
                ubicacion=ubicacion,
                tipo=tipo,
                prioridad=prioridad,
                estado=estado,
                reportado_por=docente,
            )

            # Fechas de flujo
            if estado in (EstadoIncidencia.EN_ATENCION, EstadoIncidencia.RESUELTA, EstadoIncidencia.CERRADA):
                inc.asignado_a = admin_tic
                # Atención: entre 30 min y 8 horas después de creado
                horas_hasta_atencion = rng.uniform(0.5, 8)
                inc.fecha_atencion = creado + timedelta(hours=horas_hasta_atencion)

            if estado in (EstadoIncidencia.RESUELTA, EstadoIncidencia.CERRADA):
                # Resolución: entre 2 y 48 horas después de atendido
                horas_hasta_resolucion = rng.uniform(2, 48)
                inc.fecha_resolucion = inc.fecha_atencion + timedelta(hours=horas_hasta_resolucion)
                # No usar más de "ahora"
                if inc.fecha_resolucion > ahora:
                    inc.fecha_resolucion = ahora - timedelta(hours=rng.uniform(0.5, 4))
                inc.solucion = solucion_tmpl
                inc.notas_admin = f"Diagnóstico inicial: {tipo} — atendido en {ubicacion}."

            inc.save()

            # Backdate creado_en para que las métricas semanales/mensuales se vean
            Incidencia.objects.filter(pk=inc.pk).update(creado_en=creado)

            creadas += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nSeed completado: {creadas} incidencias creadas."
        ))
        self.stdout.write(
            f"Distribución: {sum(1 for e in distribucion if e == EstadoIncidencia.NUEVA)} nuevas, "
            f"{sum(1 for e in distribucion if e == EstadoIncidencia.EN_ATENCION)} en atención, "
            f"{sum(1 for e in distribucion if e == EstadoIncidencia.RESUELTA)} resueltas, "
            f"{sum(1 for e in distribucion if e == EstadoIncidencia.CERRADA)} cerradas."
        )
