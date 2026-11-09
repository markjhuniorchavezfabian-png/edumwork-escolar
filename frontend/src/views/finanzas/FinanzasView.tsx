import { useEffect, useState } from "react";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  Users,
  Coins,
  Search,
  Filter,
  Calendar,
  Receipt,
  Printer,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  Download,
  Upload,
  Check,
  X,
  FileCheck,
  Percent,
  ExternalLink,
} from "lucide-react";
import {
  getFinanzasKpis,
  getObligaciones,
  getPagos,
  getVouchersPendientes,
  validarVoucher,
  emitirSunat,
  registrarPago,
  anularPago,
  generarCronograma,
  descargarPadronBanco,
  importarExtractoBanco,
  getRecordatorioWhatsapp,
  type KpisFinancieros,
  type ObligacionPago,
  type Pago,
} from "../../services/finanzas";
import ReciboImprimibleModal from "./ReciboImprimibleModal";

export default function FinanzasView() {
  const [kpis, setKpis] = useState<KpisFinancieros | null>(null);
  const [obligaciones, setObligaciones] = useState<ObligacionPago[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [vouchers, setVouchers] = useState<Pago[]>([]);
  const [tab, setTab] = useState<"deudas" | "vouchers" | "pagos">("deudas");
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [buscar, setBuscar] = useState<string>("");

  // Modales
  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [modalCronogramaOpen, setModalCronogramaOpen] = useState(false);
  const [modalBancoOpen, setModalBancoOpen] = useState(false);
  const [modalWhatsappOpen, setModalWhatsappOpen] = useState(false);
  const [reciboModalId, setReciboModalId] = useState<number | null>(null);

  // Form states de cobro
  const [cobroObligacion, setCobroObligacion] = useState<ObligacionPago | null>(null);
  const [montoCobro, setMontoCobro] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<string>("EFECTIVO");
  const [nroOperacion, setNroOperacion] = useState<string>("");
  const [observacionesCobro, setObservacionesCobro] = useState<string>("");
  const [ingresoCaja, setIngresoCaja] = useState<boolean>(true);
  const [emiteSunat, setEmiteSunat] = useState<boolean>(false);
  const [submittingCobro, setSubmittingCobro] = useState(false);

  // Form cronograma
  const [cronogramaAnio, setCronogramaAnio] = useState<number>(new Date().getFullYear());
  const [cronogramaPension, setCronogramaPension] = useState<string>("280.00");
  const [cronogramaMatricula, setCronogramaMatricula] = useState<string>("150.00");
  const [descHermanos, setDescHermanos] = useState<boolean>(true);
  const [pctHermanos, setPctHermanos] = useState<string>("10.00");
  const [submittingCronograma, setSubmittingCronograma] = useState(false);

  // Recordatorio WhatsApp
  const [recordatorioData, setRecordatorioData] = useState<{
    estudiante: string;
    concepto: string;
    mensaje: string;
    telefono: string;
  } | null>(null);

  // Archivo banco
  const [archivoBanco, setArchivoBanco] = useState<File | null>(null);
  const [submittingBanco, setSubmittingBanco] = useState(false);

  // Feedback
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, [filtroEstado, buscar]);

  async function cargarDatos() {
    setLoading(true);
    try {
      const [kpisRes, obligRes, pagosRes, vouchersRes] = await Promise.all([
        getFinanzasKpis(),
        getObligaciones({
          estado: filtroEstado,
          buscar: buscar,
        }),
        getPagos(),
        getVouchersPendientes(),
      ]);
      setKpis(kpisRes);
      setObligaciones(obligRes);
      setPagos(pagosRes);
      setVouchers(vouchersRes);
    } catch {
      setErrorMsg("Error cargando la información financiera.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!cobroObligacion) return;
    setSubmittingCobro(true);
    setErrorMsg(null);
    try {
      const pagoCreado = await registrarPago({
        obligacion: cobroObligacion.id,
        estudiante: cobroObligacion.estudiante,
        monto: montoCobro,
        metodo_pago: metodoPago,
        nro_operacion: nroOperacion,
        observaciones: observacionesCobro,
        ingreso_a_caja: ingresoCaja,
        emite_factura_sunat: emiteSunat,
      });
      setModalPagoOpen(false);
      setMensajeExito(`Cobro registrado con recibo ${pagoCreado.nro_recibo}`);
      setReciboModalId(pagoCreado.id);
      cargarDatos();
    } catch {
      setErrorMsg("No se pudo registrar el pago. Verifique los datos.");
    } finally {
      setSubmittingCobro(false);
    }
  }

  async function handleGenerarCronograma(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingCronograma(true);
    setErrorMsg(null);
    try {
      const res = await generarCronograma({
        anio_lectivo: cronogramaAnio,
        monto_pension: Number(cronogramaPension),
        monto_matricula: Number(cronogramaMatricula),
        mes_inicio: 3,
        mes_fin: 12,
        dia_vencimiento: 5,
        aplicar_descuento_hermanos: descHermanos,
        pct_descuento_hermano: Number(pctHermanos),
      });
      setModalCronogramaOpen(false);
      setMensajeExito(
        `Cronograma generado: ${res.obligaciones_creadas} cuotas creadas para ${res.total_estudiantes} estudiantes.`
      );
      cargarDatos();
    } catch {
      setErrorMsg("Error al generar el cronograma. Verifique que existan matrículas registradas.");
    } finally {
      setSubmittingCronograma(false);
    }
  }

  async function handleValidarVoucher(pagoId: number, aprobar: boolean) {
    const motivo = aprobar ? "" : prompt("Ingrese motivo de rechazo del comprobante:") || "Comprobante rechazado";
    try {
      await validarVoucher(pagoId, { aprobar, motivo, ingreso_a_caja: true });
      setMensajeExito(aprobar ? "Voucher aprobado y pago aplicado a la cuenta." : "Voucher rechazado.");
      cargarDatos();
    } catch {
      alert("Error al procesar el comprobante.");
    }
  }

  async function handleEmitirSunat(pagoId: number) {
    try {
      const res = await emitirSunat(pagoId);
      if (res.exito) {
        setMensajeExito(`Comprobante electrónico emitido ante SUNAT: ${res.numero_comprobante}`);
      } else {
        setErrorMsg(`SUNAT: ${res.mensaje || "Error al emitir comprobante"}`);
      }
      cargarDatos();
    } catch {
      alert("No se pudo conectar con el facturador SUNAT.");
    }
  }

  async function handleAbrirWhatsapp(obId: number) {
    try {
      const info = await getRecordatorioWhatsapp(obId);
      setRecordatorioData({
        estudiante: info.estudiante,
        concepto: info.concepto,
        mensaje: info.mensaje_whatsapp,
        telefono: info.telefono,
      });
      setModalWhatsappOpen(true);
    } catch {
      alert("No se pudo generar el recordatorio.");
    }
  }

  async function handleImportarBanco(e: React.FormEvent) {
    e.preventDefault();
    if (!archivoBanco) return;
    setSubmittingBanco(true);
    setErrorMsg(null);
    try {
      const res = await importarExtractoBanco(archivoBanco);
      setModalBancoOpen(false);
      setMensajeExito(
        `Conciliación completada: ${res.conciliados} pagos aplicados por S/ ${Number(res.total_cobrado).toFixed(2)}. (${res.omitidos} no identificados).`
      );
      cargarDatos();
    } catch {
      setErrorMsg("Error al procesar el archivo del banco. Verifique el formato.");
    } finally {
      setSubmittingBanco(false);
    }
  }

  async function handleAnularPago(pagoId: number) {
    const motivo = prompt("Ingrese el motivo de anulación del recibo:");
    if (!motivo) return;
    try {
      await anularPago(pagoId, motivo);
      setMensajeExito("Recibo anulado correctamente.");
      cargarDatos();
    } catch {
      alert("No se pudo anular el pago.");
    }
  }

  function abrirCobro(ob: ObligacionPago) {
    setCobroObligacion(ob);
    setMontoCobro(ob.saldo_pendiente);
    setMetodoPago("EFECTIVO");
    setNroOperacion("");
    setObservacionesCobro("");
    setIngresoCaja(true);
    setEmiteSunat(false);
    setModalPagoOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="text-primary" size={26} />
            Administración Financiera y Cobranzas
          </h1>
          <p className="text-sm text-muted-foreground">
            Control de pensiones, emisión de recibos internos, validación de vouchers y conciliación bancaria.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botones Nivel 3 Bancos */}
          <div className="inline-flex rounded-xl border border-input bg-background p-0.5 shadow-sm">
            <button
              onClick={() => descargarPadronBanco("BCP", cronogramaAnio)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-muted text-foreground transition-colors"
              title="Descargar padrón oficial para Telecrédito BCP"
            >
              <Download size={13} />
              BCP
            </button>
            <button
              onClick={() => descargarPadronBanco("BBVA", cronogramaAnio)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-muted text-foreground transition-colors border-l border-input"
              title="Descargar padrón oficial para BBVA Continental"
            >
              <Download size={13} />
              BBVA
            </button>
          </div>

          <button
            onClick={() => setModalBancoOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-input bg-background hover:bg-muted transition-colors text-foreground shadow-sm"
          >
            <Upload size={14} />
            Conciliar Banco
          </button>

          <button
            onClick={() => setModalCronogramaOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Calendar size={14} />
            Generar Pensiones
          </button>
        </div>
      </div>

      {/* Avisos */}
      {mensajeExito && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{mensajeExito}</span>
          </div>
          <button onClick={() => setMensajeExito(null)} className="text-xs font-semibold underline">
            Cerrar
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-semibold underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Recaudación del Mes</span>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            S/ {kpis ? Number(kpis.recaudacion_mes).toFixed(2) : "0.00"}
          </div>
          <p className="text-[11px] text-muted-foreground">Cobros confirmados en el mes activo</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Deuda Vencida</span>
            <AlertCircle size={18} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            S/ {kpis ? Number(kpis.total_deuda_vencida).toFixed(2) : "0.00"}
          </div>
          <p className="text-[11px] text-muted-foreground">Cuotas con fecha de vencimiento superada</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Alumnos Morosos</span>
            <Users size={18} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {kpis ? kpis.morosos_count : 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Estudiantes con al menos 1 cuota pendiente</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Saldo en Caja Chica</span>
            <Coins size={18} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary font-mono">
            S/ {kpis ? Number(kpis.saldo_caja).toFixed(2) : "0.00"}
          </div>
          <p className="text-[11px] text-muted-foreground">Efectivo e ingresos disponibles en portería/caja</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => setTab("deudas")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === "deudas"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock size={16} />
            Cronograma y Deudas
          </button>

          <button
            onClick={() => setTab("vouchers")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 relative ${
              tab === "vouchers"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileCheck size={16} />
            Vouchers por Validar
            {vouchers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {vouchers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setTab("pagos")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              tab === "pagos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt size={16} />
            Historial de Recibos
          </button>
        </div>
      </div>

      {/* Tab 1: Deudas */}
      {tab === "deudas" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-4 rounded-xl border border-border">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={15} />
              <input
                type="text"
                placeholder="Buscar por alumno o DNI..."
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-muted/50 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={15} className="text-muted-foreground" />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 text-xs bg-muted/50 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Todos los estados</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="VENCIDO">Vencidos / Morosos</option>
                <option value="PARCIAL">Pago Parcial</option>
                <option value="PAGADO">Pagados</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Estudiante</th>
                    <th className="py-3 px-4">Sección</th>
                    <th className="py-3 px-4">Concepto</th>
                    <th className="py-3 px-4">Vencimiento</th>
                    <th className="py-3 px-4 text-right">Monto Base</th>
                    <th className="py-3 px-4 text-right">Descuento</th>
                    <th className="py-3 px-4 text-right">Saldo Pend.</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <Loader2 className="animate-spin inline-block mr-2" size={16} />
                        Cargando cobranzas...
                      </td>
                    </tr>
                  ) : obligaciones.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        No se encontraron cuotas ni deudas registradas.
                      </td>
                    </tr>
                  ) : (
                    obligaciones.map((ob) => (
                      <tr key={ob.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <strong className="block text-foreground">{ob.estudiante_nombre}</strong>
                          <span className="text-[11px] text-muted-foreground">DNI: {ob.estudiante_dni}</span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{ob.seccion_nombre}</td>
                        <td className="py-3 px-4 font-medium text-foreground">{ob.concepto_nombre}</td>
                        <td className="py-3 px-4 text-muted-foreground">{ob.fecha_vencimiento}</td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                          S/ {Number(ob.monto).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {Number(ob.descuento) > 0 ? (
                            <span className="text-emerald-600 font-semibold" title={ob.motivo_descuento}>
                              -S/ {Number(ob.descuento).toFixed(2)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                          S/ {Number(ob.saldo_pendiente).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              ob.estado === "PAGADO"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : ob.estado === "VENCIDO"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : ob.estado === "PARCIAL"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {ob.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {ob.estado !== "PAGADO" && (
                            <>
                              <button
                                onClick={() => handleAbrirWhatsapp(ob.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Enviar Recordatorio WhatsApp"
                              >
                                <MessageCircle size={13} />
                              </button>
                              <button
                                onClick={() => abrirCobro(ob)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                              >
                                <Coins size={13} />
                                Cobrar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Vouchers por Validar (Nivel 2) */}
      {tab === "vouchers" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
          <div className="p-4 border-b border-border bg-muted/40">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileCheck className="text-primary" size={16} />
              Bandeja de Comprobantes Yape/Transferencia enviados por Apoderados
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revise los vouchers cargados y concilie la cuota en un solo clic.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4">Medio</th>
                  <th className="py-3 px-4">N° Operación</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center">Voucher Adjunto</th>
                  <th className="py-3 px-4 text-right">Decisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No hay vouchers pendientes de validación en este momento.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="block text-foreground">{v.estudiante_nombre}</strong>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(v.fecha_pago).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{v.concepto_nombre}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-muted text-[11px] font-medium">
                          {v.metodo_pago}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">{v.nro_operacion || "-"}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        S/ {Number(v.monto).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {v.comprobante_img ? (
                          <a
                            href={v.comprobante_img}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                          >
                            <ExternalLink size={12} /> Ver Imagen
                          </a>
                        ) : (
                          <span className="text-muted-foreground italic">Sin archivo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleValidarVoucher(v.id, false)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X size={13} /> Rechazar
                        </button>
                        <button
                          onClick={() => handleValidarVoucher(v.id, true)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <Check size={13} /> Aprobar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Pagos y Facturación */}
      {tab === "pagos" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">N° Recibo</th>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Concepto</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center">Estado Fiscal</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      No hay pagos registrados.
                    </td>
                  </tr>
                ) : (
                  pagos.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary">{p.nro_recibo}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{p.estudiante_nombre}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.concepto_nombre}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(p.fecha_pago).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-muted text-[11px] font-medium">
                          {p.metodo_pago}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        S/ {Number(p.monto).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.sunat_numero_comprobante ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 font-mono">
                              SUNAT: {p.sunat_numero_comprobante}
                            </span>
                            {p.sunat_enlace_pdf && (
                              <a
                                href={p.sunat_enlace_pdf}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-primary hover:underline"
                              >
                                PDF Oficial
                              </a>
                            )}
                          </div>
                        ) : p.estado === "CONFIRMADO" ? (
                          <button
                            onClick={() => handleEmitirSunat(p.id)}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground"
                            title="Emitir comprobante electrónico ante SUNAT"
                          >
                            + Emitir SUNAT
                          </button>
                        ) : (
                          <span className="text-[10px] text-destructive">{p.estado}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => setReciboModalId(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-input bg-background hover:bg-muted transition-colors text-foreground"
                          title="Ver e Imprimir Recibo"
                        >
                          <Printer size={13} />
                          Recibo
                        </button>
                        {p.estado === "CONFIRMADO" && (
                          <button
                            onClick={() => handleAnularPago(p.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Anular comprobante"
                          >
                            <Ban size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Registrar Cobro */}
      {modalPagoOpen && cobroObligacion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Coins className="text-primary" size={20} />
                Registrar Pago de Cuota
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cobroObligacion.concepto_nombre} • {cobroObligacion.estudiante_nombre}
              </p>
            </div>

            <form onSubmit={handleRegistrarPago} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Monto a cobrar (S/)</label>
                <input
                  type="number"
                  step="0.10"
                  required
                  value={montoCobro}
                  onChange={(e) => setMontoCobro(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-[10px] text-muted-foreground block mt-1">
                  Saldo pendiente con descuentos/mora: S/ {cobroObligacion.saldo_pendiente}
                </span>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Medio de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                >
                  <option value="EFECTIVO">Efectivo (Caja)</option>
                  <option value="YAPE">Yape</option>
                  <option value="PLIN">Plin</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria (BCP/BBVA)</option>
                  <option value="DEPOSITO">Depósito en Ventanilla</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">N° Operación (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 987123"
                  value={nroOperacion}
                  onChange={(e) => setNroOperacion(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  value={observacionesCobro}
                  onChange={(e) => setObservacionesCobro(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground text-xs">
                  <input
                    type="checkbox"
                    checked={ingresoCaja}
                    onChange={(e) => setIngresoCaja(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Ingresar a Caja Chica física</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-muted-foreground text-xs">
                  <input
                    type="checkbox"
                    checked={emiteSunat}
                    onChange={(e) => setEmiteSunat(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span>Emitir Boleta Electrónica a SUNAT automáticamente</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalPagoOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-input hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCobro}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingCobro ? <Loader2 size={13} className="animate-spin" /> : <Coins size={13} />}
                  Confirmar Cobro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Generar Cronograma Anual con Descuento Hermanos */}
      {modalCronogramaOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="text-primary" size={20} />
                Generar Cronograma de Pensiones
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crea las cuotas de Marzo a Diciembre para los estudiantes matriculados.
              </p>
            </div>

            <form onSubmit={handleGenerarCronograma} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Año Lectivo</label>
                <input
                  type="number"
                  required
                  value={cronogramaAnio}
                  onChange={(e) => setCronogramaAnio(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Pensión Mensual Base (S/)</label>
                <input
                  type="number"
                  step="1.00"
                  required
                  value={cronogramaPension}
                  onChange={(e) => setCronogramaPension(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Matrícula (S/, opcional)</label>
                <input
                  type="number"
                  step="1.00"
                  value={cronogramaMatricula}
                  onChange={(e) => setCronogramaMatricula(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                />
              </div>

              {/* Opción Nivel 1: Descuento Hermanos */}
              <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-2">
                <label className="flex items-center gap-2 font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={descHermanos}
                    onChange={(e) => setDescHermanos(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary"
                  />
                  <span className="flex items-center gap-1.5">
                    <Percent size={13} className="text-primary" />
                    Aplicar descuento automático por hermanos
                  </span>
                </label>

                {descHermanos && (
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">% descuento al 2do+ hermano:</span>
                    <input
                      type="number"
                      value={pctHermanos}
                      onChange={(e) => setPctHermanos(e.target.value)}
                      className="w-20 px-2 py-1 bg-background border border-input rounded-lg font-mono text-xs"
                    />
                    <span className="text-muted-foreground text-[11px]">%</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalCronogramaOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-input hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCronograma}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingCronograma ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
                  Generar Cuotas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Recordatorio WhatsApp */}
      {modalWhatsappOpen && recordatorioData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <MessageCircle className="text-emerald-500" size={18} />
              Recordatorio de Cobro para Familia
            </h2>
            <p className="text-xs text-muted-foreground">
              Mensaje personalizado listo para enviar al apoderado de {recordatorioData.estudiante}:
            </p>

            <div className="p-3.5 bg-muted/40 rounded-xl border border-border/80 font-mono text-xs text-foreground whitespace-pre-wrap">
              {recordatorioData.mensaje}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setModalWhatsappOpen(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-input hover:bg-muted"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(recordatorioData.mensaje);
                  alert("Texto copiado al portapapeles.");
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Copiar Texto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Conciliar Banco */}
      {modalBancoOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Upload className="text-primary" size={18} />
              Conciliación Bancaria Automática
            </h2>
            <p className="text-xs text-muted-foreground">
              Suba el archivo de recaudación devuelto por BCP (Telecrédito) o BBVA para aplicar los pagos masivamente.
            </p>

            <form onSubmit={handleImportarBanco} className="space-y-4">
              <input
                type="file"
                accept=".txt"
                required
                onChange={(e) => setArchivoBanco(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalBancoOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-input hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingBanco || !archivoBanco}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submittingBanco ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Procesar Extracto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Recibo */}
      {reciboModalId && (
        <ReciboImprimibleModal
          pagoId={reciboModalId}
          onClose={() => setReciboModalId(null)}
        />
      )}
    </div>
  );
}
