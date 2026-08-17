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
      // ⚠️ The AI management screens, served by `jmouse-ai-management` at the library's own default
      // prefix rather than under /api — deliberately, so every route under it is visibly not Tessera's
      // own. It is a second proxy entry rather than a rewrite: the address is real on the backend, and
      // pretending otherwise here would make the one thing this prefix exists to show invisible.
      '/jmouse-ai': 'http://localhost:8100',
      // WiQ (the knowledge product that owns pages) — rewritten to /api on WiQ so the browser sees a
      // same-origin call in development. ⚠️ In a DEPLOYMENT there is no proxy and this is a real
      // cross-origin request: WiQ's own CORS allowlist is what permits it, and 5050 has to be in it.
      // That is why WiQ is the one backend in this workspace that has an allowlist at all (WIQ-1 §1).
      //
      // ⚠️ WiQ authorises the reader itself, every time. Tessera renders what it is given and decides
      // nothing about who may see a page — see api/wiqClient.ts, including why a failure here must
      // never bounce somebody out of Tessera.
      '/wiq-api': {
        target: 'http://localhost:8110',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/wiq-api/, '/api'),
      },
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
