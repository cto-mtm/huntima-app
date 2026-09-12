import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// CodePipe / Tailscale remote dev. When TAILSCALE_HOST is set (via the
// `dev:remote` script) the app is served over a single https origin on the
// tailnet, so HMR must run over wss:// pointed at that public host/port.
// When it is unset we keep plain local-dev defaults.
const tailscaleHost = process.env.TAILSCALE_HOST
const tailscalePort = process.env.TAILSCALE_PORT
  ? Number(process.env.TAILSCALE_PORT)
  : undefined

// The single origin means the phone's browser can only reach THIS server.
// The functions emulator (127.0.0.1:5001) is another localhost port, so the
// API path is proxied through the dev server to stay same-origin.
// The functions emulator serves the API under /<project>/<region>/api; that
// prefix is globally unique and won't clash with app routes.
const FUNCTIONS_EMULATOR = 'http://127.0.0.1:5001'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Capacitor loads the app from capacitor://localhost — relative asset
  // paths are required or the native build 404s on every chunk.
  base: './',
  build: { outDir: 'dist' },
  // Expose the remote-mode flag to the client (import.meta.env.VITE_TAILSCALE_HOST).
  define: {
    'import.meta.env.VITE_TAILSCALE_HOST': JSON.stringify(tailscaleHost ?? ''),
  },
  server: {
    host: '0.0.0.0',
    port: 8455,
    // Safe on a tailnet: only devices on your tailnet can reach this server.
    allowedHosts: true,
    hmr: tailscaleHost
      ? {
          protocol: 'wss',
          host: tailscaleHost,
          clientPort: tailscalePort,
        }
      : undefined,
    // Keep the functions-emulator API same-origin when accessed remotely.
    proxy: {
      '/demo-app': FUNCTIONS_EMULATOR,
    },
  },
})
