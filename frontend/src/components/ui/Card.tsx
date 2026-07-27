interface Props {
  titulo?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Card({ titulo, children, className = "" }: Props) {
  return (
    <div className={`card ${className}`}>
      {titulo && <div className="card-header">{titulo}</div>}
      <div className="card-body">{children}</div>
    </div>
  );
}
