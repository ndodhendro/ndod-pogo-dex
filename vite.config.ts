/// <reference types="vitest/config" />
import os from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const viteBasePath = (globalThis as {
  process?: { env?: Record<string, string | undefined> }
}).process?.env?.VITE_BASE_PATH

function pagesBase(path = viteBasePath) {
  if (!path || path === '/') return '/'
  return path.endsWith('/') ? path : `${path}/`
}

function lanIPv4() {
  return Object.values(os.networkInterfaces())
    .flat()
    .find((net) => net && (net.family === 'IPv4' || net.family === 4) && !net.internal)?.address
}

function lanHostnamesPlugin(): Plugin {
  return {
    name: 'lan-hostnames',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const port = server.config.server.port ?? 5174
        const ip = lanIPv4()
        const log = (line: string) => server.config.logger.info(line)
        log(`  ➜  Hostname: http://${os.hostname()}:${port}/`)
        if (ip) log(`  ➜  LAN DNS:  http://${ip.replaceAll('.', '-')}.sslip.io:${port}/`)
      })
    },
  }
}

export default defineConfig({
  base: pagesBase(),
  plugins: [
    lanHostnamesPlugin(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,json,webmanifest}'],
      },
      manifest: false,
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    allowedHosts: true,
  },
  test: {
    environment: 'node',
  },
})
