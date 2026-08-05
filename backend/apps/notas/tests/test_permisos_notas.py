import pytest
from rest_framework.test import APIClient

from apps.notas.models import NotaBimestre
from apps.usuarios.models import Estudiante, Matricula, Rol, Seccion, Usuario


@pytest.mark.django_db
def test_director_no_puede_eliminar_nota_por_api_normal():
    seccion = Seccion.objects.create(nombre="1ro A", grado="1ro", letra="A", nivel="primaria")
    director = Usuario.objects.create_user(username="dir_notas", password="p", rol=Rol.DIRECTOR)
    estudiante_user = Usuario.objects.create_user(
        username="est_notas", password="p", rol=Rol.ESTUDIANTE, first_name="Ana", last_name="Perez"
    )
    estudiante = Estudiante.objects.create(usuario=estudiante_user, grado="1ro", seccion="A")
    Matricula.objects.create(estudiante=estudiante, seccion=seccion, anio_lectivo=2026, situacion="matriculado")
    nota = NotaBimestre.objects.create(
        estudiante=estudiante,
        anio_lectivo=2026,
        area="Comunicación",
        bimestre="1",
        competencia=1,
        calificacion="A",
        conclusion_descriptiva="Logro esperado con avance sostenido.",
    )

    client = APIClient()
    client.force_authenticate(director)
    resp = client.delete(f"/api/notas/{nota.id}/")

    assert resp.status_code == 403
    assert NotaBimestre.objects.filter(pk=nota.pk).exists()
