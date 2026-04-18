import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

/** /favicon.ico : servir le bon Content-Type (ICO depuis `tauri icon`, ou SVG legacy). */
function faviconMimePlugin() {
  const pathIco = join(__dirname, 'public/favicon.ico')
  const apply = (
    /** @type {import('node:http').IncomingMessage} */ req,
    /** @type {import('node:http').ServerResponse} */ res,
    /** @type {() => void} */ next,
  ) => {
    const p = req.url?.split('?')[0] ?? ''
    if (p !== '/favicon.ico') {
      next()
      return
    }
    try {
      const body = readFileSync(pathIco)
      const isIco = body.length >= 4 && body[0] === 0 && body[1] === 0 && body[2] === 1 && body[3] === 0
      const isPng = body.length >= 8 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47
      const mime = isIco
        ? 'image/x-icon'
        : isPng
          ? 'image/png'
          : 'image/svg+xml; charset=utf-8'
      res.setHeader('Content-Type', mime)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.end(body)
    } catch {
      next()
    }
  }
  return {
    name: 'favicon-mime',
    configureServer(server) {
      server.middlewares.use(apply)
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply)
    },
  }
}

/**
 * La CSP du index.html bloque souvent le WebSocket Vite (HMR) et le proxy /api en dev
 * (connect-src trop strict). On retire la meta CSP uniquement quand le serveur Vite tourne.
 * Le build `vite build` conserve la CSP pour la prod.
 */
function cspDevRelaxPlugin() {
  return {
    name: 'csp-relax-dev',
    transformIndexHtml(html, ctx) {
      if (!ctx?.server) return html
      return html.replace(
        /<meta\s+http-equiv="Content-Security-Policy"[^>]*>\s*/i,
        '<!-- CSP retirée en dev (Vite HMR + localhost) — présente au build production -->\n    ',
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Préférer 127.0.0.1 (et pas "localhost") pour éviter des résolutions IPv6 (::1) incohérentes sous Windows.
  const apiProxyTarget = (env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:8080').replace(/\/$/, '')

  return {
  // Empêche Vite d'effacer le terminal lors des hot-reloads en mode `tauri dev`.
  clearScreen: false,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version ?? '1.0.0'),
  },
  envPrefix: ['VITE_', 'TAURI_'],
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  worker: {
    format: 'es',
  },
  plugins: [react(), cspDevRelaxPlugin(), faviconMimePlugin()],
  server: {
    // `npm run dev` (navigateur) : 5173. `npm run vite:dev:1420` force 1420 (voir package.json) pour éviter le conflit si 5173 est déjà pris.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        // Vite répond sinon en 500 sur ECONNREFUSED — confondu avec une erreur Spring.
        configure(proxy) {
          proxy.on('error', (_err, _req, res) => {
            if (
              res &&
              typeof res.writeHead === 'function' &&
              !res.headersSent &&
              !res.writableEnded
            ) {
              res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
              res.end(
                `Bad Gateway: aucune API sur ${apiProxyTarget} (démarrez le backend Java : ../../Scriptor/backend, mvn spring-boot:run, ou définissez VITE_DEV_API_PROXY_TARGET).`,
              )
            }
          })
        },
      },
    },
  },
  }
})
