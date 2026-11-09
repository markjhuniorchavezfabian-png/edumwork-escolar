import { useEffect, useState } from "react";
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";
import {
  getBalanceCaja,
  getMovimientosCaja,
  registrarMovimientoCaja,
  type MovimientoCaja,
} from "../../services/finanzas";

export default function CajaChicaView() {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [balance, setBalance] = useState<{
    total_ingresos: number;
    total_egresos: number;
    saldo_caja: number;
  }>({ total_ingresos: 0, total_egresos: 0, saldo_caja: 0 });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("");

  // Modal nuevo movimiento
  const [modalOpen, setModalOpen] = useState(false);
  const [tipo, setTipo] = useState<"INGRESO" | "EGRESO">("EGRESO");
  const [categoria, setCategoria] = useState<string>("MATERIALES");
  const [monto, setMonto] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");
  const [comprobanteTipo, setComprobanteTipo] = useState<string>("RECIBO_INTERNO");
  const [comprobanteNro, setComprobanteNro] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Feedback
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, [filtroTipo]);

  async function cargarDatos() {
    setLoading(true);
    try {
      const [balRes, movRes] = await Promise.all([
        getBalanceCaja(),
        getMovimientosCaja(filtroTipo ? { tipo: filtroTipo } : undefined),
      ]);
      setBalance(balRes);
      setMovimientos(movRes);
    } catch {
      setErrorMsg("Error cargando los movimientos de caja chica.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await registrarMovimientoCaja({
        tipo,
        categoria,
        monto,
        descripcion,
        comprobante_tipo: comprobanteTipo,
        comprobante_nro: comprobanteNro,
      });
      setModalOpen(false);
      setMensajeExito("Movimiento registrado en Caja Chica.");
      setMonto("");
      setDescripcion("");
      setComprobanteNro("");
      cargarDatos();
    } catch {
      setErrorMsg("No se pudo registrar el movimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Coins className="text-primary" size={26} />
            Caja Chica y Flujo Diario
          </h1>
          <p className="text-sm text-muted-foreground">
            Libro de ingresos y egresos menores de administración, dirección y portería.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <PlusCircle size={15} />
          Nuevo Movimiento
        </button>
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

      {/* Tarjetas de Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Ingresos</span>
            <ArrowDownLeft size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            S/ {Number(balance.total_ingresos).toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground">Cobros de pensión y aportes recibidos en efectivo</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Egresos</span>
            <ArrowUpRight size={18} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
            S/ {Number(balance.total_egresos).toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground">Compras menores, servicios y mantenimiento</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Saldo Disponible en Caja</span>
            <Coins size={18} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary font-mono">
            S/ {Number(balance.saldo_caja).toFixed(2)}
          </div>
          <p className="text-[11px] text-muted-foreground">Arqueo físico neto en custodia</p>
        </div>
      </div>

      {/* Filtro y Tabla */}
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Movimientos Registrados
          </span>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-1.5 text-xs bg-muted/50 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Todos los movimientos</option>
              <option value="INGRESO">Solo Ingresos</option>
              <option value="EGRESO">Solo Egresos</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Comprobante</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="animate-spin inline-block mr-2" size={16} />
                      Cargando libro de caja...
                    </td>
                  </tr>
                ) : movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No hay movimientos de caja registrados.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            m.tipo === "INGRESO"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {m.tipo === "INGRESO" ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                          {m.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(m.fecha).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{m.descripcion}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-muted text-[11px] font-medium">
                          {m.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono">
                        {m.comprobante_nro || "-"}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          m.tipo === "INGRESO"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {m.tipo === "INGRESO" ? "+" : "-"} S/ {Number(m.monto).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{m.responsable_nombre}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Nuevo Movimiento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Coins className="text-primary" size={20} />
                Registrar Movimiento en Caja
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ingreso o egreso manual para el arqueo de caja chica institucional.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipo("EGRESO")}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 ${
                    tipo === "EGRESO"
                      ? "bg-rose-500/10 border-rose-500 text-rose-600 font-bold"
                      : "border-input bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <ArrowUpRight size={14} />
                  Egreso (Gasto)
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("INGRESO")}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 ${
                    tipo === "INGRESO"
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 font-bold"
                      : "border-input bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <ArrowDownLeft size={14} />
                  Ingreso Extra
                </button>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Monto (S/)</label>
                <input
                  type="number"
                  step="0.10"
                  required
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                >
                  {tipo === "EGRESO" ? (
                    <>
                      <option value="MATERIALES">Materiales y Útiles</option>
                      <option value="MANTENIMIENTO">Mantenimiento e Infraestructura</option>
                      <option value="SERVICIOS">Servicios Básicos (Luz, Agua, Internet)</option>
                      <option value="REFRIGERIOS">Refrigerios y Eventos</option>
                      <option value="HONORARIOS">Honorarios / Servicios Terceros</option>
                      <option value="OTRO">Otro Egreso</option>
                    </>
                  ) : (
                    <>
                      <option value="APORTE_APAFA">Aporte APAFA</option>
                      <option value="DONACION">Donación</option>
                      <option value="PENSION_COBRADA">Cobro de pensión/matrícula</option>
                      <option value="OTRO">Otro Ingreso</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Descripción / Motivo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Compra de plumones y papel bond para docentes"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Tipo de Comprobante</label>
                  <select
                    value={comprobanteTipo}
                    onChange={(e) => setComprobanteTipo(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                  >
                    <option value="RECIBO_INTERNO">Recibo Interno</option>
                    <option value="BOLETA_FISCAL">Boleta Física</option>
                    <option value="FACTURA_FISCAL">Factura Física</option>
                    <option value="SIN_COMPROBANTE">Sin Comprobante</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-foreground mb-1">N° Comprobante Físico</label>
                  <input
                    type="text"
                    placeholder="Ej: B001-492"
                    value={comprobanteNro}
                    onChange={(e) => setComprobanteNro(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/40 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-input hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Coins size={13} />}
                  Registrar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
