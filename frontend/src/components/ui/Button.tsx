import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "primario" | "secundario" | "peligro";
  cargando?: boolean;
}

export default function Button({ variante = "primario", cargando, children, ...props }: Props) {
  return (
    <button className={`btn btn-${variante}`} disabled={cargando || props.disabled} {...props}>
      {cargando ? "Cargando..." : children}
    </button>
  );
}
