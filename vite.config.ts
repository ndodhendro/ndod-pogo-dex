/// <reference types="vitest/config" />
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const OCR_FILES = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  [
    'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
  ],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'tesseract-core-simd-lstm.wasm'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
] as const

function copyOcrAssets() {
  const dest = path.join(rootDir, 'public', 'ocr')
  fs.mkdirSync(dest, { recursive: true })
  for (const [from, name] of OCR_FILES) {
    const src = path.join(rootDir, from)
    if (!fs.existsSync(src)) throw new Error(`Missing OCR asset: ${from}`)
    fs.copyFileSync(src, path.join(dest, name))
  }
}

function ocrAssetsPlugin(): Plugin {
  return {
    name: 'ocr-assets',
    buildStart() {
      copyOcrAssets()
    },
  }
}

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
    .find((net) => net && !net.internal && ['IPv4', '4'].includes(String(net.family)))?.address
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
    ocrAssetsPlugin(),
    lanHostnamesPlugin(),
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,json,webmanifest,wasm,gz}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
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
