"""Importación de un docente que venía de EduMWork Docente (p_04).

El fixture `fixtures/export_docente_v1.json` es un **export real** generado por
`GET /api/migracion/exportar/` de p_04, recortado a 2 estudiantes. Si p_04
cambia el formato sin subir la versión, estos tests se caen: esa es la idea.
"""
import json
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.asistencia.models import RegistroAsistencia
from apps.notas.models import AsignacionDocente, HorarioClase, NotaBimestre
from apps.usuarios.models import Estudiante, Matricula, Rol, Seccion, Usuario

FIXTURE = Path(__file__).parent / "fixtures" / "export_docente_v1.json"


@pytest.fixture
def docente(db):
    return Usuario.objects.create_user(
        username="ana", password="x", rol=Rol.DOCENTE,
        first_name="Ana", last_name="García",
    )


@pytest.fixture
def archivo(tmp_path):
    """Copia del fixture en tmp, para que el .sesiones.json no ensucie el repo."""
    destino = tmp_path / "export.json"
    destino.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")
    return destino


def _importar(archivo, docente="ana", **kwargs):
    salida = StringIO()
    call_command("importar_docente", str(archivo), docente=docente, stdout=salida, **kwargs)
    return salida.getvalue()


def _editar(archivo: Path, fn):
    datos = json.loads(archivo.read_text(encoding="utf-8"))
    fn(datos)
    archivo.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")


# ── camino feliz ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_importa_todo_el_paquete(docente, archivo):
    _importar(archivo, aplicar=True)

    seccion = Seccion.objects.get(grado="1", letra="A", nivel="secundaria")
    assert seccion.nombre == "1ro A"
    assert docente in seccion.docentes.all()
    assert seccion.owner is None, "la sección importada es institucional, no personal"

    asignacion = AsignacionDocente.objects.get(seccion=seccion, area="Comunicación")
    assert asignacion.docente == docente
    assert asignacion.anio_lectivo == 2026
    assert HorarioClase.objects.filter(asignacion=asignacion, dia_semana="lun").exists()

    assert Estudiante.objects.count() == 2
    assert Matricula.objects.filter(seccion=seccion, anio_lectivo=2026).count() == 2
    assert NotaBimestre.objects.filter(area="Comunicación").count() == 4
    assert RegistroAsistencia.objects.count() == 6

    est = Estudiante.objects.get(usuario__dni="70000011")
    assert est.codigo_migracion is not None
    assert est.usuario.username == "est_70000011"
    assert est.usuario.rol == Rol.ESTUDIANTE
    assert est.usuario.debe_cambiar_password
    assert est.grado == "1" and est.seccion == "A"


@pytest.mark.django_db
def test_reimportar_no_duplica(docente, archivo):
    _importar(archivo, aplicar=True)
    salida = _importar(archivo, aplicar=True)

    assert Estudiante.objects.count() == 2
    assert Seccion.objects.count() == 1
    assert AsignacionDocente.objects.count() == 1
    assert Matricula.objects.count() == 2
    assert NotaBimestre.objects.count() == 4
    assert RegistroAsistencia.objects.count() == 6
    assert "Estudiantes           0           2" in salida


@pytest.mark.django_db
def test_preview_no_escribe_nada(docente, archivo):
    salida = _importar(archivo)  # sin --aplicar

    assert Estudiante.objects.count() == 0
    assert Seccion.objects.count() == 0
    assert RegistroAsistencia.objects.count() == 0
    assert "PREVIEW" in salida
    assert "Nada de esto se guardó" in salida
    # El preview igual reporta lo que haría.
    assert "Estudiantes           2           0" in salida


# ── deduplicación contra lo que ya tiene el colegio ──────────────────────────

@pytest.mark.django_db
def test_vincula_estudiante_que_ya_existe_por_dni(docente, archivo):
    """La secretaría ya lo había cargado: se vincula, no se duplica."""
    usuario = Usuario.objects.create_user(
        username="est_70000011", password="x", rol=Rol.ESTUDIANTE,
        first_name="Luis", last_name="Chávez", dni="70000011",
    )
    existente = Estudiante.objects.create(usuario=usuario)

    salida = _importar(archivo, aplicar=True)

    assert Estudiante.objects.count() == 2, "no debe crear un tercero"
    existente.refresh_from_db()
    assert existente.codigo_migracion is not None
    assert "se vinculó" in salida


