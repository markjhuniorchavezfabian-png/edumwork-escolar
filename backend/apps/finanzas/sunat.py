import json
import logging
from decimal import Decimal
import urllib.request
import urllib.error

from apps.core.models import ConfiguracionInstitucional
from .models import Pago

logger = logging.getLogger(__name__)


def emitir_comprobante_sunat(pago: Pago) -> dict:
    """Envía el comprobante electrónico (Boleta/Factura inafecta a IGV) al PSE/SUNAT."""
    cfg = ConfiguracionInstitucional.get_solo()
    if not cfg.facturacion_sunat_habilitada:
        return {
            "exito": False,
            "estado": "NO_HABILITADA",
            "mensaje": "La facturación electrónica SUNAT no está habilitada en esta institución.",
        }

    if not cfg.sunat_api_url or not cfg.sunat_api_token:
        pago.sunat_estado = "ERROR"
        pago.sunat_respuesta = "Faltan credenciales API (URL o Token) en la configuración institucional."
        pago.save(update_fields=["sunat_estado", "sunat_respuesta", "actualizado_en"])
        return {
            "exito": False,
            "estado": "ERROR_CONFIG",
            "mensaje": pago.sunat_respuesta,
        }

    # Determinación de datos del cliente (apoderado o estudiante)
    estudiante = pago.estudiante
    usuario_est = estudiante.usuario
    padre_rel = estudiante.padres.first()
    usuario_padre = padre_rel.usuario if padre_rel else None

    # Si es factura requiere RUC (6), si es boleta DNI (1)
    es_factura = pago.tipo_comprobante_sunat == "FACTURA"
    tipo_doc = 6 if es_factura else 1
    numero_doc = (usuario_padre.dni if usuario_padre and usuario_padre.dni else usuario_est.dni) or "00000000"
    denominacion = (usuario_padre.get_full_name() if usuario_padre else usuario_est.get_full_name()) or "CLIENTE VARIOS"
    direccion = (usuario_padre.direccion if usuario_padre and hasattr(usuario_padre, "direccion") else estudiante.direccion) or "-"

    serie = cfg.sunat_serie_factura if es_factura else cfg.sunat_serie_boleta
    tipo_comprobante = 1 if es_factura else 2 # 1=Factura, 2=Boleta

    concepto_desc = (
        pago.obligacion.concepto.nombre
        if pago.obligacion and pago.obligacion.concepto
        else "Servicio de Enseñanza Escolar"
    )

    monto_str = str(pago.monto)

    # Estructura JSON estándar para PSE peruano (Nubefact / Facturador.pro)
    payload = {
        "operacion": "generar_comprobante",
        "tipo_de_comprobante": tipo_comprobante,
        "serie": serie,
        "cliente_tipo_de_documento": tipo_doc,
        "cliente_numero_de_documento": numero_doc,
        "cliente_denominacion": denominacion,
        "cliente_direccion": direccion,
        "fecha_de_emision": pago.fecha_pago.strftime("%d-%m-%Y"),
        "moneda": 1, # 1 = Soles
        "tipo_de_cambio": "",
        "porcentaje_de_igv": 18.0,
        "total_gravada": "0.00",
        "total_inafecta": monto_str,
        "total_exonerada": "0.00",
        "total_igv": "0.00",
        "total": monto_str,
        "enviar_automaticamente_a_la_sunat": True,
        "enviar_automaticamente_al_cliente": False,
        "observaciones": f"Recibo interno ref: {pago.nro_recibo}",
        "items": [
            {
                "unidad_de_medida": "ZZ", # Servicios
                "codigo": f"EDU-{pago.id}",
                "descripcion": f"Servicio Educativo - {concepto_desc}",
                "cantidad": 1,
                "valor_unitario": monto_str,
                "precio_unitario": monto_str,
                "descuento": "",
                "subtotal": monto_str,
                "tipo_de_igv": 9, # 9 = Inafecto - Operación Onerosa (CNEB/Educación)
                "igv": "0.00",
                "total": monto_str,
                "anticipo_regularizacion": False,
            }
        ],
    }

    try:
        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            cfg.sunat_api_url,
            data=data_bytes,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Token token=\"{cfg.sunat_api_token}\"",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))

        pago.sunat_numero_comprobante = res_data.get("serie_y_numero", f"{serie}-{pago.id:06d}")
        pago.sunat_enlace_pdf = res_data.get("enlace_del_pdf", "")
        pago.sunat_enlace_xml = res_data.get("enlace_del_xml", "")
        pago.sunat_enlace_cdr = res_data.get("enlace_del_cdr", "")
        pago.sunat_estado = "ACEPTADO" if res_data.get("aceptada_por_sunat", True) else "RECHAZADO"
        pago.sunat_respuesta = json.dumps(res_data)
        pago.emite_factura_sunat = True
        pago.save(update_fields=[
            "sunat_numero_comprobante",
            "sunat_enlace_pdf",
            "sunat_enlace_xml",
            "sunat_enlace_cdr",
            "sunat_estado",
            "sunat_respuesta",
            "emite_factura_sunat",
            "actualizado_en",
        ])

        return {
            "exito": True,
            "numero_comprobante": pago.sunat_numero_comprobante,
            "estado": pago.sunat_estado,
            "enlace_pdf": pago.sunat_enlace_pdf,
        }

    except Exception as e:
        logger.error(f"Error emitiendo comprobante a SUNAT: {e}")
        pago.sunat_estado = "ERROR"
        pago.sunat_respuesta = str(e)
        pago.save(update_fields=["sunat_estado", "sunat_respuesta", "actualizado_en"])
        return {
            "exito": False,
            "estado": "ERROR_CONEXION",
            "mensaje": f"Error comunicando con el PSE: {str(e)}",
        }
