from datetime import date
from decimal import Decimal

from django.db import models, transaction
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.models import ConfiguracionInstitucional
from apps.usuarios.models import Estudiante, Matricula, Rol, Seccion, Usuario

from .models import (
    CategoriaMovimiento,
    ComprobanteTipo,
    ConceptoPago,
    EstadoObligacion,
    EstadoPago,
    MetodoPago,
    MovimientoCaja,
    ObligacionPago,
    Pago,
    TipoMovimiento,
)
from .serializers import (
    ConceptoPagoSerializer,
    GenerarCronogramaSerializer,
    MovimientoCajaSerializer,
    ObligacionPagoSerializer,
    PagoSerializer,
)

ROLES_GESTORES = (Rol.DIRECTOR, Rol.SUBDIRECTOR, Rol.SECRETARIA, Rol.ADMIN_TIC)


def es_gestor_financiero(user: Usuario) -> bool:
    return bool(user.is_authenticated and (user.rol in ROLES_GESTORES or user.is_superuser))


class ConceptoPagoViewSet(viewsets.ModelViewSet):
    serializer_class = ConceptoPagoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = ConceptoPago.objects.all()
        if self.action in ["list", "retrieve"] and not es_gestor_financiero(self.request.user):
            return qs.filter(activo=True)
        return qs

    def perform_create(self, serializer):
        if not es_gestor_financiero(self.request.user):
            raise PermissionDenied("No tiene permiso para crear conceptos de cobro.")
        serializer.save()

    def perform_update(self, serializer):
        if not es_gestor_financiero(self.request.user):
            raise PermissionDenied("No tiene permiso para modificar conceptos de cobro.")
        serializer.save()

    def perform_destroy(self, instance):
        if not es_gestor_financiero(self.request.user):
            raise PermissionDenied("No tiene permiso para eliminar conceptos de cobro.")
        if instance.obligaciones.exists():
            instance.activo = False
            instance.save(update_fields=["activo"])
        else:
            instance.delete()


