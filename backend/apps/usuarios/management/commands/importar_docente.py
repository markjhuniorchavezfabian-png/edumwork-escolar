"""Importa al institucional los datos de un docente que venía usando EduMWork Docente.

Es la mitad de p_03 del puente comercial: el docente adopta p_04 por su cuenta,
su colegio compra el institucional y sus clases, alumnos, asistencia y notas se
mudan sin perder historial. El JSON lo genera `GET /api/migracion/exportar/`
en p_04 (`apps/tenants/exportacion.py` — ese archivo es el contrato).

    python manage.py importar_docente export.json --docente ana@colegio.pe
    python manage.py importar_docente export.json --docente ana@colegio.pe --aplicar

**Por defecto no escribe nada**: muestra el preview y sale. Hay que pasar
`--aplicar`, y entonces todo corre en una transacción (o entra todo, o nada).

Es idempotente: reimportar el mismo archivo no duplica. Los estudiantes se
reconocen por `codigo_migracion`, y si es la primera vez, por DNI o por
nombre + fecha de nacimiento, para no crear un duplicado de alguien que la
secretaría ya había cargado a mano.

Dos cosas no calzan 1:1 entre los productos y el comando las resuelve así:

- **Asistencia.** En p_04 hay un registro por clase y día (un alumno con dos
  cursos del mismo docente tiene dos). En p_03 hay uno por día. Se colapsa con
  criterio de presencia real: presente > tardanza > justificado > ausente. Si
  asistió a alguna clase, ese día cuenta como asistido.
- **Sesiones de aprendizaje.** p_03 todavía no las persiste (las genera con IA
  al vuelo). No se pierden: se guardan en un `.sesiones.json` al lado del
  archivo de entrada, listo para cuando exista el modelo.
"""

import json
import uuid
from datetime import datetime, time
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.asistencia.models import RegistroAsistencia
from apps.notas.models import AsignacionDocente, HorarioClase, NotaBimestre
from apps.usuarios.models import Estudiante, Matricula, Rol, Seccion, Usuario

FORMATO_ESPERADO = "edumwork.migracion.docente"
VERSIONES_SOPORTADAS = (1,)

# Orden de presencia real: si asistió a alguna clase del día, el día cuenta.
PRIORIDAD_ASISTENCIA = {"presente": 4, "tardanza": 3, "justificado": 2, "ausente": 1}

ORDINAL_GRADO = {
    "1": "1ro", "2": "2do", "3": "3ro", "4": "4to",
    "5": "5to", "6": "6to", "7": "7mo",
}


def _fecha(valor):
    return datetime.fromisoformat(valor).date() if valor else None


def _hora(valor):
    # `fromisoformat` acepta "08:15", "08:15:00" y con microsegundos.
    return time.fromisoformat(valor) if valor else None


def _nombre_seccion(grado: str, letra: str) -> str:
    """'1' + 'A' → '1ro A'. Si el grado no es un dígito, se usa tal cual."""
    return f"{ORDINAL_GRADO.get(grado.strip(), grado.strip())} {letra.strip()}".strip()


def _normalizar(texto: str) -> str:
    return " ".join((texto or "").split()).lower()


