import { useEffect, useRef, useState } from "react";
import { useModoUI, type ModoUI } from "../../hooks/useModoUI";
import Icon from "../ui/Icon";

const CLAVE_POSPUESTO = "sistema.modo_ui.pospuesto";

/**
 * Modal que se muestra la primera vez que un usuario entra al sistema.
 * Le pregunta si prefiere una vista simple o completa.
 * El usuario puede cambiar la elección después desde el sidebar.
 *
 * Tiene salida: "Decidir después" lo cierra por esta sesión (vuelve a
 * preguntar en el próximo ingreso) y Esc hace lo mismo. Antes era una decisión
 * forzada y, como el overlay tapa toda la pantalla sin anunciarse como
 * diálogo, quien no entendía la pregunta quedaba trabado: los clics en el
 * menú "no hacían nada" sin ninguna pista de por qué.
 */
export default function OnboardingModoUI() {
  const { yaEligió, setModo } = useModoUI();
  const [pospuesto, setPospuesto] = useState(
    () => sessionStorage.getItem(CLAVE_POSPUESTO) === "1",
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const visible = !yaEligió && !pospuesto;

  function posponer() {
    sessionStorage.setItem(CLAVE_POSPUESTO, "1");
    setPospuesto(true);
  }

  // Foco dentro del diálogo al abrir, y Esc para salir.
  useEffect(() => {
    if (!visible) return;
    panelRef.current?.focus();
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") posponer();
    };
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [visible]);

  if (!visible) return null;

  const elegir = (m: ModoUI) => setModo(m);

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div
        ref={panelRef}
        className="modal-panel modal-panel-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modo-ui-titulo"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="modo-ui-titulo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--azul-100)", color: "var(--azul-600)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="config" size={18} />
            </span>
            Bienvenido/a — ¿cómo prefieres ver el sistema?
          </h3>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: "var(--texto-mute)", marginBottom: 20 }}>
            Puedes cambiar esta elección cuando quieras desde el botón de tu nombre en el menú lateral.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <button
              type="button"
              onClick={() => elegir("simple")}
              className="modo-tarjeta"
              style={{
                textAlign: "left",
                padding: 20,
                border: "2px solid var(--borde)",
                borderRadius: 12,
                background: "var(--bg-panel)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "var(--verde-50)", color: "var(--verde-600)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 12,
              }}>
                <Icon name="ver" size={26} />
              </div>
              <h4 style={{ fontSize: 16, marginBottom: 6 }}>Modo simple</h4>
              <p style={{ fontSize: 12, color: "var(--texto-mute)", lineHeight: 1.5, marginBottom: 12 }}>
                Botones grandes, poca información en pantalla, sin gráficos.
                Ideal si prefieres una vista clara y directa.
              </p>
              <ul style={{ fontSize: 11, color: "var(--texto-mute)", paddingLeft: 16, margin: 0 }}>
                <li>Solo lo esencial</li>
                <li>Iconos y texto grande</li>
                <li>Sin números ni gráficos</li>
              </ul>
            </button>

            <button
              type="button"
              onClick={() => elegir("completo")}
              className="modo-tarjeta"
              style={{
                textAlign: "left",
                padding: 20,
                border: "2px solid var(--azul-600)",
                borderRadius: 12,
                background: "linear-gradient(180deg, var(--azul-50), white)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: "var(--azul-100)", color: "var(--azul-600)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 12,
              }}>
                <Icon name="grafico" size={26} />
              </div>
              <h4 style={{ fontSize: 16, marginBottom: 6 }}>Modo completo</h4>
              <p style={{ fontSize: 12, color: "var(--texto-mute)", lineHeight: 1.5, marginBottom: 12 }}>
                Vista profesional con KPIs, filtros, gráficos e informes.
                Recomendado si trabajas con reportes.
              </p>
              <ul style={{ fontSize: 11, color: "var(--texto-mute)", paddingLeft: 16, margin: 0 }}>
                <li>Panel completo con KPIs</li>
                <li>Gráficos y análisis</li>
                <li>Exportar Excel y Word</li>
              </ul>
            </button>
          </div>

          <p style={{ fontSize: 11, color: "var(--texto-mute)", marginTop: 20, textAlign: "center" }}>
            No te preocupes — es sólo la forma de mostrar la información.
            Todas las funciones siguen disponibles en ambos modos.
          </p>

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button
              type="button"
              onClick={posponer}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "var(--texto-mute)", textDecoration: "underline",
              }}
            >
              Decidir después
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
