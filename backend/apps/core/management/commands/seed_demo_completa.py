"""
Puebla módulos vacíos con data realista para grabar demo Loom y hacer QA.

Idempotente: verifica antes de crear. Corre después de seed_usuarios + seed_staff.

Puebla:
  - 5 docentes adicionales + tutorías completas
  - Aula virtual: 1 curso con 3 lecciones (recursos) + 2 tareas + entregas calificadas
  - Notas bimestre 1 completas por área → boletas PDF funcionales
  - Convivencia: 3 casos (uno próximo a vencer plazo → dispara alerta)
  - Reservas: 5 con mix de estados
  - Justificaciones: 4 con mix de estados
  - Sesiones de clase: 6 con asistencias
  - CampanaAutoRegistro activa para QR de visitas
  - Lecturas de comunicados

Uso:
    python manage.py seed_demo_completa
    python manage.py seed_demo_completa --reset   # borra y repuebla los módulos afectados
"""
import random
from datetime import date, datetime, timedelta, time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.usuarios.models import Usuario, Docente, Estudiante, Padre, Seccion, Rol


DOCENTES_EXTRA = [
    ("docente2", "María",   "Rojas",    "Comunicación"),
    ("docente3", "José",    "Mendoza",  "Ciencia y Tecnología"),
    ("docente4", "Elena",   "Torres",   "Ciencias Sociales"),
    ("docente5", "Ricardo", "Vargas",   "Educación Física"),
    ("docente6", "Patricia","Chávez",   "Arte y Cultura"),
]

AREAS_CURRICULARES = [
    "Matemática", "Comunicación", "Ciencia y Tecnología",
    "Ciencias Sociales", "Desarrollo Personal", "Arte y Cultura",
    "Educación Física", "Educación Religiosa", "Inglés",
]

# Nro. de competencias por área según formato SIAGIE (RVM 094-2020-MINEDU)
AREAS_NUM_COMPETENCIAS = {
    "Matemática": 2,
    "Comunicación": 3,
    "Ciencia y Tecnología": 1,
    "Ciencias Sociales": 3,
    "Desarrollo Personal": 2,
    "Arte y Cultura": 1,
    "Educación Física": 1,
    "Educación Religiosa": 1,
    "Inglés": 2,
}

ESCALAS = ["AD", "A", "B", "C"]
ESCALAS_PESO = [0.15, 0.55, 0.25, 0.05]  # distribución realista


