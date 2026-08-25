from datetime import date, timedelta

from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AnioEscolar, DiaCalendario, TipoDia
from .serializers import AnioEscolarSerializer, DiaCalendarioSerializer


class DiaCalendarioViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = DiaCalendario.objects.all()
    serializer_class = DiaCalendarioSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        anio = self.request.query_params.get("anio")
        tipo = self.request.query_params.get("tipo")
        if anio:
            qs = qs.filter(anio_lectivo=anio)
        if tipo:
            qs = qs.filter(tipo=tipo)
        return qs


class AnioEscolarViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AnioEscolar.objects.all()
    serializer_class = AnioEscolarSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kpi_cumplimiento(request):
    """Verifica cumplimiento RM 556-2024: mínimo 160 días lectivos + 30 días gestión."""
    anio = int(request.GET.get("anio", date.today().year))

    ae = AnioEscolar.objects.filter(anio=anio).first()
    if not ae:
        return Response({
            "anio": anio,
            "cumple_norma": False,
            "detalle": f"No hay año escolar definido para {anio}",
            "dias_lectivos_actuales": 0,
            "dias_gestion_actuales": 0,
            "minimo_lectivos": 160,
            "minimo_gestion": 30,
        })

    # Iterar todos los días entre inicio y fin
    dias = {}
    d = ae.fecha_inicio
    while d <= ae.fecha_fin:
        # Excluir sábados (5) y domingos (6) por defecto — no lectivos
        if d.weekday() < 5:
            dias[d] = "lectivo"
        d += timedelta(days=1)

    # Aplicar días especiales
    especiales = DiaCalendario.objects.filter(anio_lectivo=anio)
    for e in especiales:
        dias[e.fecha] = e.tipo

    counts = {"lectivo": 0, "gestion": 0, "feriado": 0, "otro": 0}
    for _, tipo in dias.items():
        if tipo == TipoDia.LECTIVO:
            counts["lectivo"] += 1
        elif tipo == TipoDia.GESTION:
            counts["gestion"] += 1
        elif tipo in (TipoDia.FERIADO_NACIONAL, TipoDia.FERIADO_REGIONAL, TipoDia.FERIADO_LOCAL):
            counts["feriado"] += 1
        else:
            counts["otro"] += 1

    cumple = counts["lectivo"] >= 160 and counts["gestion"] >= 30

    return Response({
        "anio": anio,
        "cumple_norma": cumple,
        "detalle": (
            f"RM 556-2024-MINEDU exige mínimo 160 días lectivos + 30 días de gestión. "
            f"Tienes {counts['lectivo']} lectivos + {counts['gestion']} gestión."
        ),
        "dias_lectivos_actuales": counts["lectivo"],
        "dias_gestion_actuales": counts["gestion"],
        "dias_feriado": counts["feriado"],
        "dias_no_laborables_otros": counts["otro"],
        "minimo_lectivos": 160,
        "minimo_gestion": 30,
        "fecha_inicio": ae.fecha_inicio,
        "fecha_fin": ae.fecha_fin,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def calendario_completo(request):
    """Devuelve el calendario del año con TODOS los días marcados por tipo,
    para renderizar la vista calendario del frontend."""
    anio = int(request.GET.get("anio", date.today().year))
    ae = AnioEscolar.objects.filter(anio=anio).first()
    if not ae:
        return Response({"anio": anio, "dias": [], "error": "Año escolar no definido"})

    especiales = {e.fecha: e for e in DiaCalendario.objects.filter(anio_lectivo=anio)}

    resultado = []
    d = ae.fecha_inicio
    while d <= ae.fecha_fin:
        if d in especiales:
            e = especiales[d]
            resultado.append({
                "fecha": d.isoformat(),
                "tipo": e.tipo,
                "descripcion": e.descripcion,
            })
        elif d.weekday() >= 5:
            resultado.append({
                "fecha": d.isoformat(),
                "tipo": "fin_semana",
                "descripcion": "Sábado" if d.weekday() == 5 else "Domingo",
            })
        else:
            resultado.append({
                "fecha": d.isoformat(),
                "tipo": TipoDia.LECTIVO,
                "descripcion": "",
            })
        d += timedelta(days=1)

    return Response({
        "anio": anio,
        "fecha_inicio": ae.fecha_inicio,
        "fecha_fin": ae.fecha_fin,
        "norma": ae.norma_referencia,
        "dias": resultado,
    })
