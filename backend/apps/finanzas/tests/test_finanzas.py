from datetime import date
from decimal import Decimal
import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import ConfiguracionInstitucional
from apps.usuarios.models import Estudiante, Matricula, Padre, Rol, Seccion, Usuario
from apps.finanzas.models import (
    ConceptoPago,
    EstadoObligacion,
    EstadoPago,
    MetodoPago,
    MovimientoCaja,
    ObligacionPago,
    Pago,
    TipoMovimiento,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def institucion_cfg(db):
    cfg, _ = ConfiguracionInstitucional.objects.get_or_create(
        id=1,
        defaults={
            "nombre_institucion": "I.E. César Vallejo",
            "codigo_modular": "1234567",
            "anio_lectivo_activo": 2026,
        },
    )
    return cfg


@pytest.fixture
def director(db):
    user = Usuario.objects.create_user(
        username="director_finanzas",
        email="director@vallejo.edu.pe",
        first_name="Carlos",
        last_name="Director",
        rol=Rol.DIRECTOR,
    )
    return user


@pytest.fixture
def secretaria(db):
    user = Usuario.objects.create_user(
        username="secretaria_finanzas",
        email="secre@vallejo.edu.pe",
        first_name="Rosa",
        last_name="Secretaria",
        rol=Rol.SECRETARIA,
    )
    return user


@pytest.fixture
def estudiante_1(db):
    u = Usuario.objects.create_user(
        username="estudiante_1",
        email="alumno1@vallejo.edu.pe",
        first_name="Juan",
        last_name="Perez",
        dni="77889901",
        rol=Rol.ESTUDIANTE,
    )
    est = Estudiante.objects.create(
        usuario=u,
        grado="1° Secundaria",
    )
    sec = Seccion.objects.create(
        nombre="1° A",
        nivel="secundaria",
        grado="1°",
        letra="A",
    )
    Matricula.objects.create(
        estudiante=est,
        seccion=sec,
        anio_lectivo=2026,
        codigo_matricula="VAL-001",
    )
    return est


@pytest.fixture
def padre_con_hijo(db, estudiante_1):
    u = Usuario.objects.create_user(
        username="padre_1",
        email="padre1@vallejo.edu.pe",
        first_name="Manuel",
        last_name="Perez",
        dni="08991122",
        rol=Rol.PADRE,
    )
    padre = Padre.objects.create(usuario=u)
    padre.hijos.add(estudiante_1)
    return u


@pytest.mark.django_db
def test_generar_cronograma_pensiones(api_client, director, estudiante_1):
    api_client.force_authenticate(user=director)

    payload = {
        "anio_lectivo": 2026,
        "monto_matricula": "150.00",
        "monto_pension": "280.00",
        "mes_inicio": 3,
        "mes_fin": 4, # Marzo y Abril para el test
        "dia_vencimiento": 5,
    }

    url = "/api/finanzas/obligaciones/generar-cronograma/"
    res = api_client.post(url, payload, format="json")
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    # 1 matrícula + 2 pensiones = 3 obligaciones
    assert data["obligaciones_creadas"] == 3

    obligaciones = ObligacionPago.objects.filter(estudiante=estudiante_1, anio_lectivo=2026)
    assert obligaciones.count() == 3

    # Reintentar la misma generación no duplica (idempotencia)
    res_reintento = api_client.post(url, payload, format="json")
    assert res_reintento.status_code == status.HTTP_201_CREATED
    assert res_reintento.json()["obligaciones_creadas"] == 0
    assert res_reintento.json()["obligaciones_existentes_omitidas"] == 3


@pytest.mark.django_db
def test_cobro_emite_recibo_y_actualiza_caja(api_client, secretaria, estudiante_1, institucion_cfg):
    concepto = ConceptoPago.objects.create(
        nombre="Pensión Marzo 2026",
        monto_sugerido=Decimal("280.00"),
        es_pension=True,
        mes=3,
    )
    obligacion = ObligacionPago.objects.create(
        estudiante=estudiante_1,
        concepto=concepto,
        anio_lectivo=2026,
        mes=3,
        monto=Decimal("280.00"),
        fecha_vencimiento=date(2026, 3, 5),
    )

    api_client.force_authenticate(user=secretaria)

    pago_payload = {
        "obligacion": obligacion.id,
        "estudiante": estudiante_1.id,
        "monto": "280.00",
        "metodo_pago": MetodoPago.YAPE,
        "nro_operacion": "OP-987654",
        "ingreso_a_caja": True,
    }

    res = api_client.post("/api/finanzas/pagos/", pago_payload, format="json")
    assert res.status_code == status.HTTP_201_CREATED
    pago_data = res.json()

    # Verifica formato correlativo REC-2026-000001
    assert pago_data["nro_recibo"].startswith("REC-")
    assert pago_data["nro_recibo"].endswith("000001")

    # Verifica que la obligación pasó a PAGADO
    obligacion.refresh_from_db()
    assert obligacion.estado == EstadoObligacion.PAGADO
    assert obligacion.monto_pagado == Decimal("280.00")
    assert obligacion.saldo_pendiente == Decimal("0.00")

    # Verifica que se creó el movimiento en caja chica
    mov = MovimientoCaja.objects.filter(pago_id=pago_data["id"]).first()
    assert mov is not None
    assert mov.tipo == TipoMovimiento.INGRESO
    assert mov.monto == Decimal("280.00")


@pytest.mark.django_db
def test_padre_solo_ve_sus_hijos(api_client, padre_con_hijo, estudiante_1):
    concepto = ConceptoPago.objects.create(
        nombre="Matrícula 2026",
        monto_sugerido=Decimal("150.00"),
    )
    ObligacionPago.objects.create(
        estudiante=estudiante_1,
        concepto=concepto,
        anio_lectivo=2026,
        monto=Decimal("150.00"),
        fecha_vencimiento=date(2026, 3, 1),
    )

    api_client.force_authenticate(user=padre_con_hijo)
    res = api_client.get("/api/finanzas/obligaciones/")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    items = data.get("results", data)
    assert len(items) == 1
    assert items[0]["estudiante_dni"] == "77889901"


@pytest.mark.django_db
def test_anulacion_de_pago_restaura_deuda(api_client, director, estudiante_1):
    concepto = ConceptoPago.objects.create(
        nombre="Pensión Abril 2026",
        monto_sugerido=Decimal("280.00"),
    )
    obligacion = ObligacionPago.objects.create(
        estudiante=estudiante_1,
        concepto=concepto,
        anio_lectivo=2026,
        monto=Decimal("280.00"),
        fecha_vencimiento=date(2026, 4, 5),
    )

    pago = Pago.objects.create(
        obligacion=obligacion,
        estudiante=estudiante_1,
        monto=Decimal("280.00"),
        metodo_pago=MetodoPago.EFECTIVO,
        registrado_por=director,
        estado=EstadoPago.CONFIRMADO,
    )

    obligacion.refresh_from_db()
    assert obligacion.estado == EstadoObligacion.PAGADO

    api_client.force_authenticate(user=director)
    res_anular = api_client.post(
        f"/api/finanzas/pagos/{pago.id}/anular/",
        {"motivo": "Error de digitación en caja"},
        format="json",
    )
    assert res_anular.status_code == status.HTTP_200_OK

    pago.refresh_from_db()
    assert pago.estado == EstadoPago.ANULADO
    assert pago.motivo_anulacion == "Error de digitación en caja"

    obligacion.refresh_from_db()
    assert obligacion.estado != EstadoObligacion.PAGADO
    assert obligacion.saldo_pendiente == Decimal("280.00")


@pytest.mark.django_db
def test_recibo_detalle_formato(api_client, secretaria, estudiante_1, institucion_cfg):
    concepto = ConceptoPago.objects.create(nombre="Cuota APAFA 2026", monto_sugerido=Decimal("50.00"))
    pago = Pago.objects.create(
        estudiante=estudiante_1,
        monto=Decimal("50.00"),
        metodo_pago=MetodoPago.EFECTIVO,
        registrado_por=secretaria,
        estado=EstadoPago.CONFIRMADO,
    )

    api_client.force_authenticate(user=secretaria)
    res = api_client.get(f"/api/finanzas/pagos/{pago.id}/recibo-detalle/")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["institucion"]["nombre"] == "I.E. César Vallejo"
    assert data["recibo"]["nro_recibo"] == pago.nro_recibo
    assert data["estudiante"]["nombre_completo"] == "Juan Perez"
    assert data["recibo"]["monto"] == "50.00"


@pytest.mark.django_db
def test_descuento_hermanos_en_cronograma(api_client, director, estudiante_1, padre_con_hijo):
    # Crear un segundo hijo para el mismo padre
    u2 = Usuario.objects.create_user(
        username="estudiante_2",
        email="alumno2@vallejo.edu.pe",
        first_name="Mateo",
        last_name="Perez",
        dni="77889902",
        rol=Rol.ESTUDIANTE,
    )
    est2 = Estudiante.objects.create(usuario=u2, grado="2° Secundaria")
    padre_obj = padre_con_hijo.perfil_padre
    padre_obj.hijos.add(est2)

    Matricula.objects.create(estudiante=est2, anio_lectivo=2026, codigo_matricula="VAL-002")

    api_client.force_authenticate(user=director)
    payload = {
        "anio_lectivo": 2026,
        "monto_matricula": "0.00",
        "monto_pension": "200.00",
        "mes_inicio": 3,
        "mes_fin": 3,
        "dia_vencimiento": 5,
        "aplicar_descuento_hermanos": True,
        "pct_descuento_hermano": "15.00",
    }
    res = api_client.post("/api/finanzas/obligaciones/generar-cronograma/", payload, format="json")
    assert res.status_code == status.HTTP_201_CREATED

    ob_hijo1 = ObligacionPago.objects.get(estudiante=estudiante_1, anio_lectivo=2026, mes=3)
    ob_hijo2 = ObligacionPago.objects.get(estudiante=est2, anio_lectivo=2026, mes=3)

    # Un hijo paga el 100% y el hermano recibe 15% de descuento (S/ 30)
    descuentos = sorted([ob_hijo1.descuento, ob_hijo2.descuento])
    assert descuentos == [Decimal("0.00"), Decimal("30.00")]

    saldos = sorted([ob_hijo1.saldo_pendiente, ob_hijo2.saldo_pendiente])
    assert saldos == [Decimal("170.00"), Decimal("200.00")]


@pytest.mark.django_db
def test_recordatorio_cobro_whatsapp(api_client, secretaria, estudiante_1):
    concepto = ConceptoPago.objects.create(nombre="Pensión Mayo 2026", monto_sugerido=Decimal("280.00"))
    ob = ObligacionPago.objects.create(
        estudiante=estudiante_1,
        concepto=concepto,
        anio_lectivo=2026,
        mes=5,
        monto=Decimal("280.00"),
        fecha_vencimiento=date(2026, 5, 5),
    )

    api_client.force_authenticate(user=secretaria)
    res = api_client.get(f"/api/finanzas/obligaciones/{ob.id}/recordatorio/")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "Juan Perez" in data["mensaje_whatsapp"]
    assert "Pensión Mayo 2026" in data["mensaje_whatsapp"]
    assert "S/ 280.00" in data["mensaje_whatsapp"]


@pytest.mark.django_db
def test_bandeja_vouchers_y_validacion(api_client, secretaria, director, estudiante_1):
    pago = Pago.objects.create(
        estudiante=estudiante_1,
        monto=Decimal("280.00"),
        metodo_pago=MetodoPago.YAPE,
        nro_operacion="YAPE-991122",
        estado=EstadoPago.PENDIENTE_VALIDACION,
    )

    api_client.force_authenticate(user=secretaria)
    # Listar bandeja de pendientes
    res_bandeja = api_client.get("/api/finanzas/pagos/vouchers-pendientes/")
    assert res_bandeja.status_code == status.HTTP_200_OK
    vouchers = res_bandeja.json()
    items = vouchers.get("results", vouchers)
    assert any(v["id"] == pago.id for v in items)

    # Validar / Aprobar voucher
    res_val = api_client.post(
        f"/api/finanzas/pagos/{pago.id}/validar-voucher/",
        {"aprobar": True, "ingreso_a_caja": True},
        format="json",
    )
    assert res_val.status_code == status.HTTP_200_OK

    pago.refresh_from_db()
    assert pago.estado == EstadoPago.CONFIRMADO


@pytest.mark.django_db
def test_exportar_telecredito_bcp(api_client, director, estudiante_1):
    concepto = ConceptoPago.objects.create(nombre="Pensión Junio 2026", monto_sugerido=Decimal("250.00"))
    ObligacionPago.objects.create(
        estudiante=estudiante_1,
        concepto=concepto,
        anio_lectivo=2026,
        mes=6,
        monto=Decimal("250.00"),
        fecha_vencimiento=date(2026, 6, 5),
    )

    api_client.force_authenticate(user=director)
    res = api_client.get("/api/finanzas/obligaciones/exportar-banco/?formato=BCP&anio_lectivo=2026&mes=6")
    assert res.status_code == status.HTTP_200_OK
    contenido = res.content.decode("utf-8")
    lineas = contenido.strip().splitlines()

    assert lineas[0].startswith("CC") # Cabecera
    assert lineas[1].startswith("DD") # Detalle alumno
    assert "77889901" in lineas[1] or "VAL-001" in lineas[1] # Código alumno
    assert lineas[2].startswith("TT") # Control totales


@pytest.mark.django_db
def test_importar_extracto_banco_conciliacion(api_client, director, estudiante_1):
    concepto = ConceptoPago.objects.create(nombre="Pensión Julio 2026", monto_sugerido=Decimal("280.00"))
    ob = ObligacionPago.objects.create(
        estudiante=estudiante_1,
        concepto=concepto,
        anio_lectivo=2026,
        mes=7,
        monto=Decimal("280.00"),
        fecha_vencimiento=date(2026, 7, 5),
    )

    # Línea simulada BCP de recaudo pagado para el DNI 77889901 con S/ 280.00 (28000 centimos)
    # Pos: DD + Codigo(15) + Nombre(35) + Venc(8) + Importe(15)
    dni_col = f"{'77889901':<15}"
    nombre_col = f"{'JUAN PEREZ':<35}"
    venc_col = "20260705"
    monto_col = f"{28000:015d}"
    linea_dd = f"DD{dni_col}{nombre_col}{venc_col}{monto_col}REF123"

    contenido_simulado = f"CC191000000000000000001234567    000120260705COLEGIO VALLEJO\r\n{linea_dd}\r\nTT000001000000000000028000\r\n"

    from io import BytesIO
    archivo = BytesIO(contenido_simulado.encode("utf-8"))
    archivo.name = "retorno_bcp.txt"

    api_client.force_authenticate(user=director)
    res = api_client.post(
        "/api/finanzas/pagos/importar-extracto-banco/",
        {"archivo": archivo},
        format="multipart",
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["conciliados"] == 1

    ob.refresh_from_db()
    assert ob.estado == EstadoObligacion.PAGADO
    assert ob.monto_pagado == Decimal("280.00")

