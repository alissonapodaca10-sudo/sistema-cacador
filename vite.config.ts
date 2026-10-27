import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Served from https://<user>.github.io/sistema-cacador/ on GitHub Pages.
const base = process.env.BASE_PATH ?? "/sistema-cacador/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png", "art/*"],
      workbox: {
        // Precache the whole app, art included, so it works offline after the first visit.
        globPatterns: ["**/*.{js,css,html,png,webp,jpg,svg}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "Sistema do Caçador",
        short_name: "Caçador",
        description: "Hábitos e missões gamificados no estilo do Sistema.",
        lang: "pt-BR",
        display: "standalone",
        orientation: "portrait",
        background_color: "#02030a",
        theme_color: "#02030a",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