class ObligacionPagoViewSet(viewsets.ModelViewSet):
    serializer_class = ObligacionPagoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ObligacionPago.objects.select_related(
            "estudiante__usuario",
            "concepto",
        ).all()

        # Filtrado por rol
        if es_gestor_financiero(user):
            pass
        elif user.rol == Rol.PADRE and hasattr(user, "perfil_padre"):
            hijos_ids = user.perfil_padre.hijos.values_list("id", flat=True)
            qs = qs.filter(estudiante_id__in=hijos_ids)
        elif user.rol == Rol.ESTUDIANTE and hasattr(user, "perfil_estudiante"):
            qs = qs.filter(estudiante=user.perfil_estudiante)
        else:
            return qs.none()

        # Filtros de búsqueda y consulta
        estudiante_id = self.request.query_params.get("estudiante_id")
        if estudiante_id:
            qs = qs.filter(estudiante_id=estudiante_id)

        seccion_id = self.request.query_params.get("seccion_id")
        if seccion_id:
            qs = qs.filter(
                estudiante__matriculas__seccion_id=seccion_id,
            )

        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)

        anio = self.request.query_params.get("anio_lectivo")
        if anio:
            qs = qs.filter(anio_lectivo=anio)

        mes = self.request.query_params.get("mes")
        if mes:
            qs = qs.filter(mes=mes)

        buscar = self.request.query_params.get("buscar")
        if buscar:
            qs = qs.filter(
                Q(estudiante__usuario__first_name__icontains=buscar)
                | Q(estudiante__usuario__last_name__icontains=buscar)
                | Q(estudiante__usuario__dni__icontains=buscar)
            )

        return qs.distinct()

    def perform_create(self, serializer):
        if not es_gestor_financiero(self.request.user):
            raise PermissionDenied("No tiene permiso para registrar obligaciones de pago.")
        serializer.save()

    @action(detail=False, methods=["post"], url_path="generar-cronograma")
    def generar_cronograma(self, request):
        """Genera el cronograma de cobro (matrícula y/o pensiones mensuales) para los alumnos matriculados."""
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Solo el personal directivo o administrativo puede generar cronogramas.")

        serializer = GenerarCronogramaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        anio = data["anio_lectivo"]
        monto_pension = data["monto_pension"]
        monto_matricula = data.get("monto_matricula", Decimal("0.00"))
        seccion_id = data.get("seccion_id")
        mes_inicio = data["mes_inicio"]
        mes_fin = data["mes_fin"]
        dia_vencimiento = data["dia_vencimiento"]
        aplicar_desc_hermanos = data.get("aplicar_descuento_hermanos", False)
        pct_hermano = Decimal(str(data.get("pct_descuento_hermano", 10.0))) / Decimal(100)

        # Obtener matrículas activas del año
        matriculas_qs = Matricula.objects.filter(anio_lectivo=anio).select_related(
            "estudiante__usuario"
        ).prefetch_related("estudiante__padres")
        if seccion_id:
            matriculas_qs = matriculas_qs.filter(seccion_id=seccion_id)

        estudiantes = [m.estudiante for m in matriculas_qs]
        if not estudiantes:
            return Response(
                {"detail": "No se encontraron estudiantes matriculados para los criterios dados."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mapa de conteo de hermanos por apoderado para aplicar descuento
        familia_conteo: dict[int, int] = {}

        # Nombres de meses en español
        nombres_meses = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
            5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
            9: "Setiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
        }

        creadas = 0
        omitidas = 0

        with transaction.atomic():
            # 1. Matrícula si tiene monto > 0
            if monto_matricula > 0:
                concepto_mat, _ = ConceptoPago.objects.get_or_create(
                    codigo=f"MAT-{anio}",
                    defaults={
                        "nombre": f"Matrícula {anio}",
                        "monto_sugerido": monto_matricula,
                        "es_pension": False,
                    },
                )
                fecha_venc_mat = date(anio, mes_inicio, dia_vencimiento)
                for est in estudiantes:
                    _, created = ObligacionPago.objects.get_or_create(
                        estudiante=est,
                        concepto=concepto_mat,
                        anio_lectivo=anio,
                        defaults={
                            "monto": monto_matricula,
                            "fecha_vencimiento": fecha_venc_mat,
                            "estado": EstadoObligacion.PENDIENTE,
                        },
                    )
                    if created:
                        creadas += 1
                    else:
                        omitidas += 1

            # 2. Pensiones mes a mes con cálculo de hermanos
            for est in estudiantes:
                # Determinar si aplica descuento por hermano
                descuento_alumno = Decimal("0.00")
                motivo_desc = ""
                if aplicar_desc_hermanos:
                    padre = est.padres.first()
                    if padre:
                        hermanos_previos = familia_conteo.get(padre.id, 0)
                        familia_conteo[padre.id] = hermanos_previos + 1
                        if hermanos_previos > 0:
                            descuento_alumno = round(monto_pension * pct_hermano, 2)
                            motivo_desc = f"Descuento hermano ({int(pct_hermano * 100)}%)"

                for mes in range(mes_inicio, mes_fin + 1):
                    nombre_mes = nombres_meses.get(mes, f"Mes {mes}")
                    concepto_pen, _ = ConceptoPago.objects.get_or_create(
                        codigo=f"PEN-{anio}-{mes:02d}",
                        defaults={
                            "nombre": f"Pensión {nombre_mes} {anio}",
                            "monto_sugerido": monto_pension,
                            "es_pension": True,
                            "mes": mes,
                        },
                    )
                    fecha_venc = date(anio, mes, dia_vencimiento)
                    _, created = ObligacionPago.objects.get_or_create(
                        estudiante=est,
                        concepto=concepto_pen,
                        anio_lectivo=anio,
                        mes=mes,
                        defaults={
                            "monto": monto_pension,
                            "descuento": descuento_alumno,
                            "motivo_descuento": motivo_desc,
                            "fecha_vencimiento": fecha_venc,
                            "estado": EstadoObligacion.PENDIENTE,
                        },
                    )
                    if created:
                        creadas += 1
                    else:
                        omitidas += 1

        return Response(
            {
                "mensaje": "Cronograma generado exitosamente.",
                "total_estudiantes": len(estudiantes),
                "obligaciones_creadas": creadas,
                "obligaciones_existentes_omitidas": omitidas,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="recordatorio")
    def recordatorio(self, request, pk=None):
        """Genera el texto listo para enviar por WhatsApp o SMS al apoderado."""
        ob = self.get_object()
        cfg = ConfiguracionInstitucional.get_solo()
        alumno = ob.estudiante.usuario.get_full_name()
        concepto = ob.concepto.nombre
        monto = f"S/ {ob.saldo_pendiente:.2f}"
        fecha_venc = ob.fecha_vencimiento.strftime("%d/%m/%Y")
        colegio = cfg.nombre_institucion or "I.E. César Vallejo"
        cuenta = cfg.cuenta_recaudacion_bcp or "Yape / Transferencia BCP"

        padre_rel = ob.estudiante.padres.first()
        telefono = (padre_rel.usuario.telefono if padre_rel and hasattr(padre_rel.usuario, "telefono") else "") or ""

        texto_whatsapp = (
            f"Estimada familia de *{alumno}*, le saludamos de *{colegio}*. "
            f"Le recordamos que la cuota de *{concepto}* por un importe pendiente de *{monto}* "
            f"vence el *{fecha_venc}*. "
            f"Puede realizar su abono en: {cuenta}. "
            f"Por favor envíe su voucher por este medio o cárguelo en la plataforma institucional. ¡Gracias!"
        )

        return Response({
            "estudiante": alumno,
            "telefono": telefono,
            "concepto": concepto,
            "saldo_pendiente": str(ob.saldo_pendiente),
            "fecha_vencimiento": fecha_venc,
            "mensaje_whatsapp": texto_whatsapp,
        })

    @action(detail=False, methods=["get"], url_path="exportar-banco")
    def exportar_banco(self, request):
        """Descarga el padrón oficial de cobranza para Telecrédito BCP o BBVA."""
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Solo directivos pueden exportar archivos de recaudo bancario.")

        formato = request.query_params.get("formato", "BCP").upper()
        anio = int(request.query_params.get("anio_lectivo", timezone.now().year))
        mes = request.query_params.get("mes")
        mes_int = int(mes) if mes else None

        from .bancos import generar_recaudo_bbva, generar_telecredito_bcp

        if formato == "BBVA":
            contenido = generar_recaudo_bbva(anio, mes_int)
            nombre_archivo = f"RECAUDO_BBVA_{anio}_{mes or 'TODOS'}.txt"
        else:
            contenido = generar_telecredito_bcp(anio, mes_int)
            nombre_archivo = f"TELECREDITO_BCP_{anio}_{mes or 'TODOS'}.txt"

        response = HttpResponse(contenido, content_type="text/plain; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{nombre_archivo}"'
        return response


class PagoViewSet(viewsets.ModelViewSet):
    serializer_class = PagoSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        qs = Pago.objects.select_related(
            "estudiante__usuario",
            "obligacion__concepto",
            "registrado_por",
        ).all()

        if es_gestor_financiero(user):
            pass
        elif user.rol == Rol.PADRE and hasattr(user, "perfil_padre"):
            hijos_ids = user.perfil_padre.hijos.values_list("id", flat=True)
            qs = qs.filter(estudiante_id__in=hijos_ids)
        elif user.rol == Rol.ESTUDIANTE and hasattr(user, "perfil_estudiante"):
            qs = qs.filter(estudiante=user.perfil_estudiante)
        else:
            return qs.none()

        estudiante_id = self.request.query_params.get("estudiante_id")
        if estudiante_id:
            qs = qs.filter(estudiante_id=estudiante_id)

        estado = self.request.query_params.get("estado")
        if estado:
            qs = qs.filter(estado=estado)

        metodo = self.request.query_params.get("metodo_pago")
        if metodo:
            qs = qs.filter(metodo_pago=metodo)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        # Si un padre registra un pago (sube voucher), queda pendiente de validación
        if user.rol == Rol.PADRE and not es_gestor_financiero(user):
            serializer.save(
                registrado_por=user,
                estado=EstadoPago.PENDIENTE_VALIDACION,
                ingreso_a_caja=False,
            )
        else:
            pago = serializer.save(
                registrado_por=user,
                estado=EstadoPago.CONFIRMADO,
            )
            cfg = ConfiguracionInstitucional.get_solo()
            if cfg.facturacion_sunat_habilitada and pago.emite_factura_sunat:
                from .sunat import emitir_comprobante_sunat
                emitir_comprobante_sunat(pago)

    @action(detail=False, methods=["get"], url_path="vouchers-pendientes")
    def vouchers_pendientes(self, request):
        """Bandeja de comprobantes subidos por familias pendientes de aprobación."""
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Solo el personal administrativo puede validar vouchers.")

        qs = self.get_queryset().filter(estado=EstadoPago.PENDIENTE_VALIDACION)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="emitir-sunat")
    def emitir_sunat(self, request, pk=None):
        """Dispara la emisión electrónica manual del comprobante a SUNAT."""
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Solo personal directivo puede emitir comprobantes tributarios.")

        pago = self.get_object()
        from .sunat import emitir_comprobante_sunat
        resultado = emitir_comprobante_sunat(pago)
        return Response(resultado)

    @action(detail=False, methods=["post"], url_path="importar-extracto-banco")
    def importar_extracto_banco(self, request):
        """Sube y concilia masivamente el extracto de pagos devuelto por BCP o BBVA."""
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Solo directivos pueden conciliar extractos bancarios.")

        archivo = request.FILES.get("archivo")
        if not archivo:
            raise ValidationError({"archivo": "Debe adjuntar el archivo de texto provisto por el banco."})

        contenido = archivo.read().decode("utf-8", errors="ignore")
        from .bancos import importar_extracto_banco
        resultado = importar_extracto_banco(contenido, request.user)
        return Response(resultado)

    @action(detail=True, methods=["post"], url_path="anular")
    def anular(self, request, pk=None):
        """Anula un recibo emitido."""
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("No tiene permiso para anular recibos de pago.")

        pago = self.get_object()
        if pago.estado == EstadoPago.ANULADO:
            return Response({"detail": "El pago ya se encuentra anulado."}, status=status.HTTP_400_BAD_REQUEST)

        motivo = request.data.get("motivo", "").strip()
        if not motivo:
            raise ValidationError({"motivo": "Debe especificar el motivo de anulación."})

        pago.anular(motivo=motivo, usuario=request.user)
        return Response({"mensaje": f"Recibo {pago.nro_recibo} anulado correctamente."})

    @action(detail=True, methods=["post"], url_path="validar-voucher")
    def validar_voucher(self, request, pk=None):
        """Aprueba o rechaza un pago enviado por un padre vía voucher."""
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Solo el personal autorizado puede validar vouchers de pago.")

        pago = self.get_object()
        aprobar = request.data.get("aprobar", True)
        motivo = request.data.get("motivo", "")

        if aprobar:
            pago.estado = EstadoPago.CONFIRMADO
            pago.ingreso_a_caja = request.data.get("ingreso_a_caja", True)
            pago.save()
            cfg = ConfiguracionInstitucional.get_solo()
            if cfg.facturacion_sunat_habilitada and pago.emite_factura_sunat:
                from .sunat import emitir_comprobante_sunat
                emitir_comprobante_sunat(pago)
            return Response({"mensaje": f"Pago {pago.nro_recibo} confirmado y aplicado a la cuenta."})
        else:
            pago.anular(motivo=motivo or "Voucher no válido / rechazado", usuario=request.user)
            return Response({"mensaje": f"Pago {pago.nro_recibo} rechazado."})

    @action(detail=True, methods=["get"], url_path="recibo-detalle")
    def recibo_detalle(self, request, pk=None):
        """Devuelve los datos estructurados para renderizar e imprimir el recibo interno oficial."""
        pago = self.get_object()
        cfg = ConfiguracionInstitucional.objects.first()

        estudiante = pago.estudiante
        usuario_est = estudiante.usuario
        seccion = estudiante.seccion_obj

        data = {
            "institucion": {
                "nombre": cfg.nombre_institucion if cfg else "Institución Educativa",
                "sigla": cfg.sigla if cfg else "",
                "codigo_modular": cfg.codigo_modular if cfg else "",
                "direccion": cfg.direccion if cfg else "",
                "ugel": cfg.ugel if cfg else "",
            },
            "recibo": {
                "nro_recibo": pago.nro_recibo,
                "fecha": pago.fecha_pago.strftime("%d/%m/%Y %H:%M"),
                "monto": str(pago.monto),
                "metodo_pago": pago.get_metodo_pago_display(),
                "nro_operacion": pago.nro_operacion or "-",
                "estado": pago.get_estado_display(),
                "observaciones": pago.observaciones or "",
                "registrado_por": pago.registrado_por.get_full_name() if pago.registrado_por else "Caja",
            },
            "estudiante": {
                "nombre_completo": usuario_est.get_full_name(),
                "dni": usuario_est.dni or "-",
                "codigo_matricula": getattr(estudiante.matricula_actual, "codigo_matricula", None) or "-",
                "grado_seccion": seccion.nombre if seccion else (estudiante.grado or "-"),
            },
            "concepto": {
                "nombre": pago.obligacion.concepto.nombre if pago.obligacion else "Abono / Pago diverso",
                "mes": pago.obligacion.mes if pago.obligacion else None,
                "saldo_restante": str(pago.obligacion.saldo_pendiente) if pago.obligacion else "0.00",
            },
        }
        return Response(data)


class MovimientoCajaViewSet(viewsets.ModelViewSet):
    serializer_class = MovimientoCajaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not es_gestor_financiero(self.request.user):
            raise PermissionDenied("Acceso restringido a personal de administración y dirección.")

        qs = MovimientoCaja.objects.select_related("responsable", "pago").all()
        tipo = self.request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)

        categoria = self.request.query_params.get("categoria")
        if categoria:
            qs = qs.filter(categoria=categoria)

        return qs

    def perform_create(self, serializer):
        if not es_gestor_financiero(self.request.user):
            raise PermissionDenied("No tiene permiso para registrar movimientos de caja.")
        serializer.save(responsable=self.request.user)

    @action(detail=False, methods=["get"], url_path="balance")
    def balance(self, request):
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Acceso restringido a directivos.")

        ingresos = MovimientoCaja.objects.filter(tipo=TipoMovimiento.INGRESO).aggregate(total=Sum("monto"))["total"] or Decimal("0.00")
        egresos = MovimientoCaja.objects.filter(tipo=TipoMovimiento.EGRESO).aggregate(total=Sum("monto"))["total"] or Decimal("0.00")
        saldo = ingresos - egresos

        return Response({
            "total_ingresos": ingresos,
            "total_egresos": egresos,
            "saldo_caja": saldo,
        })


class ResumenFinancieroViewSet(viewsets.ViewSet):
    """Endpoints de analítica y KPIs para el Director."""
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="kpis")
    def kpis(self, request):
        if not es_gestor_financiero(request.user):
            raise PermissionDenied("Solo el equipo directivo puede ver métricas financieras.")

        hoy = timezone.now().date()
        mes_actual = hoy.month
        anio_actual = hoy.year

        # 1. Recaudación del mes actual
        recaudacion_mes = Pago.objects.filter(
            estado=EstadoPago.CONFIRMADO,
            fecha_pago__year=anio_actual,
            fecha_pago__month=mes_actual,
        ).aggregate(total=Sum("monto"))["total"] or Decimal("0.00")

        # 2. Deuda vencida total
        deuda_vencida = ObligacionPago.objects.filter(
            estado__in=[EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL, EstadoObligacion.VENCIDO],
            fecha_vencimiento__lt=hoy,
        )
        total_deuda_vencida = sum([ob.saldo_pendiente for ob in deuda_vencida]) if deuda_vencida.exists() else Decimal("0.00")

        # 3. Cantidad de alumnos morosos únicos
        morosos_count = deuda_vencida.values("estudiante_id").distinct().count()

        # 4. Saldo actual de caja chica
        ingresos_caja = MovimientoCaja.objects.filter(tipo=TipoMovimiento.INGRESO).aggregate(t=Sum("monto"))["t"] or Decimal("0.00")
        egresos_caja = MovimientoCaja.objects.filter(tipo=TipoMovimiento.EGRESO).aggregate(t=Sum("monto"))["t"] or Decimal("0.00")
        saldo_caja = ingresos_caja - egresos_caja

        # 5. Cobros recientes
        ultimos_pagos = Pago.objects.filter(estado=EstadoPago.CONFIRMADO).select_related("estudiante__usuario")[:5]
        pagos_recientes = [
            {
                "id": p.id,
                "nro_recibo": p.nro_recibo,
                "estudiante": p.estudiante.usuario.get_full_name(),
                "monto": str(p.monto),
                "metodo": p.get_metodo_pago_display(),
                "fecha": p.fecha_pago.strftime("%d/%m/%Y"),
            }
            for p in ultimos_pagos
        ]

        return Response({
            "recaudacion_mes": recaudacion_mes,
            "total_deuda_vencida": total_deuda_vencida,
            "morosos_count": morosos_count,
            "saldo_caja": saldo_caja,
            "pagos_recientes": pagos_recientes,
        })
