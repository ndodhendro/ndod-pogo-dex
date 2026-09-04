/// <reference types="vitest/config" />
import os from 'node:os'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const machineHost = os.hostname()

const viteBasePath = (globalThis as {
  process?: { env?: Record<string, string | undefined> }
}).process?.env?.VITE_BASE_PATH

function pagesBase(path = viteBasePath) {
  if (!path || path === '/') return '/'
  return path.endsWith('/') ? path : `${path}/`
}

export default defineConfig({
  base: pagesBase(),
  plugins: [
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
    allowedHosts: [machineHost, `${machineHost}.local`],
  },
  test: {
    environment: 'node',
  },
})
