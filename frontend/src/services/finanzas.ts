import api from "./api";

export interface KpisFinancieros {
  recaudacion_mes: number;
  total_deuda_vencida: number;
  morosos_count: number;
  saldo_caja: number;
  pagos_recientes: Array<{
    id: number;
    nro_recibo: string;
    estudiante: string;
    monto: string;
    metodo: string;
    fecha: string;
  }>;
}

export interface ObligacionPago {
  id: number;
  estudiante: number;
  estudiante_nombre: string;
  estudiante_dni: string;
  seccion_nombre: string;
  concepto: number;
  concepto_nombre: string;
  anio_lectivo: number;
  mes: number | null;
  monto: string;
  descuento: string;
  motivo_descuento: string;
  mora: string;
  total_a_pagar: string;
  monto_pagado: string;
  saldo_pendiente: string;
  fecha_vencimiento: string;
  estado: "PENDIENTE" | "PARCIAL" | "PAGADO" | "VENCIDO" | "EXONERADO";
  observaciones?: string;
}

export interface Pago {
  id: number;
  obligacion: number | null;
  estudiante: number;
  estudiante_nombre: string;
  concepto_nombre: string;
  nro_recibo: string;
  monto: string;
  metodo_pago: "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA" | "DEPOSITO" | "OTRO";
  nro_operacion: string;
  comprobante_img?: string | null;
  fecha_pago: string;
  registrado_por_nombre: string;
  estado: "CONFIRMADO" | "PENDIENTE_VALIDACION" | "ANULADO";
  motivo_anulacion?: string;
  ingreso_a_caja: boolean;
  emite_factura_sunat: boolean;
  tipo_comprobante_sunat: "BOLETA" | "FACTURA";
  sunat_numero_comprobante?: string;
  sunat_enlace_pdf?: string;
  sunat_enlace_xml?: string;
  sunat_enlace_cdr?: string;
  sunat_estado?: "NO_EMITIDO" | "ACEPTADO" | "RECHAZADO" | "ERROR";
}

export interface MovimientoCaja {
  id: number;
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  monto: string;
  descripcion: string;
  comprobante_tipo: string;
  comprobante_nro: string;
  responsable_nombre: string;
  fecha: string;
}

export interface ReciboDetalle {
  institucion: {
    nombre: string;
    sigla: string;
    codigo_modular: string;
    direccion: string;
    ugel: string;
  };
  recibo: {
    nro_recibo: string;
    fecha: string;
    monto: string;
    metodo_pago: string;
    nro_operacion: string;
    estado: string;
    observaciones: string;
    registrado_por: string;
  };
  estudiante: {
    nombre_completo: string;
    dni: string;
    codigo_matricula: string;
    grado_seccion: string;
  };
  concepto: {
    nombre: string;
    mes: number | null;
    saldo_restante: string;
  };
}

export async function getFinanzasKpis(): Promise<KpisFinancieros> {
  const { data } = await api.get<KpisFinancieros>("/finanzas/resumen/kpis/");
  return data;
}

