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

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: devAllowedHosts,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
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
