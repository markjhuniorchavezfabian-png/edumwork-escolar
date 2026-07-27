"""
Checklist de matrícula según Instructivo de Matrícula EBR 2025.
Valida completitud de datos requeridos por MINEDU para cada estudiante.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Estudiante


# Requisitos según Instructivo Matrícula EBR 2025
REQUISITOS = {
    "dni": {
        "label": "DNI del estudiante",
        "critico": True,
        "check": lambda e: bool(e.usuario.dni and len(e.usuario.dni) == 8),
    },
    "nombres": {
        "label": "Nombres y apellidos completos",
        "critico": True,
        "check": lambda e: bool(e.usuario.first_name and e.usuario.last_name),
    },
    "fecha_nacimiento": {
        "label": "Fecha de nacimiento",
        "critico": True,
        "check": lambda e: bool(e.fecha_nacimiento),
    },
    "sexo": {
        "label": "Sexo",
        "critico": True,
        "check": lambda e: bool(e.sexo),
    },
    "seccion_asignada": {
        "label": "Sección asignada",
        "critico": True,
        "check": lambda e: e.seccion_obj_id is not None,
    },
    "codigo_matricula": {
        "label": "Código de matrícula",
        "critico": True,
        "check": lambda e: bool(e.codigo_matricula),
    },
    "direccion": {
        "label": "Dirección",
        "critico": False,
        "check": lambda e: bool(e.direccion),
    },
    "lengua_materna": {
        "label": "Lengua materna",
        "critico": False,
        "check": lambda e: bool(e.lengua_materna),
    },
    "grupo_sanguineo": {
        "label": "Grupo sanguíneo",
        "critico": False,
        "check": lambda e: bool(e.grupo_sanguineo and e.grupo_sanguineo != "NS"),
    },
    "apoderado_registrado": {
        "label": "Apoderado / padre registrado",
        "critico": True,
        "check": lambda e: e.padres.exists() if hasattr(e, "padres") else False,
    },
    "telefono_emergencia": {
        "label": "Teléfono de emergencia",
        "critico": True,
        "check": lambda e: bool(getattr(e, "telefono_emergencia", "") or e.usuario.telefono),
    },
}


def _evaluar_estudiante(est):
    resultados = []
    faltantes_criticos = 0
    for key, req in REQUISITOS.items():
        try:
            ok = req["check"](est)
        except Exception:
            ok = False
        resultados.append({
            "campo": key,
            "label": req["label"],
            "critico": req["critico"],
            "ok": ok,
        })
        if not ok and req["critico"]:
            faltantes_criticos += 1
    total = len(REQUISITOS)
    completos = sum(1 for r in resultados if r["ok"])
    completitud = round((completos / total) * 100)
    valido = faltantes_criticos == 0
    return {
        "estudiante_id": est.pk,
        "nombre": est.usuario.get_full_name() or est.usuario.username,
        "seccion": f"{est.grado} {est.seccion}" if est.grado else "(sin sección)",
        "completitud_pct": completitud,
        "matricula_valida": valido,  # todos los críticos OK
        "faltantes_criticos": faltantes_criticos,
        "checklist": resultados,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def checklist_estudiante(request, estudiante_id):
    """Checklist detallado de un estudiante."""
    try:
        est = Estudiante.objects.select_related("usuario", "seccion_obj").get(pk=estudiante_id)
    except Estudiante.DoesNotExist:
        return Response({"error": "Estudiante no encontrado"}, status=404)
    return Response(_evaluar_estudiante(est))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def reporte_cumplimiento_matricula(request):
    """Reporte agregado para el director: cuántos estudiantes tienen matrícula
    válida (todos los críticos OK) según Instructivo Matrícula EBR 2025.

    Query opcional: ?seccion=X (filtrar por sección)
    """
    if request.user.rol not in ("director", "subdirector", "admin_tic", "secretaria"):
        return Response({"error": "Solo director/admin_tic/secretaria."}, status=403)

    qs = Estudiante.objects.select_related("usuario", "seccion_obj")
    seccion_id = request.GET.get("seccion")
    if seccion_id:
        qs = qs.filter(seccion_obj_id=seccion_id)

    validos = 0
    invalidos = []
    for est in qs:
        r = _evaluar_estudiante(est)
        if r["matricula_valida"]:
            validos += 1
        else:
            invalidos.append({
                "estudiante_id": r["estudiante_id"],
                "nombre": r["nombre"],
                "seccion": r["seccion"],
                "completitud_pct": r["completitud_pct"],
                "faltantes_criticos": r["faltantes_criticos"],
                "faltantes_labels": [c["label"] for c in r["checklist"] if not c["ok"] and c["critico"]],
            })

    total = qs.count()
    return Response({
        "norma": "Instructivo de Matrícula EBR 2025 · RM 556-2024-MINEDU",
        "total_estudiantes": total,
        "matriculas_validas": validos,
        "matriculas_invalidas": len(invalidos),
        "pct_cumplimiento": round((validos / total * 100) if total > 0 else 0, 1),
        "invalidos": invalidos[:100],  # cap por respuesta
    })
