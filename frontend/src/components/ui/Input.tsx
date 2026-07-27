import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, ...props }: Props) {
  return (
    <div className="form-field">
      {label && <label className="form-label">{label}</label>}
      <input className={`form-input ${error ? "form-input-error" : ""}`} {...props} />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
