import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"

// https://vite.dev/config/
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
        // Include font files (woff2) in the precache manifest for offline use.
        // Also includes the built viewer script (epub-assets/epub-viewer.js)
        // and the viewer stylesheet (epub-assets/epub-style.css).
        globPatterns: ["**/*.{js,css,html,json,png,svg,ico,woff2}"],
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
        "icons": [
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
        "epub-assets/epub-viewer": path.resolve(__dirname, "src/viewer/epub-viewer.ts"),
      },
      output: {
        // Keep the viewer script name stable (no hash) so the SW can
        // inject it with a fixed path: /epub-assets/epub-viewer.js
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "epub-assets/epub-viewer") {
            return "epub-assets/epub-viewer.js"
          }
          return "assets/[name]-[hash].js"
        },
      },
    },
  },
})