@pytest.mark.django_db
def test_vincula_por_nombre_y_fecha_de_nacimiento_si_no_hay_dni(docente, archivo):
    _editar(archivo, lambda d: d["estudiantes"][0].update(
        dni="", fecha_nacimiento="2012-04-18",
    ))
    e = json.loads(archivo.read_text(encoding="utf-8"))["estudiantes"][0]

    usuario = Usuario.objects.create_user(
        username="est_viejo", password="x", rol=Rol.ESTUDIANTE,
        first_name=e["nombre"], last_name=e["apellidos"],
    )
    Estudiante.objects.create(usuario=usuario, fecha_nacimiento="2012-04-18")

    _importar(archivo, aplicar=True)
    assert Estudiante.objects.count() == 2


@pytest.mark.django_db
def test_avisa_cuando_un_alumno_no_se_puede_cotejar(docente, archivo):
    """Sin DNI ni fecha de nacimiento no hay forma de saber si ya existe.
    Se crea igual —mejor un duplicado que fusionar a dos chicos distintos—
    pero el aviso le dice a la secretaría dónde mirar."""
    _editar(archivo, lambda d: d["estudiantes"][0].update(dni="", fecha_nacimiento=None))

    salida = _importar(archivo, aplicar=True)

    assert "sin DNI ni fecha de nacimiento" in salida
    assert "revisá que no esté duplicado" in salida


@pytest.mark.django_db
def test_estudiante_sin_dni_se_crea_con_usuario_derivado_del_uuid(docente, archivo):
    _editar(archivo, lambda d: [e.update(dni="") for e in d["estudiantes"]])

    _importar(archivo, aplicar=True)

    assert Estudiante.objects.count() == 2
    assert Usuario.objects.filter(username__startswith="est_mig_").count() == 2


# ── las dos asimetrías entre productos ───────────────────────────────────────

@pytest.mark.django_db
def test_asistencia_de_dos_clases_el_mismo_dia_se_colapsa_a_una(docente, archivo):
    """p_04 guarda una por clase y día; p_03 una por día. Gana la presencia real."""
    def dos_clases(d):
        clase_b = dict(d["clases"][0])
        clase_b["codigo_migracion"] = "11111111-1111-1111-1111-111111111111"
        clase_b["curso"] = "Matemática"
        clase_b["horarios"] = []
        d["clases"].append(clase_b)

        est = d["estudiantes"][0]["codigo_migracion"]
        d["asistencias"] = [
            {"clase": d["clases"][0]["codigo_migracion"], "estudiante": est,
             "fecha": "2026-03-10", "estado": "ausente",
             "hora_llegada": None, "justificacion": ""},
            {"clase": clase_b["codigo_migracion"], "estudiante": est,
             "fecha": "2026-03-10", "estado": "presente",
             "hora_llegada": "08:00:00", "justificacion": ""},
        ]
    _editar(archivo, dos_clases)

    salida = _importar(archivo, aplicar=True)

    registros = RegistroAsistencia.objects.filter(fecha="2026-03-10")
    assert registros.count() == 1
    assert registros.first().estado == "presente", "asistió a una clase: el día cuenta"
    assert "1 colapsadas por día" in salida


@pytest.mark.django_db
def test_sesiones_no_se_pierden_aunque_no_haya_donde_importarlas(docente, archivo):
    salida = _importar(archivo, aplicar=True)

    sidecar = archivo.with_suffix(".sesiones.json")
    assert sidecar.exists()
    assert len(json.loads(sidecar.read_text(encoding="utf-8"))) == 1
    assert "NO se importaron" in salida


# ── validaciones y casos borde ───────────────────────────────────────────────

@pytest.mark.django_db
def test_clase_sin_grado_se_omite_con_aviso(docente, archivo):
    _editar(archivo, lambda d: d["clases"][0].update(grado="", seccion_letra=""))

    salida = _importar(archivo, aplicar=True)

    assert Seccion.objects.count() == 0
    assert Matricula.objects.count() == 0
    assert NotaBimestre.objects.count() == 0
    assert "no se puede mapear" in salida