export async function getObligaciones(params?: Record<string, string | number>): Promise<ObligacionPago[]> {
  const { data } = await api.get<{ results?: ObligacionPago[] } | ObligacionPago[]>("/finanzas/obligaciones/", { params });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function getPagos(params?: Record<string, string | number>): Promise<Pago[]> {
  const { data } = await api.get<{ results?: Pago[] } | Pago[]>("/finanzas/pagos/", { params });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function getVouchersPendientes(): Promise<Pago[]> {
  const { data } = await api.get<{ results?: Pago[] } | Pago[]>("/finanzas/pagos/vouchers-pendientes/");
  return Array.isArray(data) ? data : (data.results || []);
}

export async function validarVoucher(
  pagoId: number,
  payload: { aprobar: boolean; motivo?: string; ingreso_a_caja?: boolean }
): Promise<{ mensaje: string }> {
  const { data } = await api.post<{ mensaje: string }>(`/finanzas/pagos/${pagoId}/validar-voucher/`, payload);
  return data;
}

export async function emitirSunat(pagoId: number): Promise<{
  exito: boolean;
  numero_comprobante?: string;
  estado: string;
  enlace_pdf?: string;
  mensaje?: string;
}> {
  const { data } = await api.post(`/finanzas/pagos/${pagoId}/emitir-sunat/`);
  return data;
}

export async function registrarPago(payload: {
  obligacion?: number | null;
  estudiante: number;
  monto: number | string;
  metodo_pago: string;
  nro_operacion?: string;
  observaciones?: string;
  ingreso_a_caja?: boolean;
  emite_factura_sunat?: boolean;
}): Promise<Pago> {
  const { data } = await api.post<Pago>("/finanzas/pagos/", payload);
  return data;
}

export async function subirVoucherPago(formData: FormData): Promise<Pago> {
  const { data } = await api.post<Pago>("/finanzas/pagos/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function anularPago(pagoId: number, motivo: string): Promise<{ mensaje: string }> {
  const { data } = await api.post<{ mensaje: string }>(`/finanzas/pagos/${pagoId}/anular/`, { motivo });
  return data;
}

export async function getReciboDetalle(pagoId: number): Promise<ReciboDetalle> {
  const { data } = await api.get<ReciboDetalle>(`/finanzas/pagos/${pagoId}/recibo-detalle/`);
  return data;
}

export async function getRecordatorioWhatsapp(obligacionId: number): Promise<{
  estudiante: string;
  telefono: string;
  concepto: string;
  saldo_pendiente: string;
  fecha_vencimiento: string;
  mensaje_whatsapp: string;
}> {
  const { data } = await api.get(`/finanzas/obligaciones/${obligacionId}/recordatorio/`);
  return data;
}

export async function generarCronograma(payload: {
  anio_lectivo: number;
  monto_pension: number;
  monto_matricula?: number;
  seccion_id?: number | null;
  mes_inicio?: number;
  mes_fin?: number;
  dia_vencimiento?: number;
  aplicar_descuento_hermanos?: boolean;
  pct_descuento_hermano?: number;
}): Promise<{
  mensaje: string;
  total_estudiantes: number;
  obligaciones_creadas: number;
  obligaciones_existentes_omitidas: number;
}> {
  const { data } = await api.post("/finanzas/obligaciones/generar-cronograma/", payload);
  return data;
}

export async function descargarPadronBanco(formato: "BCP" | "BBVA", anio: number, mes?: number) {
  const { data } = await api.get("/finanzas/obligaciones/exportar-banco/", {
    params: { formato, anio_lectivo: anio, mes },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `PADRON_${formato}_${anio}.txt`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function importarExtractoBanco(archivo: File): Promise<{
  conciliados: number;
  omitidos: number;
  total_cobrado: number;
  errores: string[];
}> {
  const formData = new FormData();
  formData.append("archivo", archivo);
  const { data } = await api.post("/finanzas/pagos/importar-extracto-banco/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getMovimientosCaja(params?: Record<string, string | number>): Promise<MovimientoCaja[]> {
  const { data } = await api.get<{ results?: MovimientoCaja[] } | MovimientoCaja[]>("/finanzas/caja/", { params });
  return Array.isArray(data) ? data : (data.results || []);
}

export async function getBalanceCaja(): Promise<{
  total_ingresos: number;
  total_egresos: number;
  saldo_caja: number;
}> {
  const { data } = await api.get("/finanzas/caja/balance/");
  return data;
}

export async function registrarMovimientoCaja(payload: {
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  monto: number | string;
  descripcion: string;
  comprobante_tipo?: string;
  comprobante_nro?: string;
}): Promise<MovimientoCaja> {
  const { data } = await api.post<MovimientoCaja>("/finanzas/caja/", payload);
  return data;
}
