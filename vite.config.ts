import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// The production build lands directly in the backend's static resource folder
// (../BE/src/main/resources/static), so `mvn spring-boot:run` serves the freshly built SPA — see
// Tessera/BE/pom.xml's frontend-maven-plugin. `emptyOutDir: true` is required because that folder is
// outside this UI project's own root. During day-to-day UI work you still use `npm run dev` (HMR)
// instead; the bundle is the production-like one-command run, an additive convenience, not a
// replacement for the standalone dev server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../BE/src/main/resources/static',
    emptyOutDir: true,
  },
  server: {
    port: 5050,
    proxy: {
      // Tessera's own API.
      '/api': 'http://localhost:8100',
      // Innoventa Central (shared translations) — rewritten to /api on Central so the browser sees a
      // same-origin call and no CORS is involved. Central accepts this app's token once "tessera" is
      // in its accepted-audiences (see Central/BE application.yml).
      '/central-api': {
        target: 'http://localhost:9095',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/central-api/, '/api'),
      },
    },
  },
})