@pytest.mark.django_db
def test_filtro_por_anio_lectivo(docente, archivo):
    _editar(archivo, lambda d: d["clases"][0].update(anio_lectivo=2025))

    _importar(archivo, aplicar=True, anio=2026)
    assert Seccion.objects.count() == 0

    _importar(archivo, aplicar=True, anio=2025)
    assert Seccion.objects.count() == 1


@pytest.mark.django_db
def test_no_pisa_una_nota_ya_puesta_en_el_institucional(docente, archivo):
    _importar(archivo, aplicar=True)
    nota = NotaBimestre.objects.first()
    nota.calificacion = "AD"
    nota.save(update_fields=["calificacion"])

    _importar(archivo, aplicar=True)

    nota.refresh_from_db()
    assert nota.calificacion == "AD"


@pytest.mark.django_db
def test_respeta_una_asignacion_que_ya_tiene_otro_docente(docente, archivo):
    otro = Usuario.objects.create_user(username="beto", password="x", rol=Rol.DOCENTE)
    seccion = Seccion.objects.create(nivel="secundaria", grado="1", letra="A", nombre="1ro A")
    AsignacionDocente.objects.create(
        seccion=seccion, area="Comunicación", anio_lectivo=2026, docente=otro,
    )

    salida = _importar(archivo, aplicar=True)

    assert AsignacionDocente.objects.get(seccion=seccion, area="Comunicación").docente == otro
    assert "Se respeta la asignación existente" in salida


@pytest.mark.django_db
def test_rechaza_formato_desconocido(docente, archivo):
    _editar(archivo, lambda d: d.update(formato="otra.cosa"))
    with pytest.raises(CommandError, match="Formato inesperado"):
        _importar(archivo, aplicar=True)


@pytest.mark.django_db
def test_rechaza_version_futura(docente, archivo):
    _editar(archivo, lambda d: d.update(version=99))
    with pytest.raises(CommandError, match="no soportada"):
        _importar(archivo, aplicar=True)


@pytest.mark.django_db
def test_exige_que_el_docente_exista(db, archivo):
    with pytest.raises(CommandError, match="No encontré al usuario"):
        _importar(archivo, docente="fantasma", aplicar=True)


@pytest.mark.django_db
def test_rechaza_un_usuario_que_no_es_docente(db, archivo):
    Usuario.objects.create_user(username="dire", password="x", rol=Rol.DIRECTOR)
    with pytest.raises(CommandError, match="no 'docente'"):
        _importar(archivo, docente="dire", aplicar=True)


@pytest.mark.django_db
def test_acepta_al_docente_por_email(db, archivo):
    Usuario.objects.create_user(
        username="ana2", password="x", rol=Rol.DOCENTE, email="ana@colegio.pe",
    )
    _importar(archivo, docente="ana@colegio.pe", aplicar=True)
    assert AsignacionDocente.objects.first().docente.username == "ana2"


# ── v2: el área viene explícita en cada nota ─────────────────────────────────


@pytest.mark.django_db
def test_acepta_un_paquete_v2(docente, archivo):
    _editar(archivo, lambda d: d.update(version=2))

    salida = _importar(archivo, aplicar=True)

    assert NotaBimestre.objects.exists(), salida


@pytest.mark.django_db
def test_v2_respeta_el_area_de_cada_nota_en_vez_de_deducirla_del_curso(docente, archivo):
    """El caso que motivó la v2: un docente de aula de primaria califica varias
    áreas en la misma sección. Deducir el área del curso de la clase las
    fusionaba todas en una y le destruía media libreta."""
    def a_v2(datos):
        datos["version"] = 2
        base = datos["notas"][0]
        datos["notas"] = [
            {**base, "area": "Matemática", "competencia": 1, "calificacion": "AD"},
            {**base, "area": "Personal Social", "competencia": 1, "calificacion": "C"},
        ]

    _editar(archivo, a_v2)

    _importar(archivo, aplicar=True)

    guardadas = {n.area: n.calificacion for n in NotaBimestre.objects.all()}
    assert guardadas == {"Matemática": "AD", "Personal Social": "C"}


@pytest.mark.django_db
def test_un_paquete_v1_sigue_deduciendo_el_area_del_curso(docente, archivo):
    """Un docente pudo exportar antes del cambio; ese archivo tiene que seguir
    entrando igual."""
    _importar(archivo, aplicar=True)

    assert NotaBimestre.objects.exclude(area="Sin área").exists()
