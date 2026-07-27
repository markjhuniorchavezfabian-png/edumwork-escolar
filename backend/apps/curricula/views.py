from django.db.models import Prefetch
from django.db import transaction
from rest_framework import mixins, viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AreaCurricular, Capacidad, Competencia, Desempeno
from .serializers import (
    AreaResumenSerializer,
    AreaSerializer,
    CapacidadSerializer,
    CompetenciaSerializer,
)


class AreaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    queryset = AreaCurricular.objects.prefetch_related(
        "competencias__capacidades",
        "competencias__desempenos",
    )

    def get_serializer_class(self):
        if self.action == "list":
            return AreaResumenSerializer
        return AreaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        nivel = self.request.query_params.get("nivel")
        if nivel:
            qs = qs.filter(nivel=nivel)
        return qs


class CompetenciaViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated]
    serializer_class = CompetenciaSerializer

    def get_queryset(self):
        grado = self.request.query_params.get("grado")
        des_qs = Desempeno.objects.order_by("orden")
        if grado:
            des_qs = des_qs.filter(grado=grado)
        qs = Competencia.objects.select_related("area").prefetch_related(
            "capacidades",
            Prefetch("desempenos", queryset=des_qs),
        )
        area_id = self.request.query_params.get("area")
        nivel = self.request.query_params.get("nivel")
        area_nombre = self.request.query_params.get("area_nombre")
        if area_id:
            qs = qs.filter(area_id=area_id)
        if nivel:
            qs = qs.filter(area__nivel=nivel)
        if area_nombre:
            qs = qs.filter(area__nombre__iexact=area_nombre)
        return qs


class CapacidadViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated]
    serializer_class = CapacidadSerializer
    queryset = Capacidad.objects.select_related("competencia__area")

    def get_queryset(self):
        qs = super().get_queryset()
        competencia_id = self.request.query_params.get("competencia")
        if competencia_id:
            qs = qs.filter(competencia_id=competencia_id)
        return qs


class DesempenoViewSet(
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Editar la descripción de los desempeños del CNEB. Solo director/admin_tic."""
    permission_classes = [IsAuthenticated]
    queryset = Desempeno.objects.select_related("competencia__area")

    def get_serializer_class(self):
        from .serializers import DesempenoSerializer
        return DesempenoSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        grado = self.request.query_params.get("grado")
        competencia = self.request.query_params.get("competencia")
        area = self.request.query_params.get("area")
        nivel = self.request.query_params.get("nivel")
        if grado:
            qs = qs.filter(grado=grado)
        if competencia:
            qs = qs.filter(competencia_id=competencia)
        if area:
            qs = qs.filter(competencia__area__nombre__iexact=area)
        if nivel:
            qs = qs.filter(competencia__area__nivel=nivel)
        return qs.order_by("competencia__numero", "orden")

    def update(self, request, *args, **kwargs):
        rol = getattr(request.user, "rol", None)
        if rol not in ("director", "subdirector", "admin_tic"):
            from rest_framework.response import Response
            return Response({"error": "Solo director o admin TIC pueden editar."}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        rol = getattr(request.user, "rol", None)
        if rol not in ("director", "subdirector", "admin_tic"):
            return Response({"error": "Solo director o admin TIC pueden editar."}, status=403)
        return super().partial_update(request, *args, **kwargs)


class ImportarCNEBView(APIView):
    """
    POST /api/curricula/importar/
    Recibe un JSON con la estructura del CNEB y hace upsert completo.
    Solo director o admin_tic pueden usar este endpoint.

    Formato esperado:
    {
      "version": "CNEB 2016 v2",
      "niveles": [
        {
          "nivel": "primaria",
          "areas": [
            {
              "nombre": "Comunicación",
              "orden": 1,
              "competencias": [
                {
                  "numero": 1,
                  "nombre": "Se comunica oralmente en su lengua materna",
                  "capacidades": [
                    {"orden": 1, "nombre": "Obtiene información del texto oral"}
                  ],
                  "desempenos": [
                    {"grado": "p1", "orden": 1, "descripcion": "Expresa sus necesidades..."}
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        rol = getattr(request.user, "rol", None)
        if rol not in ("director", "subdirector", "admin_tic"):
            return Response({"error": "Solo director o admin TIC pueden importar."}, status=403)

        data = request.data
        if "niveles" not in data:
            return Response({"error": "JSON inválido: falta la clave 'niveles'."}, status=400)

        stats = {"areas": 0, "competencias": 0, "capacidades": 0, "desempenos": 0}

        try:
            with transaction.atomic():
                for bloque_nivel in data["niveles"]:
                    nivel = bloque_nivel.get("nivel")
                    if nivel not in ("inicial", "primaria", "secundaria"):
                        return Response({"error": f"Nivel inválido: {nivel}"}, status=400)

                    for area_data in bloque_nivel.get("areas", []):
                        area, created = AreaCurricular.objects.update_or_create(
                            nombre=area_data["nombre"], nivel=nivel,
                            defaults={"orden": area_data.get("orden", 0)},
                        )
                        if created:
                            stats["areas"] += 1

                        for comp_data in area_data.get("competencias", []):
                            comp, created = Competencia.objects.update_or_create(
                                area=area, numero=comp_data["numero"],
                                defaults={"nombre": comp_data["nombre"]},
                            )
                            if created:
                                stats["competencias"] += 1

                            for cap_data in comp_data.get("capacidades", []):
                                _, created = Capacidad.objects.update_or_create(
                                    competencia=comp, orden=cap_data["orden"],
                                    defaults={"nombre": cap_data["nombre"]},
                                )
                                if created:
                                    stats["capacidades"] += 1

                            for des_data in comp_data.get("desempenos", []):
                                _, created = Desempeno.objects.update_or_create(
                                    competencia=comp,
                                    grado=des_data.get("grado"),
                                    orden=des_data["orden"],
                                    defaults={"descripcion": des_data["descripcion"]},
                                )
                                if created:
                                    stats["desempenos"] += 1

        except KeyError as e:
            return Response({"error": f"Campo requerido faltante: {e}"}, status=400)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

        return Response({
            "ok": True,
            "version": data.get("version", "—"),
            "creados": stats,
            "mensaje": (
                f"Importación completa: {stats['areas']} áreas, "
                f"{stats['competencias']} competencias, "
                f"{stats['capacidades']} capacidades, "
                f"{stats['desempenos']} desempeños nuevos."
            ),
        })
