import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Red de contención para errores de render.
 *
 * Sin esto, cualquier excepción en una vista desmonta el árbol entero y el
 * usuario queda mirando una pantalla en blanco, sin mensaje ni forma de salir
 * — pasa igual en el colegio que en una demo frente al director. React lo
 * venía avisando por consola ("Consider adding an error boundary").
 *
 * Se monta por dentro del Layout, así el menú lateral sobrevive y la persona
 * puede irse a otra pantalla sin recargar.
 */

interface Props {
  children: ReactNode;
  /** Cambiar este valor remonta el boundary. Se le pasa la ruta actual. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en la consola del navegador para que soporte lo pida por captura.
    console.error("Error no controlado en una vista:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // Al navegar a otra ruta, dejar de mostrar el error de la anterior.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__caja">
          <h2>Esta pantalla tuvo un problema</h2>
          <p>
            No se perdió nada de lo que ya estaba guardado. Puedes volver a intentar,
            o usar el menú para ir a otra sección.
          </p>
          <div className="error-boundary__acciones">
            <button className="btn btn-primario" onClick={() => this.setState({ error: null })}>
              Reintentar
            </button>
            <button className="btn btn-secundario" onClick={() => window.location.reload()}>
              Recargar la página
            </button>
          </div>
          <details>
            <summary>Detalle técnico (para soporte)</summary>
            <code>{this.state.error.message}</code>
          </details>
        </div>
      </div>
    );
  }
}
