import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Which `Host:` headers this dev server answers to.
 *
 * Vite can refuse a request whose `Host` it does not recognise — the answer is a bare "Blocked
 * request" rather than a 404 — because an unguarded dev server is reachable through DNS rebinding by
 * any page the developer happens to open. This build does not refuse anything by default, and that
 * default is kept: ⚠️ **naming hosts here is a NARROWING, and it takes access away by IP.** Reaching
 * this server at `192.168.x.x:5050` sends that address as the `Host`, so a list of names alone locks
 * out exactly the LAN address most likely to be used.
 *
 * Set a comma-separated `TESSERA_ALLOWED_HOSTS` to lock it down deliberately, listing every address
 * that must keep working — names and IPs both.
 */
const allowedHosts = process.env.TESSERA_ALLOWED_HOSTS
  ? process.env.TESSERA_ALLOWED_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
  : true

// Tessera's UI is a standalone application: it builds into its own dist/ and is served on its own
// origin, exactly like Innoventa/UI. The backend has no idea this project exists — it answers /api
// and nothing else — so the two build, run and deploy independently and neither waits for the other.
// `npm run dev` is the only way this app is run in development; the proxy below is what makes the
// backend look same-origin to the browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
  // ⚠️ **Two copies of React are what a locally LINKED package gives you, and the symptom is
  // "Invalid hook call".** `@jmouse/ui` is installed from a path while it is unpublished, so its own
  // `node_modules` — devDependencies, React among them — sits inside the link and Vite resolves the
  // package's `react` there instead of here. Hooks then run against a React that never rendered
  // anything and `useState` is null. Deduping pins one copy for the whole graph; it stays correct
  // after publication, where the peer dependency would resolve here anyway.
  dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5050,
    // Stated rather than left to the default, which has not always been every interface and is not
    // worth re-deriving from a Vite changelog. Bound narrowly, a port forwarded on the router reaches
    // a machine where nothing is listening outward — the forward looks broken and the dev server
    // looks fine, which is the worst pairing to debug.
    //
    // ⚠️ THIS IS NOT WHAT MAKES IT REACHABLE FROM OUTSIDE. Windows Firewall decides that, per
    // PROGRAM, and `node.exe` under one Node installation carries no rule for another — see
    // "Reaching the dev servers from outside" in the workspace CLAUDE.md.
    host: '0.0.0.0',
    allowedHosts,
    proxy: {
      // Tessera's own API.
      '/api': 'http://localhost:8100',
      // ⚠️ **Every jMouse library in ONE rule** (Ivan, 2026-08-25): files, AI, the query builder and
      // live blocks all answer under `/jmouse/<namespace>/api` now. It used to be an entry per library —
      // `/jmai`, `/jmouse-files` — and a fourth one forgotten every time a module arrived.
      //
      // ⚠️ The address is still written in two places nothing compares: the backend composes it, and this
      // interface's client carries its own copy. When they drift every call 404s, the screens raise no
      // error of their own, and it reads as an installation with nothing in it.
      '/jmouse': 'http://localhost:8100',

      // Kiwi (the knowledge product that owns pages) — rewritten to /api on Kiwi so the browser sees a
      // same-origin call in development. ⚠️ In a DEPLOYMENT there is no proxy and this is a real
      // cross-origin request: Kiwi's own CORS allowlist is what permits it, and 5050 has to be in it.
      // That is why Kiwi is the one backend in this workspace that has an allowlist at all (KW-1 §1).
      //
      // ⚠️ Kiwi authorises the reader itself, every time. Tessera renders what it is given and decides
      // nothing about who may see a page — see api/kiwiClient.ts, including why a failure here must
      // never bounce somebody out of Tessera.
      '/kiwi-api': {
        target: 'http://localhost:8110',
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/kiwi-api/, '/api'),
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
