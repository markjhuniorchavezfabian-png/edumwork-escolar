import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useInstitucion } from "../../context/InstitucionContext";
import Icon from "../../components/ui/Icon";

interface Seccion { id: number; nombre: string; grado: string; letra: string; cantidad_estudiantes: number; }
interface EstudianteQR { id: number; nombre: string; codigo_matricula: string; qr_url: string; }

export default function ImprimirQRsView() {
  const [params] = useSearchParams();
  const institucion = useInstitucion();
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [seccionId, setSeccionId] = useState<number | null>(null);
  const [estudiantes, setEstudiantes] = useState<EstudianteQR[]>([]);
  const [qrsBlobs, setQrsBlobs] = useState<Record<number, string>>({});
  const [seccionNombre, setSeccionNombre] = useState("");

  useEffect(() => {
    api.get<Seccion[]>("/asistencia/secciones/mis/").then(({ data }) => {
      setSecciones(data);
      const pre = params.get("seccion");
      const inicial = pre ? Number(pre) : data[0]?.id;
      if (inicial) setSeccionId(inicial);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!seccionId) return;
    api.get(`/asistencia/secciones/${seccionId}/qrs/`).then(({ data }) => {
      setEstudiantes(data.estudiantes);
      setSeccionNombre(data.seccion.nombre);
      // Cargar cada QR con auth
      data.estudiantes.forEach((e: EstudianteQR) => {
        if (e.qr_url) {
          api.get(e.qr_url.replace("/api", ""), { responseType: "blob" }).then((resp) => {
            const url = URL.createObjectURL(resp.data);
            setQrsBlobs((prev) => ({ ...prev, [e.id]: url }));
          });
        }
      });
    });
  }, [seccionId]);

  return (
    <div className="qrs-print-wrap">
      <div className="qrs-toolbar no-print">
        <button className="btn btn-secundario" onClick={() => window.history.back()} style={{ padding: "8px 14px" }}>
          ← Volver
        </button>
        <div className="form-field" style={{ margin: 0 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Sección</label>
          <select className="form-input" value={seccionId ?? ""} onChange={(e) => setSeccionId(Number(e.target.value))}>
            {secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre} ({s.cantidad_estudiantes})</option>)}
          </select>
        </div>
        <button className="btn btn-primario btn-icono" onClick={() => window.print()} style={{ padding: "8px 14px", width: "auto" }}>
          <Icon name="impresora" /> Imprimir
        </button>
      </div>

      <div className="qrs-hoja">
        <div className="qrs-encabezado">
          <div>
            <div className="qrs-inst">{institucion.nombre.toUpperCase()}</div>
            <div className="qrs-sub">Carnets QR de asistencia · Sección {seccionNombre}</div>
          </div>
          <div className="qrs-sub">Generado: {new Date().toLocaleDateString("es-PE")}</div>
        </div>

        <div className="qrs-grilla">
          {estudiantes.map((e) => (
            <div key={e.id} className="qr-carnet">
              <div className="qr-carnet-header">{institucion.nombre}</div>
              {qrsBlobs[e.id] ? (
                <img src={qrsBlobs[e.id]} alt={`QR ${e.codigo_matricula}`} />
              ) : (
                <div className="qr-cargando">Cargando...</div>
              )}
              <div className="qr-carnet-nombre">{e.nombre}</div>
              <div className="qr-carnet-codigo">{e.codigo_matricula}</div>
              <div className="qr-carnet-seccion">{seccionNombre}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
