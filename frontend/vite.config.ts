import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:8000";

// Hosts extra permitidos por el dev server (túneles ngrok/cloudflared para demos).
// Por env, para no dejar el túnel de turno escrito en el repo del producto:
//   VITE_DEV_ALLOWED_HOSTS=algo.ngrok-free.dev npm run dev
const devAllowedHosts = (process.env.VITE_DEV_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

// Config compartida entre `dev` y `preview`. `preview` sirve el build real
// (el mismo que ve el cliente) y necesita el mismo proxy de /api, si no las
// llamadas al backend caen en el 404 del server de estáticos. Es lo que se usa
// para mostrar la demo por un túnel.
const servidorLocal = {
  host: "0.0.0.0",
  allowedHosts: devAllowedHosts,
  proxy: {
    "/api": { target: apiProxyTarget, changeOrigin: true },
    "/media": { target: apiProxyTarget, changeOrigin: true },
  },
};

export default defineConfig({
  plugins: [react()],
  server: { ...servidorLocal, port: 5173 },
  preview: { ...servidorLocal, port: 4173 },
  build: {
    minify: "esbuild",
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      output: {
        // Solo React va en un chunk fijo: es lo único que necesita sí o sí la
        // primera pantalla. recharts y html5-qrcode salían acá también, y al
        // ser chunks declarados Vite les ponía `modulepreload` en el index:
        // 400 kB de gráficos descargados para ver el login. Ahora que las
        // vistas son lazy, Rollup los agrupa solo, y viajan con la vista que
        // de verdad los usa.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
