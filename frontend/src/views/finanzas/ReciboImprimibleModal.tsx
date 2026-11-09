import { useEffect, useState } from "react";
import { X, Printer, CheckCircle2, Building2, User, Calendar, CreditCard, Loader2 } from "lucide-react";
import { getReciboDetalle, type ReciboDetalle } from "../../services/finanzas";

interface Props {
  pagoId: number;
  onClose: () => void;
}

export default function ReciboImprimibleModal({ pagoId, onClose }: Props) {
  const [data, setData] = useState<ReciboDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReciboDetalle(pagoId)
      .then(setData)
      .catch(() => setError("No se pudo cargar la información del recibo."))
      .finally(() => setLoading(false));
  }, [pagoId]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col my-8 print:m-0 print:border-none print:shadow-none print:w-full">
        {/* Barra superior de acciones (oculta al imprimir) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" size={18} />
            <span className="text-sm font-semibold text-foreground">Comprobante de Caja</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || !!error}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              <Printer size={14} />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenido imprimible */}
        <div className="p-6 sm:p-8 space-y-6 text-foreground print:p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="text-sm">Generando recibo...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-destructive">{error}</div>
          ) : data ? (
            <div className="space-y-6 print:space-y-4" id="seccion-recibo">
              {/* Encabezado Institucional */}
              <div className="text-center border-b border-border pb-4 space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Building2 size={13} />
                  <span>{data.institucion.nombre}</span>
                </div>
                {data.institucion.codigo_modular && (
                  <p className="text-[11px] text-muted-foreground">
                    Cód. Modular: {data.institucion.codigo_modular} • UGEL: {data.institucion.ugel || "-"}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">{data.institucion.direccion || ""}</p>
                
                <div className="pt-3">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-mono text-sm font-bold tracking-tight">
                    {data.recibo.nro_recibo}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                    Recibo de Cobranza Interno
                  </p>
                </div>
              </div>

              {/* Datos del Alumno y Fecha */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-muted/30 p-3.5 rounded-xl border border-border/50">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-medium">Estudiante</span>
                  <strong className="text-sm text-foreground block">{data.estudiante.nombre_completo}</strong>
                  <span className="text-muted-foreground text-[11px]">DNI: {data.estudiante.dni}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-medium">Grado / Sección</span>
                  <strong className="text-sm text-foreground block">{data.estudiante.grado_seccion}</strong>
                  <span className="text-muted-foreground text-[11px]">Cód: {data.estudiante.codigo_matricula}</span>
                </div>
              </div>

              {/* Detalle del Cobro */}
              <div className="border border-border/70 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/70">
                    <tr>
                      <th className="py-2 px-3 text-left">Concepto</th>
                      <th className="py-2 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-foreground block">{data.concepto.nombre}</span>
                        {data.recibo.observaciones && (
                          <span className="text-[11px] text-muted-foreground">{data.recibo.observaciones}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm">
                        S/ {Number(data.recibo.monto).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-muted/40 border-t border-border/70 font-semibold">
                    <tr>
                      <td className="py-2.5 px-3 text-right text-xs">TOTAL RECIBIDO:</td>
                      <td className="py-2.5 px-3 text-right font-mono text-base text-primary">
                        S/ {Number(data.recibo.monto).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Info de Pago */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CreditCard size={13} className="text-muted-foreground" />
                  <span>Método: <strong className="text-foreground">{data.recibo.metodo_pago}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-muted-foreground" />
                  <span>Fecha: <strong className="text-foreground">{data.recibo.fecha}</strong></span>
                </div>
                {data.recibo.nro_operacion && data.recibo.nro_operacion !== "-" && (
                  <div className="col-span-2">
                    <span>N° Operación: <strong className="text-foreground font-mono">{data.recibo.nro_operacion}</strong></span>
                  </div>
                )}
                <div className="col-span-2 flex items-center gap-1.5 pt-1">
                  <User size={13} className="text-muted-foreground" />
                  <span>Cajero/a: {data.recibo.registrado_por}</span>
                </div>
              </div>

              {/* Pie de recibo */}
              <div className="pt-4 border-t border-border/50 text-center space-y-1">
                <p className="text-[10px] text-muted-foreground">
                  Comprobante emitido para control institucional interno.
                </p>
                <p className="text-[9px] text-muted-foreground/80 font-mono">
                  {data.institucion.nombre || "Institución Educativa"} • Sistema EduMWork
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
