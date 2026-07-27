import { useEffect, useState } from "react";
import type { LLMConfig, ProveedorInfo, ProveedorIA } from "../../types/ia";
import {
  catalogoProveedores,
  obtenerMiConfigIA,
  guardarMiConfigIA,
  eliminarMiConfigIA,
  probarIA,
  type MiConfigIA,
} from "../../services/ia";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useConfirm } from "../../components/ui/Confirm";
import { useToast } from "../../components/ui/Toast";

export default function MiConfigIAView() {
  const confirmar = useConfirm();
  const toast = useToast();
  const [catalogo, setCatalogo] = useState<ProveedorInfo[]>([]);
  const [estado, setEstado] = useState<MiConfigIA | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);

  const [provider, setProvider] = useState<ProveedorIA>("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState("deepseek-chat");
  const [baseUrl, setBaseUrl] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const [cat, cfg] = await Promise.all([catalogoProveedores(), obtenerMiConfigIA()]);
      setCatalogo(cat);
      setEstado(cfg);
      if (cfg.configurado && cfg.provider) {
        setProvider(cfg.provider as ProveedorIA);
        setModelo(cfg.modelo_default ?? "");
        setBaseUrl(cfg.base_url ?? "");
      }
    } finally { setCargando(false); }
  }

  useEffect(() => { cargar(); }, []);

  function seleccionarProveedor(codigo: ProveedorIA) {
    setProvider(codigo);
    const info = catalogo.find((p) => p.codigo === codigo);
    if (info) {
      setModelo(info.modelo_default);
      setBaseUrl(info.base_url_default);
    }
  }

  async function guardar() {
    setGuardando(true);
    try {
      const payload: Partial<LLMConfig> & { api_key?: string } = {
        provider,
        modelo_default: modelo,
        base_url: baseUrl,
        activo: true,
      };
      if (apiKey) payload.api_key = apiKey;
      await guardarMiConfigIA(payload, estado?.configurado ? "PUT" : "POST");
      toast.ok("Tu configuración de IA fue guardada.");
      setApiKey("");
      cargar();
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      toast.error(`Error: ${JSON.stringify(err.response?.data ?? "sin detalle")}`);
    } finally { setGuardando(false); }
  }

  async function probar() {
    setProbando(true);
    const r = await probarIA();
    setProbando(false);
    if (r.ok) toast.ok(`Prueba OK. Respuesta: "${r.respuesta}"`);
    else toast.error(`Prueba falló: ${r.error}`);
    cargar();
  }

  async function eliminar() {
    const ok = await confirmar({
      titulo: "Eliminar tu configuración de IA",
      mensaje: estado?.tiene_institucional
        ? "Se borrará tu API key personal. Las funciones de IA seguirán funcionando con la configuración institucional (los tokens los pagará la I.E.)."
        : "Se borrará tu API key personal. Las funciones de IA quedarán deshabilitadas para ti hasta reconfigurarlas.",
      textoConfirmar: "Eliminar",
      variante: "peligro",
    });
    if (!ok) return;
    await eliminarMiConfigIA();
    setEstado({ configurado: false, tiene_institucional: estado?.tiene_institucional ?? false });
    setApiKey("");
    toast.ok("Configuración eliminada.");
  }

  if (cargando) return <p style={{ padding: 24 }}>Cargando…</p>;

  const provInfo = catalogo.find((p) => p.codigo === provider);
  const configurado = estado?.configurado ?? false;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 className="page-title">Mi configuración de IA (BYOK)</h2>

      <Card>
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          <p>
            <strong>Bring Your Own Key.</strong> Cada docente/personal puede poner su propia API key
            para usar las funciones de IA (clasificar incidencias, sugerir soluciones, etc.).
            Los tokens que consumas se cargarán a <em>tu cuenta</em> con el proveedor, no a la institución.
          </p>
          {estado?.tiene_institucional && !configurado && (
            <p style={{ marginTop: 10, padding: 10, background: "var(--azul-50)", borderRadius: 6, fontSize: 12 }}>
              💡 La I.E. tiene una configuración institucional activa ({estado.fallback_institucional_provider}).
              Si no configuras la tuya, se usará esa (pagando la institución).
            </p>
          )}
        </div>
      </Card>

      {configurado && (
        <Card titulo="Estado de tu configuración">
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            <div><strong>Proveedor:</strong> {catalogo.find((p) => p.codigo === estado?.provider)?.etiqueta ?? estado?.provider}</div>
            <div><strong>Modelo:</strong> <code style={{ fontSize: 12 }}>{estado?.modelo_default}</code></div>
            <div><strong>API key:</strong> <code style={{ fontSize: 12 }}>{estado?.key_enmascarada ?? "—"}</code></div>
            <div>
              <strong>Última prueba:</strong>{" "}
              {estado?.ultima_prueba_en ? (
                <>
                  {new Date(estado.ultima_prueba_en).toLocaleString("es-PE")} —{" "}
                  <span style={{ color: estado.ultima_prueba_ok ? "var(--verde-600)" : "var(--rojo-600)" }}>
                    {estado.ultima_prueba_ok ? "✔ OK" : "✗ Falló"}
                  </span>
                </>
              ) : "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Button onClick={probar} disabled={probando}>{probando ? "Probando..." : "Probar conexión"}</Button>
            <Button onClick={eliminar} className="btn-peligro">Eliminar mi configuración</Button>
          </div>
        </Card>
      )}

      <Card titulo={configurado ? "Editar configuración" : "Crear mi configuración"}>
        <div className="form-group">
          <label className="form-label">Proveedor</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {catalogo.map((p) => (
              <button
                key={p.codigo}
                type="button"
                onClick={() => seleccionarProveedor(p.codigo)}
                className={provider === p.codigo ? "btn btn-primario" : "btn btn-secundario"}
                style={{ padding: "8px 14px", width: "auto" }}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
          {provInfo && provInfo.modelos_sugeridos.length > 0 && (
            <p className="form-hint" style={{ fontSize: 11, marginTop: 6 }}>
              Modelos sugeridos: {provInfo.modelos_sugeridos.join(", ")}
            </p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Modelo</label>
          {provInfo && provInfo.modelos_sugeridos.length > 0 && (
            <select
              className="form-input"
              style={{ marginBottom: 6 }}
              value={provInfo.modelos_sugeridos.includes(modelo) ? modelo : ""}
              onChange={(e) => { if (e.target.value) setModelo(e.target.value); }}
            >
              <option value="">— elegir modelo —</option>
              {provInfo.modelos_sugeridos.map((m) => (
                <option key={m} value={m}>
                  {m === provInfo.modelo_recomendado ? `${m} (Recomendado)` : m}
                </option>
              ))}
            </select>
          )}
          <input
            className="form-input"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            placeholder={provInfo?.modelo_default ?? "nombre-del-modelo"}
          />
          <span className="form-hint" style={{ fontSize: 11 }}>
            Elige del listado o escribe el nombre exacto si usas otro modelo
          </span>
        </div>

        <Input
          label={`API key ${configurado ? "(dejar vacío para no cambiar)" : ""}`}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />

        {(provider === "ollama" || provider === "custom") && (
          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provInfo?.base_url_default}
          />
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button onClick={guardar} disabled={guardando || (!configurado && !apiKey)}>
            {guardando ? "Guardando..." : configurado ? "Actualizar" : "Guardar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
