import { useEffect, useState } from "react";
import type { LLMConfig, ProveedorInfo, ProveedorIA } from "../../types/ia";
import {
  catalogoProveedores,
  obtenerConfigIA,
  guardarConfigIA,
  eliminarConfigIA,
  probarIA,
} from "../../services/ia";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useConfirm } from "../../components/ui/Confirm";

export default function ConfigIAView() {
  const confirmar = useConfirm();
  const [catalogo, setCatalogo] = useState<ProveedorInfo[]>([]);
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const [provider, setProvider] = useState<ProveedorIA>("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState("deepseek-chat");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    Promise.all([catalogoProveedores(), obtenerConfigIA()])
      .then(([cat, cfg]) => {
        setCatalogo(cat);
        if (cfg.configurado) {
          setConfig(cfg);
          setProvider(cfg.provider);
          setModelo(cfg.modelo_default);
          setBaseUrl(cfg.base_url);
        }
      })
      .finally(() => setCargando(false));
  }, []);

  const provInfo = catalogo.find((p) => p.codigo === provider);

  function seleccionarProveedor(codigo: ProveedorIA) {
    setProvider(codigo);
    const info = catalogo.find((p) => p.codigo === codigo);
    if (info) {
      setModelo(info.modelo_default);
      setBaseUrl(info.base_url_default);
    }
  }

  async function handleGuardar() {
    setMensaje(null);
    setGuardando(true);
    try {
      const payload: Partial<LLMConfig> & { api_key?: string } = {
        provider,
        modelo_default: modelo,
        base_url: baseUrl,
        activo: true,
      };
      if (apiKey) payload.api_key = apiKey;

      const metodo = config ? "PUT" : "POST";
      const nueva = await guardarConfigIA(payload, metodo);
      setConfig(nueva);
      setApiKey("");
      setMensaje({ tipo: "ok", texto: "Configuración guardada." });
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } };
      setMensaje({ tipo: "error", texto: `Error al guardar: ${JSON.stringify(err.response?.data ?? "")}` });
    } finally {
      setGuardando(false);
    }
  }

  async function handleProbar() {
    setMensaje(null);
    setProbando(true);
    const r = await probarIA();
    setProbando(false);
    if (r.ok) {
      setMensaje({ tipo: "ok", texto: `Prueba OK. Respuesta: "${r.respuesta}"` });
      const cfg = await obtenerConfigIA();
      if (cfg.configurado) setConfig(cfg);
    } else {
      setMensaje({ tipo: "error", texto: `Prueba falló: ${r.error}` });
    }
  }

  async function handleToggleActivo() {
    if (!config) return;
    const nuevoEstado = !config.activo;
    setGuardando(true);
    try {
      const nueva = await guardarConfigIA({ activo: nuevoEstado }, "PUT");
      setConfig(nueva);
      setMensaje({ tipo: "ok", texto: nuevoEstado ? "IA institucional activada." : "IA institucional desactivada. Los docentes no podrán usarla como respaldo." });
    } catch {
      setMensaje({ tipo: "error", texto: "Error al cambiar estado." });
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    const ok = await confirmar({
      titulo: "Eliminar configuración de IA",
      mensaje: "Se borrará el proveedor, modelo y API key configurados. Las funciones que dependan de IA quedarán deshabilitadas hasta reconfigurar.",
      textoConfirmar: "Eliminar",
      variante: "peligro",
    });
    if (!ok) return;
    await eliminarConfigIA();
    setConfig(null);
    setApiKey("");
    setMensaje({ tipo: "ok", texto: "Configuración eliminada." });
  }

  if (cargando) return <div className="loading">Cargando...</div>;

  return (
    <div className="config-ia">
      <h2 className="page-title">Configuración de IA</h2>

      <Card titulo="Estado actual">
        {config ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
                background: config.activo ? "#dcfce7" : "#fee2e2",
                color: config.activo ? "#166534" : "#991b1b",
              }}>
                {config.activo ? "● ACTIVA" : "● INACTIVA"}
              </span>
              <Button
                variante={config.activo ? "peligro" : "secundario"}
                onClick={handleToggleActivo}
                cargando={guardando}
              >
                {config.activo ? "Desactivar IA institucional" : "Activar IA institucional"}
              </Button>
            </div>
            <p><strong>Proveedor:</strong> {catalogo.find((p) => p.codigo === config.provider)?.etiqueta ?? config.provider}</p>
            <p><strong>Modelo:</strong> {config.modelo_default}</p>
            <p><strong>API Key:</strong> <code>{config.key_enmascarada || "(sin key)"}</code></p>
            <p>
              <strong>Última prueba:</strong>{" "}
              {config.ultima_prueba_en
                ? `${new Date(config.ultima_prueba_en).toLocaleString("es-PE")} — ${config.ultima_prueba_ok ? "OK" : "FALLÓ"}`
                : "sin probar"}
            </p>
          </>
        ) : (
          <p style={{ color: "var(--texto-mute)" }}>Sin configuración. Elige un proveedor abajo y guarda para activar la IA.</p>
        )}
      </Card>

      <Card titulo={config ? "Actualizar configuración" : "Configurar IA"}>
        <div className="form-field">
          <label className="form-label">Proveedor</label>
          <select
            className="form-input"
            value={provider}
            onChange={(e) => seleccionarProveedor(e.target.value as ProveedorIA)}
          >
            {catalogo.map((p) => (
              <option key={p.codigo} value={p.codigo}>{p.etiqueta}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
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
          <span className="form-hint" style={{ fontSize: 11 }}>Elige del listado o escribe el nombre exacto</span>
        </div>

        {(provider === "ollama" || provider === "custom") && (
          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provInfo?.base_url_default}
          />
        )}

        <Input
          label={config ? "Nueva API Key (dejar vacío para no cambiar)" : "API Key"}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />

        {mensaje && (
          <p className={mensaje.tipo === "ok" ? "form-ok" : "form-error"}>{mensaje.texto}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Button onClick={handleGuardar} cargando={guardando}>
            {config ? "Actualizar" : "Guardar y activar"}
          </Button>
          {config && (
            <>
              <Button variante="secundario" onClick={handleProbar} cargando={probando}>
                Probar conexión
              </Button>
              <Button variante="peligro" onClick={handleEliminar}>
                Eliminar
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card titulo="Ayuda">
        <p style={{ fontSize: 13, color: "var(--texto-mute)" }}>
          <strong>DeepSeek</strong> — barato y eficaz para español. Recomendado para el demo.<br />
          <strong>Anthropic (Claude)</strong> — mejor calidad, más costoso.<br />
          <strong>Ollama local</strong> — sin costo, requiere Ollama instalado en localhost:11434.<br />
          <strong>Custom (compatible OpenAI)</strong> — para servidores propios (Odysseus, LM Studio, etc.).
        </p>
      </Card>
    </div>
  );
}
