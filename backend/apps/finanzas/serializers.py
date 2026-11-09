from rest_framework import serializers

from apps.core.archivos import ArchivosFirmadosMixin
from apps.core.imagenes import validar_upload_serializer
from apps.usuarios.models import Estudiante
from .models import (
    ConceptoPago,
    ObligacionPago,
    Pago,
    MovimientoCaja,
    EstadoObligacion,
    MetodoPago,
    EstadoPago,
    TipoMovimiento,
    CategoriaMovimiento,
    ComprobanteTipo,
)


class ConceptoPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConceptoPago
        fields = [
            "id",
            "nombre",
            "codigo",
            "monto_sugerido",
            "es_pension",
            "mes",
            "activo",
            "creado_en",
        ]


class ObligacionPagoSerializer(serializers.ModelSerializer):
    estudiante_nombre = serializers.SerializerMethodField()
    estudiante_dni = serializers.CharField(source="estudiante.usuario.dni", read_only=True)
    concepto_nombre = serializers.CharField(source="concepto.nombre", read_only=True)
    seccion_nombre = serializers.SerializerMethodField()
    total_a_pagar = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    saldo_pendiente = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ObligacionPago
        fields = [
            "id",
            "estudiante",
            "estudiante_nombre",
            "estudiante_dni",
            "seccion_nombre",
            "concepto",
            "concepto_nombre",
            "anio_lectivo",
            "mes",
            "monto",
            "descuento",
            "motivo_descuento",
            "mora",
            "total_a_pagar",
            "monto_pagado",
            "saldo_pendiente",
            "fecha_vencimiento",
            "estado",
            "observaciones",
            "creado_en",
        ]
        read_only_fields = ["total_a_pagar", "monto_pagado", "saldo_pendiente", "creado_en"]

    def get_estudiante_nombre(self, obj):
        return obj.estudiante.usuario.get_full_name()

    def get_seccion_nombre(self, obj):
        seccion = obj.estudiante.seccion_obj
        return seccion.nombre if seccion else (obj.estudiante.grado or "Sin asignar")


class PagoSerializer(ArchivosFirmadosMixin, serializers.ModelSerializer):
    estudiante_nombre = serializers.SerializerMethodField()
    concepto_nombre = serializers.SerializerMethodField()
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Pago
        fields = [
            "id",
            "obligacion",
            "estudiante",
            "estudiante_nombre",
            "concepto_nombre",
            "nro_recibo",
            "monto",
            "metodo_pago",
            "nro_operacion",
            "comprobante_img",
            "fecha_pago",
            "registrado_por",
            "registrado_por_nombre",
            "estado",
            "motivo_anulacion",
            "observaciones",
            "ingreso_a_caja",
            "emite_factura_sunat",
            "tipo_comprobante_sunat",
            "sunat_numero_comprobante",
            "sunat_enlace_pdf",
            "sunat_enlace_xml",
            "sunat_enlace_cdr",
            "sunat_estado",
            "creado_en",
        ]
        read_only_fields = [
            "nro_recibo",
            "sunat_numero_comprobante",
            "sunat_enlace_pdf",
            "sunat_enlace_xml",
            "sunat_enlace_cdr",
            "sunat_estado",
            "registrado_por",
            "registrado_por_nombre",
            "creado_en",
        ]

    def get_estudiante_nombre(self, obj):
        return obj.estudiante.usuario.get_full_name()

    def get_concepto_nombre(self, obj):
        if obj.obligacion and obj.obligacion.concepto:
            return obj.obligacion.concepto.nombre
        return "Pago general"

    def get_registrado_por_nombre(self, obj):
        return obj.registrado_por.get_full_name() if obj.registrado_por else "Sistema"

    def validate_comprobante_img(self, value):
        if value:
            return validar_upload_serializer(value, "comprobante_img")
        return value

    def validate(self, attrs):
        obligacion = attrs.get("obligacion")
        estudiante = attrs.get("estudiante")
        monto = attrs.get("monto")

        if obligacion and not estudiante:
            attrs["estudiante"] = obligacion.estudiante
        elif obligacion and estudiante and obligacion.estudiante != estudiante:
            raise serializers.ValidationError("La obligación no pertenece al estudiante seleccionado.")

        if monto and monto <= 0:
            raise serializers.ValidationError({"monto": "El monto debe ser mayor a cero."})

        return attrs


class MovimientoCajaSerializer(serializers.ModelSerializer):
    responsable_nombre = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoCaja
        fields = [
            "id",
            "tipo",
            "categoria",
            "monto",
            "descripcion",
            "comprobante_tipo",
            "comprobante_nro",
            "pago",
            "responsable",
            "responsable_nombre",
            "fecha",
            "creado_en",
        ]
        read_only_fields = ["responsable", "responsable_nombre", "creado_en"]

    def get_responsable_nombre(self, obj):
        return obj.responsable.get_full_name() if obj.responsable else "Caja"


class GenerarCronogramaSerializer(serializers.Serializer):
    anio_lectivo = serializers.IntegerField(required=True)
    monto_pension = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    monto_matricula = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0.00)
    seccion_id = serializers.IntegerField(required=False, allow_null=True)
    mes_inicio = serializers.IntegerField(default=3, min_value=1, max_value=12) # Marzo
    mes_fin = serializers.IntegerField(default=12, min_value=1, max_value=12)   # Diciembre
    dia_vencimiento = serializers.IntegerField(default=5, min_value=1, max_value=28)
    aplicar_descuento_hermanos = serializers.BooleanField(default=False, required=False)
    pct_descuento_hermano = serializers.DecimalField(max_digits=5, decimal_places=2, default=10.00, required=False)
