import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { obtenerCostosIA, type CostosIA } from "../../services/ia";
import Card from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/Spinner";
import Icon from "../../components/ui/Icon";

const UMBRAL_ALERTA_USD = 5.0;

export default function CostosIAView() {
  const [datos, setDatos] = useState<CostosIA | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerCostosIA()
      .then(setDatos)
      .catch((e) => setError(e.response?.data?.detail ?? "No se pudo cargar el uso de IA."))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <p style={{ padding: 24 }}>Cargando…</p>;
  if (error) return <EmptyState icono="alerta" titulo="Error" descripcion={error} />;
  if (!datos) return null;

  const sinUso = datos.total_historico.requests === 0;
  const alertaMes = datos.mes.costo_usd >= UMBRAL_ALERTA_USD;

  return (
    <div>
      <h2 className="page-title">Costos de IA</h2>

      {sinUso ? (
        <EmptyState icono="info" titulo="Sin uso de IA todavía"
          descripcion="Cuando alguien use clasificación, sugerencia de solución o resumen ejecutivo, verás aquí los tokens y costo." />
      ) : (
        <>
          {alertaMes && (
            <div style={{
              padding: 12, marginBottom: 16, borderRadius: 8,
              background: "var(--amarillo-50)", border: "1px solid var(--amarillo-600)",
              fontSize: 13,
            }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="alerta" size={14} style={{ color: "var(--amarillo-600)" }} /> El gasto mensual (US$ {datos.mes.costo_usd.toFixed(4)}) superó el umbral de referencia</span>
              de US$ {UMBRAL_ALERTA_USD.toFixed(2)}. Revisa el volumen de requests.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
            <KpiTarjeta titulo="Hoy" kpi={datos.hoy} />
            <KpiTarjeta titulo="Este mes" kpi={datos.mes} destacado={alertaMes} />
            <KpiTarjeta titulo="Histórico" kpi={datos.total_historico} />
            <Card>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--texto-mute)" }}>Tasa de error (30d)</div>
              <div style={{ fontSize: 26, fontWeight: 600, color: datos.tasa_error_30d > 5 ? "var(--rojo-600)" : "var(--verde-600)" }}>
                {datos.tasa_error_30d}%
              </div>
              <div style={{ fontSize: 12, color: "var(--texto-mute)" }}>
                {datos.errores_30d} requests fallidos
              </div>
            </Card>
          </div>

          <Card titulo="Gasto y volumen (últimos 30 días)">
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={datos.serie_30d} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--slate-200)" strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} tickFormatter={(f) => f.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v, name) =>
                      name === "costo_usd"
                        ? [`US$ ${Number(v).toFixed(6)}`, "Costo"]
                        : [String(v), "Requests"]
                    }
                  />
                  <Line yAxisId="left" type="monotone" dataKey="requests" stroke="#2E75B6" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="costo_usd" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 11, color: "var(--texto-mute)", display: "flex", gap: 16, marginTop: 4 }}>
              <span>■ Requests (eje izq)</span>
              <span style={{ color: "#16a34a" }}>■ Costo US$ (eje der)</span>
            </div>
          </Card>

          <Card titulo="Reparto de gasto (30 días)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 12, background: "var(--verde-50)", borderRadius: 6 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--verde-600)" }}>
                  BYOK (docentes con API propia)
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>
                  US$ {datos.reparto_byok_30d.propia.costo_usd.toFixed(4)}
                </div>
                <div style={{ fontSize: 12, color: "var(--texto-mute)" }}>
                  {datos.reparto_byok_30d.propia.requests} requests · no lo paga la I.E.
                </div>
              </div>
              <div style={{ padding: 12, background: "var(--amarillo-50)", borderRadius: 6 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--amarillo-600)" }}>
                  Institucional (paga la I.E.)
                </div>
                <div style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>
                  US$ {datos.reparto_byok_30d.institucional.costo_usd.toFixed(4)}
                </div>
                <div style={{ fontSize: 12, color: "var(--texto-mute)" }}>
                  {datos.reparto_byok_30d.institucional.requests} requests · fallback
                </div>
              </div>
            </div>
          </Card>

          {datos.top_usuarios_institucional_30d.length > 0 && (
            <Card titulo="Top usuarios que gastan de la I.E. (30d)">
              <p style={{ fontSize: 12, color: "var(--texto-mute)", marginBottom: 8 }}>
                Estos usuarios no configuraron BYOK. Considera pedirles que activen su API personal en <code>Mi API de IA</code>.
              </p>
              <table className="tabla-incidencias">
                <thead>
                  <tr><th>Usuario</th><th style={{ textAlign: "right" }}>Requests</th><th style={{ textAlign: "right" }}>Costo (US$)</th></tr>
                </thead>
                <tbody>
                  {datos.top_usuarios_institucional_30d.map((u) => (
                    <tr key={u.username}>
                      <td>{u.nombre} <code style={{ fontSize: 11, color: "var(--texto-mute)" }}>@{u.username}</code></td>
                      <td style={{ textAlign: "right" }}>{u.requests}</td>
                      <td style={{ textAlign: "right" }}>{u.costo_usd.toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card titulo="Endpoints más usados (30d)">
            {datos.top_endpoints_30d.length === 0 ? (
              <EmptyState icono="grafico" titulo="Sin datos" descripcion="No hay actividad en los últimos 30 días." />
            ) : (
              <table className="tabla-incidencias">
                <thead>
                  <tr><th>Endpoint</th><th style={{ textAlign: "right" }}>Requests</th><th style={{ textAlign: "right" }}>Costo (US$)</th></tr>
                </thead>
                <tbody>
                  {datos.top_endpoints_30d.map((e) => (
                    <tr key={e.endpoint}>
                      <td><code style={{ fontSize: 12 }}>{e.endpoint || "—"}</code></td>
                      <td style={{ textAlign: "right" }}>{e.requests}</td>
                      <td style={{ textAlign: "right" }}>{e.costo_usd.toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function KpiTarjeta({ titulo, kpi, destacado }: { titulo: string; kpi: { requests: number; tokens_in: number; tokens_out: number; costo_usd: number }; destacado?: boolean }) {
  return (
    <Card>
      <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--texto-mute)" }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: destacado ? "var(--amarillo-600)" : "var(--texto)" }}>
        US$ {kpi.costo_usd.toFixed(4)}
      </div>
      <div style={{ fontSize: 12, color: "var(--texto-mute)" }}>
        {kpi.requests} requests · {(kpi.tokens_in + kpi.tokens_out).toLocaleString("es-PE")} tokens
      </div>
    </Card>
  );
}