class Command(BaseCommand):
    help = "Puebla módulos vacíos con data demo realista"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true",
                            help="Borra data existente antes de repoblar (destructivo)")

    @transaction.atomic
    def handle(self, *args, **opts):
        reset = opts.get("reset", False)
        self.stdout.write(self.style.MIGRATE_HEADING("→ Seed demo completa"))

        self._seed_docentes()
        self._asignar_tutores()
        self._seed_asignaciones(reset)
        self._seed_notas_bimestre(reset)
        self._seed_aula_virtual(reset)
        self._seed_convivencia(reset)
        self._seed_reservas(reset)
        self._seed_justificaciones(reset)
        self._seed_sesiones(reset)
        self._seed_campana_visitas()
        self._seed_lecturas_comunicados()

        self.stdout.write(self.style.SUCCESS("\n✓ Demo lista. Módulos poblados."))
        self._resumen()

    # ─────────────────────────────────────────────────────────── DOCENTES ──
    def _seed_docentes(self):
        creados = 0
        for username, nombre, apellido, especialidad in DOCENTES_EXTRA:
            u, is_new = Usuario.objects.get_or_create(
                username=username,
                defaults={"rol": Rol.DOCENTE, "first_name": nombre, "last_name": apellido},
            )
            if is_new:
                u.set_password(f"{username}2026")
                u.save()
                creados += 1
            Docente.objects.get_or_create(
                usuario=u, defaults={"especialidad": especialidad}
            )
        self.stdout.write(f"  docentes extra: +{creados}")

    def _asignar_tutores(self):
        docentes = list(Usuario.objects.filter(rol=Rol.DOCENTE).order_by("username"))
        if len(docentes) < 2:
            return
        secciones = list(Seccion.objects.order_by("nombre"))
        for i, s in enumerate(secciones):
            tutor = docentes[i % len(docentes)]
            if s.tutor_id != tutor.id:
                s.tutor = tutor
                s.save(update_fields=["tutor"])
        self.stdout.write(f"  tutores reasignados: {len(secciones)} secciones → {len(docentes)} docentes")

    # ──────────────────────────────────────────────── ASIGNACIONES DOCENTE ──
    def _seed_asignaciones(self, reset):
        from apps.notas.models import AsignacionDocente

        if reset:
            AsignacionDocente.objects.all().delete()

        if AsignacionDocente.objects.exists():
            self.stdout.write("  asignaciones: ya existen, skip")
            return

        docentes = list(Usuario.objects.filter(rol=Rol.DOCENTE).order_by("username"))
        secciones = list(Seccion.objects.all())

        if not docentes or not secciones:
            self.stdout.write("  asignaciones: sin docentes o secciones, skip")
            return

        from apps.notas.views import AREAS_PROFESOR_AULA
        creadas = 0
        areas_lista = list(AREAS_NUM_COMPETENCIAS.keys())
        docente_aula_idx = 0

        for seccion in secciones:
            if seccion.nivel in ("inicial", "primaria"):
                # Un solo docente enseña todo (profesor de aula)
                docente = docentes[docente_aula_idx % len(docentes)]
                docente_aula_idx += 1
                for area, num_comp in AREAS_PROFESOR_AULA.items():
                    AsignacionDocente.objects.get_or_create(
                        docente=docente,
                        seccion=seccion,
                        area=area,
                        defaults={"num_competencias": num_comp},
                    )
                    creadas += 1
            else:
                # Secundaria: un docente por área
                for i, area in enumerate(areas_lista):
                    docente = docentes[i % len(docentes)]
                    AsignacionDocente.objects.get_or_create(
                        docente=docente,
                        seccion=seccion,
                        area=area,
                        defaults={"num_competencias": AREAS_NUM_COMPETENCIAS[area]},
                    )
                    creadas += 1
        self.stdout.write(f"  asignaciones docente-sección-área: +{creadas}")

    # ────────────────────────────────────────────────────────────── NOTAS ──
    def _seed_notas_bimestre(self, reset):
        from apps.notas.models import NotaBimestre

        if reset:
            NotaBimestre.objects.all().delete()

        if NotaBimestre.objects.exists():
            self.stdout.write("  notas: ya existen, skip")
            return

        estudiantes = list(Estudiante.objects.filter(seccion_obj__isnull=False).select_related("usuario"))
        creadas = 0
        total_por_est = sum(AREAS_NUM_COMPETENCIAS.values()) * 2  # 2 bimestres
        for est in estudiantes:
            for bimestre in ("1", "2"):
                for area, num_comp in AREAS_NUM_COMPETENCIAS.items():
                    for comp in range(1, num_comp + 1):
                        escala = random.choices(ESCALAS, weights=ESCALAS_PESO, k=1)[0]
                        NotaBimestre.objects.create(
                            estudiante=est,
                            area=area,
                            bimestre=bimestre,
                            competencia=comp,
                            calificacion=escala,
                            # conclusion_descriptiva se auto-llena en save() desde CONCLUSIONES_NL
                        )
                        creadas += 1
        self.stdout.write(
            f"  notas B1+B2: +{creadas} "
            f"({len(estudiantes)} est × 2 bim × {sum(AREAS_NUM_COMPETENCIAS.values())} competencias)"
        )

    # ─────────────────────────────────────────────────────── AULA VIRTUAL ──
    def _seed_aula_virtual(self, reset):
        from apps.aula_virtual.models import Curso, Leccion, Recurso, Tarea, Entrega, TipoRecurso, EstadoEntrega

        if reset:
            Curso.objects.all().delete()

        docente_perfil = Docente.objects.filter(especialidad__icontains="Matemática").first() \
            or Docente.objects.first()
        if not docente_perfil:
            self.stdout.write("  aula virtual: sin docentes, skip")
            return
        docente_user = docente_perfil.usuario

        curso, is_new = Curso.objects.get_or_create(
            titulo="Matemática 5° - Bimestre I",
            defaults=dict(
                docente=docente_user,
                descripcion="Fracciones, decimales y porcentajes. Aplicaciones al comercio.",
                area="Matemática",
                color="#3B82F6",
                activo=True,
            ),
        )
        seccion_5to = Seccion.objects.filter(nombre__icontains="5to").first()
        if seccion_5to:
            curso.secciones.add(seccion_5to)

        if curso.lecciones.exists() and not is_new:
            self.stdout.write("  aula virtual: curso ya tiene contenido, skip")
            return

        lecciones_data = [
            ("Introducción a las fracciones", "Concepto de fracción, numerador y denominador. Fracciones equivalentes."),
            ("Suma y resta de fracciones", "Con igual y distinto denominador. Ejercicios aplicados."),
            ("Fracciones y decimales", "Conversión entre representaciones. Uso en compras y descuentos."),
        ]
        for i, (titulo, contenido) in enumerate(lecciones_data, start=1):
            lec = Leccion.objects.create(
                curso=curso, orden=i, titulo=titulo, contenido=contenido, publicada=True,
            )
            Recurso.objects.create(
                leccion=lec, orden=1, tipo=TipoRecurso.VIDEO_YOUTUBE,
                titulo=f"Video: {titulo}", url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            )
            Recurso.objects.create(
                leccion=lec, orden=2, tipo="texto" if hasattr(TipoRecurso, "TEXTO") else TipoRecurso.choices[-1][0],
                titulo="Resumen de la lección", contenido=contenido + "\n\nPuntos clave: ...",
            )

        # 2 tareas
        seccion_est = list(Estudiante.objects.filter(seccion_obj=seccion_5to)) if seccion_5to else []
        for i, titulo in enumerate(["Práctica calificada 1: Fracciones", "Trabajo grupal: Aplicación al mercado"], start=1):
            t = Tarea.objects.create(
                curso=curso,
                titulo=titulo,
                descripcion="Resolver los ejercicios del cuaderno de trabajo, páginas 12-15.",
                fecha_entrega=timezone.now() + timedelta(days=7 * i),
                puntaje_maximo=Decimal("20.00"),
            )
            # 60% de estudiantes ya entregó
            entregadores = random.sample(seccion_est, k=int(len(seccion_est) * 0.6)) if seccion_est else []
            for est in entregadores:
                nota_val = Decimal(str(random.choice([12, 14, 15, 16, 17, 18])))
                Entrega.objects.get_or_create(
                    tarea=t, estudiante=est,
                    defaults=dict(
                        texto="Adjunto el desarrollo de los 10 problemas.",
                        estado=EstadoEntrega.choices[2][0],  # calificada
                        nota=nota_val,
                        comentario_docente="Buen trabajo. Revisar el problema 7.",
                        calificada_por=docente_user,
                        calificada_en=timezone.now(),
                    ),
                )
        self.stdout.write(f"  aula virtual: curso + {len(lecciones_data)} lecciones + 2 tareas + entregas")

    # ──────────────────────────────────────────────────────── CONVIVENCIA ──
    def _seed_convivencia(self, reset):
        from apps.convivencia.models import CasoConvivencia, SeguimientoCaso, TipoCaso, GravedadCaso, EstadoCaso

        if reset:
            CasoConvivencia.objects.all().delete()

        if CasoConvivencia.objects.exists():
            self.stdout.write("  convivencia: ya hay casos, skip")
            return

        director = Usuario.objects.filter(rol=Rol.DIRECTOR).first()
        psicologa = Usuario.objects.filter(rol="psicologa").first() or director
        if not director:
            return

        estudiantes = list(Estudiante.objects.filter(seccion_obj__isnull=False))
        if len(estudiantes) < 4:
            return

        casos_data = [
            dict(
                tipo="estud_verbal",
                gravedad=GravedadCaso.MODERADA,
                estado=EstadoCaso.EN_ATENCION,
                dias_atras=25,  # cerca de vencer (30 días plazo)
                ubicacion="Aula 3ro A",
                descripcion="Se reporta agresión verbal reiterada entre estudiantes del 3ro A durante el recreo. Se activó protocolo SíseVe.",
            ),
            dict(
                tipo="estud_fisico",
                gravedad=GravedadCaso.GRAVE,
                estado=EstadoCaso.EN_ATENCION,
                dias_atras=10,
                ubicacion="Patio principal",
                descripcion="Incidente físico durante hora de recreo. Ambos estudiantes recibieron atención en tópico. Padres notificados.",
            ),
            dict(
                tipo="ciber",
                gravedad=GravedadCaso.MODERADA,
                estado=EstadoCaso.RECIBIDO,
                dias_atras=2,
                ubicacion="Fuera del colegio (redes sociales)",
                descripcion="Padre reporta captura de mensajes de WhatsApp con contenido ofensivo dirigido a su hija. En análisis.",
            ),
        ]

        for cd in casos_data:
            dias = cd.pop("dias_atras")
            afectado, agresor = random.sample(estudiantes, 2)
            caso = CasoConvivencia.objects.create(
                fecha_hecho=date.today() - timedelta(days=dias),
                reportado_por=director,
                responsable=psicologa,
                **cd,
            )
            # forzar fecha_reporte hacia atrás para que fecha_limite calculada tenga sentido
            CasoConvivencia.objects.filter(pk=caso.pk).update(
                fecha_reporte=timezone.now() - timedelta(days=dias),
                fecha_limite=timezone.now() - timedelta(days=dias) + timedelta(days=30),
            )
            caso.estudiantes_afectados.add(afectado)
            caso.estudiantes_agresores.add(agresor)

            SeguimientoCaso.objects.create(
                caso=caso, autor=psicologa, accion="entrevista",
                detalle="Entrevista inicial con estudiantes involucrados y padres. Se acuerda seguimiento semanal.",
            )
            if cd["estado"] == EstadoCaso.EN_ATENCION:
                SeguimientoCaso.objects.create(
                    caso=caso, autor=psicologa, accion="mediacion",
                    detalle="Sesión de mediación. Compromiso firmado por ambas partes.",
                )
        self.stdout.write(f"  convivencia: {len(casos_data)} casos (1 próximo a vencer)")

    # ─────────────────────────────────────────────────────────── RESERVAS ──
    def _seed_reservas(self, reset):
        from apps.reservas.models import Reserva, EstadoReserva
        from apps.ambientes.models import Ambiente

        if reset:
            Reserva.objects.all().delete()
        if Reserva.objects.exists():
            self.stdout.write("  reservas: ya existen, skip")
            return

        ambientes = list(Ambiente.objects.filter(reservable=True)[:5]) or list(Ambiente.objects.all()[:5])
        docentes = list(Usuario.objects.filter(rol=Rol.DOCENTE))
        director = Usuario.objects.filter(rol=Rol.DIRECTOR).first()
        if not ambientes or not docentes or not director:
            return

        estados = [
            EstadoReserva.APROBADA,
            EstadoReserva.APROBADA,
            EstadoReserva.choices[0][0],  # solicitada
            "rechazada" if any(c[0] == "rechazada" for c in EstadoReserva.choices) else EstadoReserva.APROBADA,
            EstadoReserva.APROBADA,
        ]
        for i, estado in enumerate(estados):
            r = Reserva.objects.create(
                ambiente=random.choice(ambientes),
                solicitante=random.choice(docentes),
                fecha=date.today() + timedelta(days=i - 1),
                hora_inicio=time(8 + i, 0),
                hora_fin=time(9 + i, 0),
                motivo=f"Clase de laboratorio - 3ro A" if i % 2 else "Ensayo de aniversario",
                participantes_estimados=25,
                estado=estado,
            )
            if estado != "solicitada":
                Reserva.objects.filter(pk=r.pk).update(
                    revisado_por=director, fecha_revision=timezone.now(),
                )
        self.stdout.write(f"  reservas: {len(estados)}")

    # ──────────────────────────────────────────────────── JUSTIFICACIONES ──
    def _seed_justificaciones(self, reset):
        from apps.justificaciones.models import Justificacion, MotivoJustificacion, EstadoJustificacion

        if reset:
            Justificacion.objects.all().delete()
        if Justificacion.objects.exists():
            self.stdout.write("  justificaciones: ya existen, skip")
            return

        padre = Usuario.objects.filter(rol=Rol.PADRE).first()
        director = Usuario.objects.filter(rol=Rol.DIRECTOR).first()
        padre_perfil = Padre.objects.filter(usuario=padre).first() if padre else None
        if not padre_perfil or not padre_perfil.hijos.exists():
            return

        hijo = padre_perfil.hijos.first()
        casos = [
            (10, MotivoJustificacion.ENFERMEDAD, EstadoJustificacion.APROBADA, "Gripe estacional, con reposo indicado."),
            (5,  MotivoJustificacion.CITA_MEDICA, EstadoJustificacion.APROBADA, "Cita en Essalud, tarjeta adjunta."),
            (2,  MotivoJustificacion.choices[2][0], EstadoJustificacion.PENDIENTE, "Trámite en RENIEC para DNI."),
            (1,  MotivoJustificacion.ENFERMEDAD, EstadoJustificacion.PENDIENTE, "Dolor abdominal, en observación."),
        ]
        for dias, motivo, estado, desc in casos:
            j = Justificacion.objects.create(
                estudiante=hijo,
                fecha_falta=date.today() - timedelta(days=dias),
                motivo=motivo,
                descripcion=desc,
                reportada_por=padre,
                estado=estado,
            )
            if estado == EstadoJustificacion.APROBADA:
                Justificacion.objects.filter(pk=j.pk).update(
                    revisada_por=director, fecha_revision=timezone.now(),
                )
        self.stdout.write(f"  justificaciones: {len(casos)}")

    # ─────────────────────────────────────────────────────────── SESIONES ──
    def _seed_sesiones(self, reset):
        from apps.asistencia.models import SesionClase, AsistenciaSesion
        from apps.ambientes.models import Ambiente

        if reset:
            SesionClase.objects.all().delete()
        if SesionClase.objects.exists():
            self.stdout.write("  sesiones: ya existen, skip")
            return

        docentes = list(Docente.objects.all())
        ambientes = list(Ambiente.objects.all())
        secciones = list(Seccion.objects.all())
        if not docentes or not ambientes or not secciones:
            return

        creadas = 0
        for i in range(6):
            docente = random.choice(docentes)
            seccion = random.choice(secciones)
            ambiente = random.choice(ambientes)
            fecha = date.today() - timedelta(days=random.randint(0, 5))
            hi = time(random.choice([8, 9, 10, 11, 14]), 0)
            hf = time(hi.hour + 1, 30)
            sesion = SesionClase.objects.create(
                docente=docente.usuario, ambiente=ambiente, seccion=seccion,
                tema=random.choice(["Repaso de fracciones", "Práctica dirigida", "Lectura comprensiva",
                                     "Experimento de laboratorio", "Debate grupal", "Exposición"]),
                fecha=fecha, hora_inicio=hi, hora_fin=hf,
            )
            for est in Estudiante.objects.filter(seccion_obj=seccion):
                AsistenciaSesion.objects.create(
                    sesion=sesion, estudiante=est,
                    presente=random.random() > 0.1,
                    marcado_por=docente.usuario,
                )
            creadas += 1
        self.stdout.write(f"  sesiones de clase: +{creadas}")

    # ────────────────────────────────────────────────────── QR AUTOREG ─────
    def _seed_campana_visitas(self):
        from apps.visitas.models import CampanaAutoRegistro

        if CampanaAutoRegistro.objects.filter(activa=True).exists():
            self.stdout.write("  campaña QR visitas: ya activa")
            return
        director = Usuario.objects.filter(rol=Rol.DIRECTOR).first()
        CampanaAutoRegistro.objects.create(
            nombre="Auto-registro portería",
            activa=True,
            requiere_confirmacion=True,
            mensaje_bienvenida="Bienvenido/a. Registra tu ingreso con DNI y motivo. Espera la confirmación del conserje.",
            creado_por=director,
            token_rota_cada_dias=30,
        )
        self.stdout.write("  campaña QR visitas: creada")

    # ─────────────────────────────────────────────── LECTURAS COMUNICADOS ──
    def _seed_lecturas_comunicados(self):
        from apps.comunicados.models import Comunicado, LecturaComunicado

        if LecturaComunicado.objects.exists():
            self.stdout.write("  lecturas comunicados: ya existen, skip")
            return
        comunicados = list(Comunicado.objects.all()[:3])
        padres = list(Usuario.objects.filter(rol=Rol.PADRE))
        docentes = list(Usuario.objects.filter(rol=Rol.DOCENTE))
        lectores = padres + docentes
        creadas = 0
        for c in comunicados:
            for u in random.sample(lectores, k=min(len(lectores), 3)):
                _, is_new = LecturaComunicado.objects.get_or_create(
                    comunicado=c, usuario=u,
                    defaults={"ip": "127.0.0.1"} if any(
                        f.name == "ip" for f in LecturaComunicado._meta.fields
                    ) else {},
                )
                if is_new:
                    creadas += 1
        self.stdout.write(f"  lecturas comunicados: +{creadas}")

    # ────────────────────────────────────────────────────────── RESUMEN ────
    def _resumen(self):
        from django.apps import apps as django_apps
        checks = [
            ("usuarios", "Docente"), ("notas", "AsignacionDocente"), ("notas", "NotaBimestre"),
            ("aula_virtual", "Curso"), ("aula_virtual", "Leccion"),
            ("aula_virtual", "Tarea"), ("aula_virtual", "Entrega"),
            ("convivencia", "CasoConvivencia"), ("convivencia", "SeguimientoCaso"),
            ("reservas", "Reserva"), ("justificaciones", "Justificacion"),
            ("asistencia", "SesionClase"), ("asistencia", "AsistenciaSesion"),
            ("visitas", "CampanaAutoRegistro"), ("comunicados", "LecturaComunicado"),
        ]
        self.stdout.write("\n── Estado final ──")
        for app, model in checks:
            try:
                m = django_apps.get_model(app, model)
                self.stdout.write(f"  {app}.{model}: {m.objects.count()}")
            except Exception:
                pass
