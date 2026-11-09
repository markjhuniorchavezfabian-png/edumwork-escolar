from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone

from apps.core.models import BaseModel
from apps.usuarios.models import Estudiante, Usuario


class EstadoObligacion(models.TextChoices):
    PENDIENTE = "PENDIENTE", "Pendiente"
    PARCIAL = "PARCIAL", "Pago Parcial"
    PAGADO = "PAGADO", "Pagado"
    VENCIDO = "VENCIDO", "Vencido / Moroso"
    EXONERADO = "EXONERADO", "Exonerado / Beca"


class MetodoPago(models.TextChoices):
    EFECTIVO = "EFECTIVO", "Efectivo"
    YAPE = "YAPE", "Yape"
    PLIN = "PLIN", "Plin"
    TRANSFERENCIA = "TRANSFERENCIA", "Transferencia Bancaria"
    DEPOSITO = "DEPOSITO", "Depósito Bancario"
    OTRO = "OTRO", "Otro"


class EstadoPago(models.TextChoices):
    CONFIRMADO = "CONFIRMADO", "Confirmado"
    PENDIENTE_VALIDACION = "PENDIENTE_VALIDACION", "Pendiente de Validación"
    ANULADO = "ANULADO", "Anulado"


class TipoMovimiento(models.TextChoices):
    INGRESO = "INGRESO", "Ingreso"
    EGRESO = "EGRESO", "Egreso"


class CategoriaMovimiento(models.TextChoices):
    PENSION_COBRADA = "PENSION_COBRADA", "Cobro de pensión / matrícula"
    APORTE_APAFA = "APORTE_APAFA", "Aporte APAFA"
    DONACION = "DONACION", "Donación"
    SERVICIOS = "SERVICIOS", "Servicios Básicos (Luz, Agua, Internet)"
    MANTENIMIENTO = "MANTENIMIENTO", "Mantenimiento e Infraestructura"
    MATERIALES = "MATERIALES", "Materiales y Útiles"
    REFRIGERIOS = "REFRIGERIOS", "Refrigerios y Eventos"
    HONORARIOS = "HONORARIOS", "Honorarios / Servicios Terceros"
    OTRO = "OTRO", "Otro"


class ComprobanteTipo(models.TextChoices):
    RECIBO_INTERNO = "RECIBO_INTERNO", "Recibo Interno de Caja"
    BOLETA_FISCAL = "BOLETA_FISCAL", "Boleta de Venta Física"
    FACTURA_FISCAL = "FACTURA_FISCAL", "Factura Física"
    SIN_COMPROBANTE = "SIN_COMPROBANTE", "Declaración Simple / Sin comprobante"


class ConceptoPago(BaseModel):
    """Conceptos de cobro configurables (Matrícula, Pensiones, APAFA, Talleres)."""
    nombre = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, blank=True)
    monto_sugerido = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    es_pension = models.BooleanField(default=False, help_text="True si corresponde a la pensión escolar recurrente")
    mes = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1 a 12 para cuotas mensuales fijas")
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "finanzas_conceptos"
        ordering = ["mes", "nombre"]

    def __str__(self):
        return f"{self.nombre} (S/ {self.monto_sugerido})"


def generar_numero_recibo(anio: int | None = None) -> str:
    """Genera de forma secuencial y atómica el correlativo de recibo: REC-YYYY-000001."""
    if not anio:
        anio = timezone.now().year
    prefix = f"REC-{anio}-"
    ultimo = Pago.objects.filter(nro_recibo__startswith=prefix).select_for_update().order_by("-nro_recibo").first()
    if ultimo:
        try:
            ultimo_correlativo = int(ultimo.nro_recibo.replace(prefix, ""))
            correlativo = ultimo_correlativo + 1
        except ValueError:
            correlativo = 1
    else:
        correlativo = 1
    return f"{prefix}{correlativo:06d}"


class ObligacionPago(BaseModel):
    """Deuda o cuota asignada a un estudiante para un año lectivo."""
    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="obligaciones_pago")
    concepto = models.ForeignKey(ConceptoPago, on_delete=models.PROTECT, related_name="obligaciones")
    anio_lectivo = models.PositiveSmallIntegerField(db_index=True)
    mes = models.PositiveSmallIntegerField(null=True, blank=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    descuento = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00"),
        help_text="Descuento por beca, hermanos o pronto pago",
    )
    motivo_descuento = models.CharField(max_length=120, blank=True)
    mora = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00"),
        help_text="Recargo o interés por pago fuera de plazo",
    )
    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    fecha_vencimiento = models.DateField(db_index=True)
    estado = models.CharField(
        max_length=20,
        choices=EstadoObligacion.choices,
        default=EstadoObligacion.PENDIENTE,
        db_index=True,
    )
    observaciones = models.TextField(blank=True)

    class Meta:
        db_table = "finanzas_obligaciones"
        ordering = ["fecha_vencimiento", "id"]
        unique_together = [("estudiante", "concepto", "anio_lectivo", "mes")]

    @property
    def total_a_pagar(self) -> Decimal:
        total = self.monto - self.descuento + self.mora
        return max(Decimal("0.00"), total)

    @property
    def saldo_pendiente(self) -> Decimal:
        saldo = self.total_a_pagar - self.monto_pagado
        return max(Decimal("0.00"), saldo)

    def actualizar_estado(self, save: bool = True):
        if self.estado == EstadoObligacion.EXONERADO:
            return
        if self.monto_pagado >= self.total_a_pagar:
            self.estado = EstadoObligacion.PAGADO
        elif self.monto_pagado > Decimal("0.00"):
            self.estado = EstadoObligacion.PARCIAL
        elif self.fecha_vencimiento < timezone.now().date():
            self.estado = EstadoObligacion.VENCIDO
        else:
            self.estado = EstadoObligacion.PENDIENTE
        if save:
            self.save(update_fields=["estado", "monto_pagado", "actualizado_en"])

    def __str__(self):
        return f"{self.estudiante.usuario.get_full_name()} - {self.concepto.nombre} (S/ {self.saldo_pendiente} pend.)"


