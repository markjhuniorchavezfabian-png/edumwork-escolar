import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface UseQrScannerOpts {
  contenedorId: string;
  onCodigo: (codigo: string) => void | Promise<void>;
  debounceMs?: number;
  qrbox?: number;
  fps?: number;
}

/**
 * Hook reutilizable para escanear QR con html5-qrcode.
 * Maneja: inicio de cámara, debounce por código repetido, limpieza al desmontar.
 * Reemplaza la lógica duplicada de EscanerQR y EscanerInventario.
 */
export function useQrScanner({
  contenedorId,
  onCodigo,
  debounceMs = 3000,
  qrbox = 260,
  fps = 10,
}: UseQrScannerOpts) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const ultimo = useRef<{ codigo: string; ts: number }>({ codigo: "", ts: 0 });
  const [escaneando, setEscaneando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(contenedorId);
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps, qrbox: { width: qrbox, height: qrbox } },
      async (codigo) => {
        const ahora = Date.now();
        if (ultimo.current.codigo === codigo && ahora - ultimo.current.ts < debounceMs) return;
        ultimo.current = { codigo, ts: ahora };
        await onCodigo(codigo);
      },
      () => { /* onFailure de frame: ignorar */ },
    )
      .then(() => setEscaneando(true))
      .catch((e) => setError(`No se pudo acceder a la cámara: ${e}`));

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop()
          .catch(() => { /* stop puede fallar si ya está detenido */ })
          .finally(() => scannerRef.current?.clear());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { escaneando, error };
}
