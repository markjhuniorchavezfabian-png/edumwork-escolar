import io
from datetime import datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.core.models import ConfiguracionInstitucional
from .models import EstadoObligacion, MetodoPago, ObligacionPago, Pago


def generar_telecredito_bcp(anio_lectivo: int, mes: int | None = None, seccion_id: int | None = None) -> str:
    """Genera el archivo de recaudación escolar para BCP (Telecrédito).

    Estructura estándar BCP:
      - Registro Cabecera (CC): Datos del colegio, cuenta recaudadora, fecha.
      - Registros de Detalle (DD): Código de alumno, nombre, concepto, vencimiento e importe.
      - Registro Control (TT): Cantidad total de alumnos e importe consolidado.
    """
    cfg = ConfiguracionInstitucional.get_solo()
    cuenta_bcp = (cfg.cuenta_recaudacion_bcp or "19100000000000").strip().replace("-", "")
    ruc = (cfg.codigo_modular or "20100000001").strip()
    nombre_ie = (cfg.sigla or cfg.nombre_institucion or "COLEGIO").upper()[:30]

    qs = ObligacionPago.objects.filter(
        anio_lectivo=anio_lectivo,
        estado__in=[EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL, EstadoObligacion.VENCIDO],
    ).select_related("estudiante__usuario", "concepto")

    if mes:
        qs = qs.filter(mes=mes)
    if seccion_id:
        qs = qs.filter(estudiante__matriculas__seccion_id=seccion_id)

    lineas = []
    hoy_str = timezone.now().strftime("%Y%m%d")

    # 1. Cabecera CC
    # Pos: CC (2) + Cuenta (20) + RUC (11) + Moneda 0001=Soles (4) + Fecha (8) + Nombre IE (30)
    linea_cc = f"CC{cuenta_bcp:<20}{ruc:<11}0001{hoy_str}{nombre_ie:<30}"
    lineas.append(linea_cc)

    total_registros = 0
    total_importe_centimos = 0

    # 2. Detalles DD
    for ob in qs:
        estudiante = ob.estudiante
        usuario = estudiante.usuario
        codigo_alumno = (estudiante.matricula_actual.codigo_matricula if estudiante.matricula_actual else usuario.dni) or f"EST{estudiante.id}"
        codigo_alumno = str(codigo_alumno).strip()[:14]

        nombre_alumno = usuario.get_full_name().upper()[:35]
        venc_str = ob.fecha_vencimiento.strftime("%Y%m%d")
        
        # Saldo en céntimos (ej: S/ 280.00 -> 28000)
        saldo_centimos = int(round(ob.saldo_pendiente * 100))
        if saldo_centimos <= 0:
            continue

        concepto_ref = f"{ob.concepto.nombre[:15]}"

        # DD + CodigoAlumno(15) + Nombre(35) + Venc(8) + Importe(15) + Referencia(15)
        linea_dd = f"DD{codigo_alumno:<15}{nombre_alumno:<35}{venc_str}{saldo_centimos:015d}{concepto_ref:<15}"
        lineas.append(linea_dd)

        total_registros += 1
        total_importe_centimos += saldo_centimos

    # 3. Control TT
    linea_tt = f"TT{total_registros:06d}{total_importe_centimos:018d}"
    lineas.append(linea_tt)

    return "\r\n".join(lineas) + "\r\n"


def generar_recaudo_bbva(anio_lectivo: int, mes: int | None = None) -> str:
    """Genera archivo de recaudo para BBVA Continental."""
    cfg = ConfiguracionInstitucional.get_solo()
    cod_servicio = (cfg.cuenta_recaudacion_bbva or "0000").strip()[:10]
    hoy_str = timezone.now().strftime("%Y%m%d")

    qs = ObligacionPago.objects.filter(
        anio_lectivo=anio_lectivo,
        estado__in=[EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL, EstadoObligacion.VENCIDO],
    ).select_related("estudiante__usuario", "concepto")

    if mes:
        qs = qs.filter(mes=mes)

    lineas = [f"01{cod_servicio:<10}{hoy_str}PENSIONES"]
    total_recs = 0
    total_importe = 0

    for ob in qs:
        est = ob.estudiante
        codigo = (est.matricula_actual.codigo_matricula if est.matricula_actual else est.usuario.dni) or str(est.id)
        saldo_centimos = int(round(ob.saldo_pendiente * 100))
        if saldo_centimos <= 0:
            continue

        linea = f"02{codigo[:12]:<12}{est.usuario.get_full_name().upper()[:30]:<30}{ob.fecha_vencimiento.strftime('%Y%m%d')}{saldo_centimos:012d}"
        lineas.append(linea)
        total_recs += 1
        total_importe += saldo_centimos

    lineas.append(f"03{total_recs:06d}{total_importe:015d}")
    return "\r\n".join(lineas) + "\r\n"


def importar_extracto_banco(contenido_texto: str, usuario_responsable) -> dict:
    """Procesa el archivo de retorno del banco con los pagos efectuados y concilia masivamente."""
    lineas = contenido_texto.strip().splitlines()
    conciliados = 0
    omitidos = 0
    total_cobrado = Decimal("0.00")
    errores = []

    with transaction.atomic():
        for nro_linea, raw_line in enumerate(lineas, start=1):
            line = raw_line.strip()
            if not line:
                continue

            # Identificación de línea de detalle (DD para BCP o 02 para BBVA)
            if line.startswith("DD") or line.startswith("02"):
                try:
                    codigo_alumno = line[2:17].strip()
                    # Si viene formato BCP
                    if line.startswith("DD"):
                        # Extraer importe de posición 60 a 75
                        importe_raw = line[60:75].strip()
                        monto = Decimal(importe_raw) / Decimal(100)
                    else:
                        # BBVA formato
                        monto = Decimal(line[50:62].strip()) / Decimal(100)

                    # Buscar obligación pendiente del alumno por código SIAGIE, matrícula o DNI
                    obligacion = ObligacionPago.objects.filter(
                        estudiante__usuario__dni=codigo_alumno,
                        estado__in=[EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL, EstadoObligacion.VENCIDO],
                    ).first()

                    if not obligacion:
                        obligacion = ObligacionPago.objects.filter(
                            estudiante__matriculas__codigo_matricula=codigo_alumno,
                            estado__in=[EstadoObligacion.PENDIENTE, EstadoObligacion.PARCIAL, EstadoObligacion.VENCIDO],
                        ).first()

                    if obligacion:
                        pago = Pago.objects.create(
                            obligacion=obligacion,
                            estudiante=obligacion.estudiante,
                            monto=monto,
                            metodo_pago=MetodoPago.TRANSFERENCIA,
                            nro_operacion=f"BANCO-L{nro_linea}",
                            observaciones="Cobro automático conciliado desde extracto bancario",
                            registrado_por=usuario_responsable,
                            ingreso_a_caja=False, # Pago en cuenta bancaria, no caja chica
                        )
                        conciliados += 1
                        total_cobrado += monto
                    else:
                        omitidos += 1
                except Exception as e:
                    errores.append(f"Línea {nro_linea}: {str(e)}")

    return {
        "conciliados": conciliados,
        "omitidos": omitidos,
        "total_cobrado": total_cobrado,
        "errores": errores[:10],
    }
