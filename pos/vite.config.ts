import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Warehouse POS",
        short_name: "POS",
        description: "Point of Sale terminal",
        theme_color: "#2e7d32",
        background_color: "#fafafa",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // Cache all static assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Cache API responses for offline product browsing
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/products\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "products-cache", expiration: { maxEntries: 500, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:8273",
      "/media": "http://localhost:8273",
    },
  },
});
