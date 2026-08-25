"""
Deja la BD como un colegio recién instalado, para probar el wizard /onboarding.

Borra:
  - Toda la data operativa: notas, asistencias, sesiones, cursos, tareas,
    casos convivencia, reservas, justificaciones, comunicados, incidencias,
    inventario, visitas, campañas QR.
  - Estudiantes, padres, docentes (perfiles + usuarios)
  - Secciones y ambientes
  - Resetea ConfiguracionInstitucional a valores vacíos.

Preserva:
  - Usuarios con rol: director, subdirector, admin_tic, secretaria, auxiliar,
    psicologa, conserje, ugel (staff base creado por seed_usuarios/seed_staff)

Uso:
    python manage.py reset_para_probar_onboarding --si-estoy-seguro
    python manage.py reset_para_probar_onboarding --si-estoy-seguro --restaurar-demo

Con --restaurar-demo corre seed_usuarios + seed_demo_completa al final.
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import transaction


ROLES_A_BORRAR = {"docente", "estudiante", "padre"}


class Command(BaseCommand):
    help = "Resetea la BD para simular colegio recién instalado (destructivo)"

    def add_arguments(self, parser):
        parser.add_argument("--si-estoy-seguro", action="store_true",
                            help="Confirma el borrado destructivo")
        parser.add_argument("--restaurar-demo", action="store_true",
                            help="Después del reset, corre seeds de demo")

    @transaction.atomic
    def handle(self, *args, **opts):
        if not opts.get("si_estoy_seguro"):
            self.stdout.write(self.style.ERROR(
                "\n⚠  Este comando es DESTRUCTIVO.\n"
                "Borra estudiantes, docentes, secciones, notas, etc.\n"
                "Para confirmar: agrega --si-estoy-seguro\n"
            ))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("→ Reset para probar onboarding"))

        self._borrar_operativos()
        self._borrar_relaciones_familiares()
        self._borrar_perfiles_y_usuarios()
        self._borrar_secciones_y_ambientes()
        self._resetear_config()

        self.stdout.write(self.style.SUCCESS("\n✓ Reset completo. BD como colegio recién instalado."))
        self.stdout.write("  Login con director / director2026")
        self.stdout.write("  → Al entrar verás el banner 'Termina de configurar tu colegio'")
        self.stdout.write("  → O anda directo a /onboarding\n")

        if opts.get("restaurar_demo"):
            self.stdout.write(self.style.MIGRATE_HEADING("→ Restaurando demo..."))
            call_command("seed_usuarios")
            try:
                call_command("seed_staff")
            except Exception:
                pass
            call_command("seed_demo_completa")

    # ─────────────────────────────────────────────────────────── borrados ──
    def _borrar_operativos(self):
        modelos = [
            ("notas", "NotaBimestre"),
            ("asistencia", "AsistenciaSesion"),
            ("asistencia", "SesionClase"),
            ("asistencia", "RegistroAsistencia"),
            ("aula_virtual", "Entrega"),
            ("aula_virtual", "Tarea"),
            ("aula_virtual", "Recurso"),
            ("aula_virtual", "Leccion"),
            ("aula_virtual", "Curso"),
            ("convivencia", "SeguimientoCaso"),
            ("convivencia", "CasoConvivencia"),
            ("reservas", "Reserva"),
            ("justificaciones", "Justificacion"),
            ("comunicados", "LecturaComunicado"),
            ("comunicados", "Comunicado"),
            ("incidencias", "ComentarioIncidencia"),
            ("incidencias", "Incidencia"),
            ("inventario", "Equipo"),
            ("visitas", "Visita"),
            ("visitas", "CampanaAutoRegistro"),
            ("ambientes", "BitacoraUsoAmbiente"),
            ("asistencia_personal", "RegistroPersonal"),
            ("auditoria", "Auditoria"),
            ("notificaciones", "Notificacion"),
        ]
        for app, name in modelos:
            n = self._borrar(app, name)
            if n:
                self.stdout.write(f"  {app}.{name}: -{n}")

    def _borrar_relaciones_familiares(self):
        from apps.usuarios.models import Padre
        for p in Padre.objects.all():
            p.hijos.clear()
        self.stdout.write("  padres.hijos: relaciones limpiadas")

    def _borrar_perfiles_y_usuarios(self):
        from apps.usuarios.models import Usuario, Estudiante, Docente, Padre
        # Perfiles primero
        e = Estudiante.objects.count()
        Estudiante.objects.all().delete()
        d = Docente.objects.count()
        Docente.objects.all().delete()
        p = Padre.objects.count()
        Padre.objects.all().delete()
        # Usuarios de esos roles
        u = Usuario.objects.filter(rol__in=list(ROLES_A_BORRAR)).count()
        Usuario.objects.filter(rol__in=list(ROLES_A_BORRAR)).delete()
        self.stdout.write(f"  perfiles: -{e} estudiantes, -{d} docentes, -{p} padres")
        self.stdout.write(f"  usuarios (rol docente/estudiante/padre): -{u}")

    def _borrar_secciones_y_ambientes(self):
        s = self._borrar("usuarios", "Seccion")
        a = self._borrar("ambientes", "Ambiente")
        if s: self.stdout.write(f"  secciones: -{s}")
        if a: self.stdout.write(f"  ambientes: -{a}")

    def _resetear_config(self):
        from apps.core.models import ConfiguracionInstitucional
        cfg = ConfiguracionInstitucional.objects.first()
        if not cfg:
            self.stdout.write("  configuración: no existía")
            return
        cfg.nombre_institucion = ""
        cfg.codigo_modular = ""
        for campo in ("direccion", "ugel", "dre", "telefono", "email"):
            if hasattr(cfg, campo):
                setattr(cfg, campo, "")
        cfg.save()
        self.stdout.write("  configuración institucional: campos vaciados")

    def _borrar(self, app: str, model: str) -> int:
        from django.apps import apps as django_apps
        try:
            M = django_apps.get_model(app, model)
        except LookupError:
            return 0
        n = M.objects.count()
        if n:
            M.objects.all().delete()
        return n
