import { useState } from "react";
import api from "../services/api";
import Card from "../components/ui/Card";
import { useToast } from "../components/ui/Toast";

interface ImportResult {
  ok: boolean;
  version: string;
  creados: { areas: number; competencias: number; capacidades: number; desempenos: number };
  mensaje: string;
}

export default function EditarCurriculoView() {
  const toast = useToast();
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function importarCNEB(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportando(true);
    setImportResult(null);
    try {
      const texto = await file.text();
      const json = JSON.parse(texto);
      const { data } = await api.post<ImportResult>("/curricula/importar/", json);
      setImportResult(data);
      toast.ok(data.mensaje);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(e2.response?.data?.error ?? e2.message ?? "Error al importar.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <div>
      <h2 className="page-title">Currículo — CNEB</h2>
      <p style={{ color: "var(--muted-foreground)", marginBottom: 16, fontSize: 14 }}>
        Importá el JSON del CNEB para cargar o actualizar competencias, capacidades y desempeños.
        Cuando MINEDU publique una nueva versión, subís el JSON y listo — sin tocar código.
      </p>

      <Card titulo="Importar CNEB desde JSON">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0, flex: 1 }}>
            El archivo debe tener la estructura estándar del CNEB con niveles, áreas, competencias,
            capacidades y desempeños. Los registros existentes se actualizan; los nuevos se crean.
            No se elimina nada.
          </p>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 8, cursor: importando ? "not-allowed" : "pointer",
            background: importando ? "var(--muted)" : "var(--azul-700)",
            color: "#fff", fontSize: 14, fontWeight: 600,
            opacity: importando ? 0.6 : 1, whiteSpace: "nowrap",
          }}>
            {importando ? "Importando…" : "Seleccionar JSON"}
            <input
              type="file" accept=".json" onChange={importarCNEB}
              disabled={importando}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {importResult && (
          <div style={{
            marginTop: 16, padding: "12px 16px", borderRadius: 8,
            background: "var(--azul-50)", border: "1px solid var(--azul-200)",
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--azul-700)", marginBottom: 8 }}>
              Importación completada — {importResult.version}
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {(["areas", "competencias", "capacidades", "desempenos"] as const).map(k => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--azul-700)" }}>
                    {importResult.creados[k]}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{k} nuevos</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--foreground)", display: "block", marginBottom: 6 }}>
            Formato esperado del JSON
          </strong>
          <pre style={{
            background: "var(--fondo)", border: "1px solid var(--borde)",
            borderRadius: 6, padding: "10px 14px", fontSize: 12,
            overflowX: "auto", margin: 0,
          }}>{`{
  "version": "CNEB 2016 (actualizado DS 007-2021-MINEDU)",
  "niveles": [
    {
      "nivel": "primaria",
      "areas": [
        {
          "nombre": "Comunicación",
          "orden": 1,
          "competencias": [
            {
              "numero": 1,
              "nombre": "Se comunica oralmente en su lengua materna",
              "capacidades": [
                { "orden": 1, "nombre": "Obtiene información del texto oral" }
              ],
              "desempenos": [
                { "grado": "p1", "orden": 1, "descripcion": "..." }
              ]
            }
          ]
        }
      ]
    }
  ]
}`}</pre>
          <p style={{ marginTop: 10, marginBottom: 0 }}>
            Niveles válidos: <code>inicial</code>, <code>primaria</code>, <code>secundaria</code>.
            Grados: <code>i3a</code>, <code>i4a</code>, <code>i5a</code> / <code>p1</code>–<code>p6</code> / <code>s1</code>–<code>s5</code>.
          </p>
        </div>
      </Card>
    </div>
  );
}
