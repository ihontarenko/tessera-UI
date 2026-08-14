import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Tessera's UI is a standalone application: it builds into its own dist/ and is served on its own
// origin, exactly like Innoventa/UI. The backend has no idea this project exists — it answers /api
// and nothing else — so the two build, run and deploy independently and neither waits for the other.
// `npm run dev` is the only way this app is run in development; the proxy below is what makes the
// backend look same-origin to the browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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
