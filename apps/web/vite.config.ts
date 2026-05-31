import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Inject-manifest specific Workbox options
      injectManifest: {
        globPatterns: ["**/*.{js,css,svg,png,ico,woff2,json}"],  
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Exstudeo",
        short_name: "Exstudeo",
        description: "A reader for notes and books",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        icons: [
          {
            src: "/icon.svg",
            sizes: "192x192 512x512",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/icon.svg",
            sizes: "192x192 512x512",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        // CLEAN FIX: Provide a dedicated HTML file rather than a raw JS/TS file path
        "epub-viewer": path.resolve(__dirname, "epub-viewer.html"),
      },
      output: {
        // Keeps files neatly separated without breaking Vite's internal HTML pipeline
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    },
  },
})