class Command(BaseCommand):
    help = "Importa el JSON exportado por EduMWork Docente (p_04) al sistema institucional."

    def add_arguments(self, parser):
        parser.add_argument("archivo", help="Ruta del JSON exportado desde EduMWork Docente.")
        parser.add_argument(
            "--docente", required=True,
            help="Username o email del docente YA creado en el institucional.",
        )
        parser.add_argument(
            "--aplicar", action="store_true",
            help="Escribe los cambios. Sin esta bandera solo muestra el preview.",
        )
        parser.add_argument(
            "--anio", type=int, default=None,
            help="Importar solo un año lectivo (por defecto, todos los del archivo).",
        )

    # ── entrada ──────────────────────────────────────────────────────────────

    def handle(self, *args, **opts):
        ruta = Path(opts["archivo"])
        if not ruta.exists():
            raise CommandError(f"No existe el archivo {ruta}")

        try:
            paquete = json.loads(ruta.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise CommandError(f"El archivo no es JSON válido: {e}")

        if paquete.get("formato") != FORMATO_ESPERADO:
            raise CommandError(
                f"Formato inesperado: {paquete.get('formato')!r}. "
                f"Este comando solo lee {FORMATO_ESPERADO!r}."
            )
        if paquete.get("version") not in VERSIONES_SOPORTADAS:
            raise CommandError(
                f"Versión {paquete.get('version')} no soportada (soportadas: "
                f"{VERSIONES_SOPORTADAS}). Actualizá el sistema institucional."
            )

        docente = self._resolver_docente(opts["docente"])
        self.anio_filtro = opts["anio"]
        self.aplicar = opts["aplicar"]
        self.ruta = ruta

        self._encabezado(paquete, docente)

        if self.aplicar:
            with transaction.atomic():
                resumen = self._importar(paquete, docente)
        else:
            # Dry-run real: se ejecuta todo y se deshace, así el preview refleja
            # lo que va a pasar de verdad (incluidos los choques de unicidad).
            with transaction.atomic():
                resumen = self._importar(paquete, docente)
                transaction.set_rollback(True)

        self._reporte(resumen)
        return None

    def _resolver_docente(self, referencia: str) -> Usuario:
        docente = (
            Usuario.objects.filter(username=referencia).first()
            or Usuario.objects.filter(email__iexact=referencia).first()
        )
        if docente is None:
            raise CommandError(
                f"No encontré al usuario {referencia!r}. Creá primero al docente en el "
                f"institucional (Gestión → Usuarios) y volvé a correr el comando."
            )
        if docente.rol != Rol.DOCENTE:
            raise CommandError(
                f"{docente.username} tiene rol {docente.rol!r}, no 'docente'. "
                f"Las clases se asignan a un docente."
            )
        return docente

    # ── importación ──────────────────────────────────────────────────────────

    def _importar(self, paquete: dict, docente: Usuario) -> dict:
        r = {
            "secciones_creadas": 0, "secciones_reusadas": 0,
            "asignaciones_creadas": 0, "asignaciones_reusadas": 0,
            "horarios_creados": 0,
            "estudiantes_creados": 0, "estudiantes_vinculados": 0,
            "matriculas_creadas": 0, "matriculas_reusadas": 0,
            "asistencias_creadas": 0, "asistencias_colapsadas": 0,
            "notas_creadas": 0, "notas_actualizadas": 0,
            "sesiones_no_importadas": 0,
            "avisos": [], "credenciales": [],
        }

        clases = self._clases_en_alcance(paquete, r)
        secciones, asignaciones = self._importar_clases(clases, docente, r)
        estudiantes = self._importar_estudiantes(paquete.get("estudiantes", []), r)
        self._importar_matriculas(paquete.get("matriculas", []), clases, secciones, estudiantes, r)
        self._importar_asistencias(paquete.get("asistencias", []), clases, estudiantes, docente, r)
        self._importar_notas(paquete.get("notas", []), clases, estudiantes, r)
        self._guardar_sesiones(paquete.get("sesiones", []), clases, r)
        return r

    def _clases_en_alcance(self, paquete: dict, r: dict) -> dict:
        """Clases del archivo indexadas por codigo_migracion, filtradas por --anio."""
        clases = {}
        for c in paquete.get("clases", []):
            if self.anio_filtro and c["anio_lectivo"] != self.anio_filtro:
                continue
            if not c.get("grado") or not c.get("seccion_letra"):
                r["avisos"].append(
                    f"Clase {c['nombre']!r} sin grado o sección: no se puede mapear a una "
                    f"Sección institucional. Se omite con todo su contenido."
                )
                continue
            clases[c["codigo_migracion"]] = c
        return clases

    def _importar_clases(self, clases: dict, docente: Usuario, r: dict):
        secciones, asignaciones = {}, {}
        for cod, c in clases.items():
            nivel = c.get("nivel") or ""
            grado, letra = c["grado"].strip(), c["seccion_letra"].strip().upper()

            seccion, creada = Seccion.objects.get_or_create(
                nivel=nivel, grado=grado, letra=letra,
                defaults={"nombre": _nombre_seccion(grado, letra), "owner": None},
            )
            r["secciones_creadas" if creada else "secciones_reusadas"] += 1
            if not seccion.docentes.filter(pk=docente.pk).exists():
                seccion.docentes.add(docente)
            secciones[cod] = seccion

            area = (c.get("curso") or "").strip() or "Sin área"
            asignacion, creada = AsignacionDocente.objects.get_or_create(
                seccion=seccion, area=area, anio_lectivo=c["anio_lectivo"],
                defaults={"docente": docente, "owner": None},
            )
            if not creada and asignacion.docente_id != docente.id:
                r["avisos"].append(
                    f"{seccion} · {area} [{c['anio_lectivo']}] ya estaba asignada a "
                    f"{asignacion.docente.get_full_name() or asignacion.docente.username}. "
                    f"Se respeta la asignación existente."
                )
            r["asignaciones_creadas" if creada else "asignaciones_reusadas"] += 1
            asignaciones[cod] = asignacion

            for h in c.get("horarios", []):
                _, creado = HorarioClase.objects.get_or_create(
                    asignacion=asignacion,
                    dia_semana=h["dia_semana"],
                    hora_inicio=_hora(h["hora_inicio"]),
                    defaults={"hora_fin": _hora(h["hora_fin"]), "aula": h.get("aula", "")},
                )
                r["horarios_creados"] += int(creado)

        return secciones, asignaciones

    def _importar_estudiantes(self, filas: list, r: dict) -> dict:
        estudiantes = {}
        for e in filas:
            cod = e["codigo_migracion"]
            nombre = (e.get("nombre") or "").strip()
            apellidos = (e.get("apellidos") or "").strip()
            dni = (e.get("dni") or "").strip()
            fnac = _fecha(e.get("fecha_nacimiento"))

            est = self._buscar_estudiante(cod, dni, nombre, apellidos, fnac)

            if est is None:
                est = self._crear_estudiante(cod, nombre, apellidos, dni, fnac, e, r)
                r["estudiantes_creados"] += 1
                if not dni and not fnac:
                    r["avisos"].append(
                        f"{apellidos} {nombre}: sin DNI ni fecha de nacimiento, no hubo con qué "
                        f"cotejarlo contra los alumnos ya cargados. Se creó nuevo — "
                        f"revisá que no esté duplicado."
                    )
            else:
                if est.codigo_migracion is None:
                    est.codigo_migracion = uuid.UUID(cod)
                    est.save(update_fields=["codigo_migracion"])
                    r["avisos"].append(
                        f"{apellidos} {nombre}: ya existía en el institucional "
                        f"({'DNI ' + dni if dni else 'coincidencia por nombre'}), se vinculó "
                        f"en vez de duplicar."
                    )
                r["estudiantes_vinculados"] += 1

            estudiantes[cod] = est
        return estudiantes

    def _buscar_estudiante(self, cod, dni, nombre, apellidos, fnac):
        est = Estudiante.objects.filter(codigo_migracion=cod).first()
        if est:
            return est
        if dni:
            est = Estudiante.objects.filter(usuario__dni=dni).first()
            if est:
                return est
        if nombre and apellidos and fnac:
            for cand in Estudiante.objects.filter(fecha_nacimiento=fnac).select_related("usuario"):
                mismo_nombre = _normalizar(cand.usuario.first_name) == _normalizar(nombre)
                mismo_apellido = _normalizar(cand.usuario.last_name) == _normalizar(apellidos)
                if mismo_nombre and mismo_apellido:
                    return cand
        return None

    def _crear_estudiante(self, cod, nombre, apellidos, dni, fnac, origen, r):
        if dni:
            username = f"est_{dni}"
            password = f"{dni[:6]}2026"
        else:
            # Sin DNI no hay convención posible: se usa el UUID de origen.
            username = f"est_mig_{cod[:8]}"
            password = f"{cod[:6]}2026"

        usuario, creado = Usuario.objects.get_or_create(
            username=username,
            defaults={
                "first_name": nombre, "last_name": apellidos,
                "rol": Rol.ESTUDIANTE, "dni": dni or None,
            },
        )
        if creado:
            usuario.set_password(password)
            usuario.debe_cambiar_password = True
            usuario.save(update_fields=["password", "debe_cambiar_password"])
            r["credenciales"].append({
                "nombre": f"{apellidos}, {nombre}".strip(", "),
                "usuario": username, "password": password,
            })

        est, _ = Estudiante.objects.get_or_create(
            usuario=usuario,
            defaults={
                "fecha_nacimiento": fnac,
                "codigo_migracion": uuid.UUID(cod),
                "owner": None,
            },
        )
        if est.codigo_migracion is None:
            est.codigo_migracion = uuid.UUID(cod)
            est.save(update_fields=["codigo_migracion"])

        tutor = (origen.get("tutor_nombre") or "").strip()
        if tutor and not est.contacto_emergencia_nombre:
            est.contacto_emergencia_nombre = tutor
            est.contacto_emergencia_telefono = (origen.get("tutor_celular") or "").strip()
            est.save(update_fields=[
                "contacto_emergencia_nombre", "contacto_emergencia_telefono",
            ])
        return est

    def _importar_matriculas(self, filas, clases, secciones, estudiantes, r):
        for m in filas:
            clase = clases.get(m["clase"])
            est = estudiantes.get(m["estudiante"])
            if clase is None or est is None:
                continue

            seccion = secciones[m["clase"]]
            anio = clase["anio_lectivo"]

            matricula = Matricula.objects.filter(estudiante=est, anio_lectivo=anio).first()
            if matricula is None:
                Matricula.objects.create(
                    estudiante=est, seccion=seccion, anio_lectivo=anio,
                )
                r["matriculas_creadas"] += 1
                # Caché legible que usa el resto del sistema.
                est.grado, est.seccion = seccion.grado, seccion.letra
                est.save(update_fields=["grado", "seccion"])
            else:
                r["matriculas_reusadas"] += 1
                if matricula.seccion_id and matricula.seccion_id != seccion.id:
                    r["avisos"].append(
                        f"{est.usuario.get_full_name()} ya está matriculado en "
                        f"{matricula.seccion} para {anio}; el docente lo tenía además en "
                        f"{seccion}. Se mantiene la matrícula existente."
                    )
                elif matricula.seccion_id is None:
                    matricula.seccion = seccion
                    matricula.save(update_fields=["seccion"])

    def _importar_asistencias(self, filas, clases, estudiantes, docente, r):
        # Colapsar: p_04 guarda una por clase y día, p_03 una por día.
        por_dia: dict[tuple, dict] = {}
        for a in filas:
            if a["clase"] not in clases or a["estudiante"] not in estudiantes:
                continue
            clave = (a["estudiante"], a["fecha"])
            previo = por_dia.get(clave)
            if previo is None:
                por_dia[clave] = a
                continue
            r["asistencias_colapsadas"] += 1
            if PRIORIDAD_ASISTENCIA.get(a["estado"], 0) > PRIORIDAD_ASISTENCIA.get(previo["estado"], 0):
                por_dia[clave] = a

        for (cod_est, fecha), a in por_dia.items():
            _, creado = RegistroAsistencia.objects.get_or_create(
                estudiante=estudiantes[cod_est],
                fecha=_fecha(fecha),
                defaults={
                    "estado": a["estado"],
                    "hora_llegada": _hora(a.get("hora_llegada")),
                    "justificacion": a.get("justificacion", ""),
                    # `marcado_por` es obligatorio: la marcó el docente que migra.
                    "marcado_por": docente,
                },
            )
            r["asistencias_creadas"] += int(creado)

    def _importar_notas(self, filas, clases, estudiantes, r):
        for n in filas:
            clase = clases.get(n["clase"])
            est = estudiantes.get(n["estudiante"])
            if clase is None or est is None:
                continue

            area = (clase.get("curso") or "").strip() or "Sin área"
            nota, creada = NotaBimestre.objects.get_or_create(
                estudiante=est,
                anio_lectivo=n["anio_lectivo"],
                area=area,
                bimestre=n["bimestre"],
                competencia=n["competencia"],
                defaults={
                    "calificacion": n.get("calificacion") or "",
                    "calificacion_numerica": n.get("calificacion_numerica"),
                    "conclusion_descriptiva": n.get("conclusion_descriptiva") or "",
                    "observaciones": n.get("observaciones") or "",
                    "owner": None,
                },
            )
            if creada:
                r["notas_creadas"] += 1
            elif not nota.calificacion and n.get("calificacion"):
                # Solo rellena vacíos: nunca pisa una nota puesta en el institucional.
                nota.calificacion = n["calificacion"]
                nota.conclusion_descriptiva = n.get("conclusion_descriptiva") or ""
                nota.save(update_fields=["calificacion", "conclusion_descriptiva"])
                r["notas_actualizadas"] += 1

    def _guardar_sesiones(self, filas, clases, r):
        sesiones = [s for s in filas if s["clase"] in clases]
        r["sesiones_no_importadas"] = len(sesiones)
        if not sesiones or not self.aplicar:
            return
        destino = self.ruta.with_suffix(".sesiones.json")
        destino.write_text(
            json.dumps(sesiones, ensure_ascii=False, indent=2), encoding="utf-8",
        )
        r["archivo_sesiones"] = str(destino)

    # ── salida ───────────────────────────────────────────────────────────────

    def _encabezado(self, paquete, docente):
        origen = paquete.get("origen", {})
        d = paquete.get("docente", {})
        modo = "APLICANDO CAMBIOS" if self.aplicar else "PREVIEW (no escribe nada)"
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING(f"Importar docente — {modo}"))
        self.stdout.write(f"  Origen        : {origen.get('tenant_slug')} ({origen.get('producto')})")
        self.stdout.write(f"  Generado      : {paquete.get('generado_en', '?')[:19]}")
        self.stdout.write(f"  Docente en p_04: {d.get('nombre','')} {d.get('apellidos','')} <{d.get('email','')}>")
        self.stdout.write(f"  Docente destino: {docente.get_full_name() or docente.username} ({docente.username})")
        if self.anio_filtro:
            self.stdout.write(f"  Filtro de año : {self.anio_filtro}")
        self.stdout.write(f"  Contenido     : {paquete.get('resumen', {})}")
        self.stdout.write("")

    def _reporte(self, r):
        filas = [
            ("Secciones", r["secciones_creadas"], r["secciones_reusadas"]),
            ("Asignaciones", r["asignaciones_creadas"], r["asignaciones_reusadas"]),
            ("Estudiantes", r["estudiantes_creados"], r["estudiantes_vinculados"]),
            ("Matrículas", r["matriculas_creadas"], r["matriculas_reusadas"]),
            ("Notas", r["notas_creadas"], r["notas_actualizadas"]),
        ]
        self.stdout.write(self.style.MIGRATE_LABEL("  Resultado"))
        self.stdout.write(f"    {'':<15}{'nuevos':>8}{'existentes':>12}")
        for etiqueta, nuevos, existentes in filas:
            self.stdout.write(f"    {etiqueta:<15}{nuevos:>8}{existentes:>12}")
        self.stdout.write(f"    {'Horarios':<15}{r['horarios_creados']:>8}")
        self.stdout.write(f"    {'Asistencias':<15}{r['asistencias_creadas']:>8}"
                          f"   ({r['asistencias_colapsadas']} colapsadas por día)")

        if r["sesiones_no_importadas"]:
            self.stdout.write("")
            destino = r.get("archivo_sesiones")
            self.stdout.write(self.style.WARNING(
                f"  {r['sesiones_no_importadas']} sesiones de aprendizaje NO se importaron: "
                f"el institucional todavía no las persiste."
            ))
            self.stdout.write(
                f"    Guardadas en {destino}" if destino
                else "    Con --aplicar se guardan en un .sesiones.json junto al archivo."
            )

        if r["credenciales"]:
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_LABEL(
                f"  Credenciales de los {len(r['credenciales'])} estudiantes nuevos"
            ))
            for c in r["credenciales"][:5]:
                self.stdout.write(f"    {c['nombre']:<35} {c['usuario']:<18} {c['password']}")
            if len(r["credenciales"]) > 5:
                self.stdout.write(f"    … y {len(r['credenciales']) - 5} más.")
            self.stdout.write("    Todos entran con `debe_cambiar_password`.")

        if r["avisos"]:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING(f"  Avisos ({len(r['avisos'])})"))
            for aviso in r["avisos"]:
                self.stdout.write(f"    · {aviso}")

        self.stdout.write("")
        if self.aplicar:
            self.stdout.write(self.style.SUCCESS("  Importación aplicada."))
        else:
            self.stdout.write(self.style.WARNING(
                "  Nada de esto se guardó. Repetí el comando con --aplicar para escribirlo."
            ))
        self.stdout.write("")
