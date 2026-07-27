from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.usuarios.models import Rol

from .models import Auditoria
from .serializers import AuditoriaSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_auditoria(request):
    """Listado paginado de la bitácora.
    - Director / Admin TIC: ven todo.
    - Docente: solo cambios en notas de sus estudiantes (para saber si el director modificó algo).
    Filtros: ?modelo=Incidencia&objeto_id=42&tipo=actualizar&usuario=director"""

    if request.user.rol == "docente":
        # Docente ve solo registros de NotaBimestre que afectan a sus estudiantes
        from apps.notas.models import AsignacionDocente, NotaBimestre
        from apps.core.models import ConfiguracionInstitucional
        anio = ConfiguracionInstitucional.get_solo().anio_lectivo_activo or 2026
        secciones_ids = AsignacionDocente.objects.filter(
            docente=request.user, anio_lectivo=anio
        ).values_list("seccion_id", flat=True)
        notas_ids = NotaBimestre.objects.filter(
            estudiante__seccion_obj_id__in=secciones_ids, anio_lectivo=anio
        ).values_list("id", flat=True)
        qs = Auditoria.objects.filter(
            modelo="NotaBimestre",
            objeto_id__in=[str(i) for i in notas_ids],
        )
        paginator = PageNumberPagination()
        paginator.page_size = 50
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AuditoriaSerializer(page, many=True).data)

    if request.user.rol not in (Rol.DIRECTOR, Rol.ADMIN_TIC, "subdirector"):
        raise PermissionDenied("Sin acceso a la auditoría.")

    qs = Auditoria.objects.all()
    modelo = request.GET.get("modelo")
    objeto_id = request.GET.get("objeto_id")
    tipo = request.GET.get("tipo")
    usuario = request.GET.get("usuario")
    if modelo:
        qs = qs.filter(modelo=modelo)
    if objeto_id:
        qs = qs.filter(objeto_id=objeto_id)
    if tipo:
        qs = qs.filter(tipo=tipo)
    if usuario:
        qs = qs.filter(usuario_username__icontains=usuario)

    paginator = PageNumberPagination()
    paginator.page_size = 30
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response(AuditoriaSerializer(page, many=True).data)
