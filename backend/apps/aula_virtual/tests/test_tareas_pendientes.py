import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.aula_virtual.models import Curso, Tarea
from apps.usuarios.models import Estudiante, Matricula, Rol, Seccion, Usuario


@pytest.mark.django_db
def test_estudiante_lista_tareas_pendientes_publicadas_de_su_seccion():
    seccion = Seccion.objects.create(nombre="1ro A", grado="1ro", letra="A", nivel="primaria")
    docente = Usuario.objects.create_user(username="doc_aula", password="p", rol=Rol.DOCENTE)
    alumno_user = Usuario.objects.create_user(username="alu_aula", password="p", rol=Rol.ESTUDIANTE)
    alumno = Estudiante.objects.create(usuario=alumno_user, grado="1ro", seccion="A")
    Matricula.objects.create(estudiante=alumno, seccion=seccion, anio_lectivo=2026, situacion="matriculado")
    curso = Curso.objects.create(titulo="Matemática", docente=docente, area="Matemática")
    curso.secciones.add(seccion)
    tarea = Tarea.objects.create(
        curso=curso,
        titulo="Resolver ejercicios",
        descripcion="Resolver página 10.",
        fecha_entrega=timezone.now() + timezone.timedelta(days=2),
        publicada=True,
    )
    Tarea.objects.create(
        curso=curso,
        titulo="Borrador oculto",
        descripcion="No visible.",
        fecha_entrega=timezone.now() + timezone.timedelta(days=3),
        publicada=False,
    )

    client = APIClient()
    client.force_authenticate(alumno_user)
    resp = client.get("/api/aula-virtual/tareas/pendientes/")

    assert resp.status_code == 200
    assert [item["id"] for item in resp.data] == [tarea.id]