class Pago(BaseModel):
    """Comprobante interno de recepción de dinero."""
    obligacion = models.ForeignKey(
        ObligacionPago,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pagos",
    )
    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="pagos_realizados")
    nro_recibo = models.CharField(max_length=30, unique=True, db_index=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    metodo_pago = models.CharField(
        max_length=20,
        choices=MetodoPago.choices,
        default=MetodoPago.EFECTIVO,
    )
    nro_operacion = models.CharField(max_length=60, blank=True, help_text="Nro de operación bancaria/Yape")
    comprobante_img = models.ImageField(upload_to="vouchers/%Y/%m/", null=True, blank=True)
    fecha_pago = models.DateTimeField(default=timezone.now)
    registrado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, related_name="pagos_registrados")
    estado = models.CharField(
        max_length=25,
        choices=EstadoPago.choices,
        default=EstadoPago.CONFIRMADO,
    )
    motivo_anulacion = models.TextField(blank=True)
    observaciones = models.TextField(blank=True)
    ingreso_a_caja = models.BooleanField(
        default=True,
        help_text="Si True, registra automáticamente un movimiento de ingreso en Caja Chica",
    )

    # ── Facturación Electrónica SUNAT (Nivel 2) ────────────────────────
    emite_factura_sunat = models.BooleanField(default=False)
    tipo_comprobante_sunat = models.CharField(
        max_length=15,
        choices=[("BOLETA", "Boleta de Venta"), ("FACTURA", "Factura")],
        default="BOLETA",
    )
    sunat_numero_comprobante = models.CharField(max_length=30, blank=True)
    sunat_enlace_pdf = models.URLField(blank=True)
    sunat_enlace_xml = models.URLField(blank=True)
    sunat_enlace_cdr = models.URLField(blank=True)
    sunat_estado = models.CharField(
        max_length=30,
        choices=[("NO_EMITIDO", "No Emitido"), ("ACEPTADO", "Aceptado"), ("RECHAZADO", "Rechazado"), ("ERROR", "Error")],
        default="NO_EMITIDO",
    )
    sunat_respuesta = models.TextField(blank=True)

    class Meta:
        db_table = "finanzas_pagos"
        ordering = ["-fecha_pago", "-id"]

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        with transaction.atomic():
            if not self.nro_recibo:
                self.nro_recibo = generar_numero_recibo(self.fecha_pago.year if self.fecha_pago else None)
            super().save(*args, **kwargs)

            # Si es confirmado y tiene obligación asociada, imputar el saldo
            if self.estado == EstadoPago.CONFIRMADO and self.obligacion:
                total_pagado = Pago.objects.filter(
                    obligacion=self.obligacion,
                    estado=EstadoPago.CONFIRMADO,
                ).aggregate(total=models.Sum("monto"))["total"] or Decimal("0.00")
                self.obligacion.monto_pagado = total_pagado
                self.obligacion.actualizar_estado(save=True)

            # Si está confirmado y debe sumar a caja, asegurar movimiento de caja
            if self.estado == EstadoPago.CONFIRMADO and self.ingreso_a_caja:
                MovimientoCaja.objects.get_or_create(
                    pago=self,
                    defaults={
                        "tipo": TipoMovimiento.INGRESO,
                        "categoria": CategoriaMovimiento.PENSION_COBRADA,
                        "monto": self.monto,
                        "descripcion": f"Cobro {self.nro_recibo} - {self.estudiante.usuario.get_full_name()} ({self.get_metodo_pago_display()})",
                        "comprobante_tipo": ComprobanteTipo.RECIBO_INTERNO,
                        "comprobante_nro": self.nro_recibo,
                        "responsable": self.registrado_por,
                        "fecha": self.fecha_pago,
                    },
                )

    def anular(self, motivo: str, usuario: Usuario):
        """Anula el recibo y actualiza el saldo de la obligación."""
        with transaction.atomic():
            self.estado = EstadoPago.ANULADO
            self.motivo_anulacion = motivo
            self.save(update_fields=["estado", "motivo_anulacion", "actualizado_en"])

            if self.obligacion:
                total_pagado = Pago.objects.filter(
                    obligacion=self.obligacion,
                    estado=EstadoPago.CONFIRMADO,
                ).aggregate(total=models.Sum("monto"))["total"] or Decimal("0.00")
                self.obligacion.monto_pagado = total_pagado
                self.obligacion.actualizar_estado(save=True)

            # Anular o registrar salida de caja si había ingresado
            MovimientoCaja.objects.filter(pago=self).delete()


class MovimientoCaja(BaseModel):
    """Movimientos diarios de Caja Chica (ingresos y egresos)."""
    tipo = models.CharField(max_length=10, choices=TipoMovimiento.choices)
    categoria = models.CharField(max_length=30, choices=CategoriaMovimiento.choices)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    descripcion = models.CharField(max_length=255)
    comprobante_tipo = models.CharField(
        max_length=30,
        choices=ComprobanteTipo.choices,
        default=ComprobanteTipo.RECIBO_INTERNO,
    )
    comprobante_nro = models.CharField(max_length=50, blank=True)
    pago = models.ForeignKey(
        Pago,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimientos_caja",
    )
    responsable = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True)
    fecha = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "finanzas_caja"
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"{self.tipo} - S/ {self.monto} ({self.descripcion})"
