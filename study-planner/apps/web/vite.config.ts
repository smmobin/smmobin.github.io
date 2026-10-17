import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const webRoot = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(webRoot, '../..')

export default defineConfig({
  envDir: repoRoot,
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/health': { target: 'http://127.0.0.1:8788', changeOrigin: true },
      '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true },
    },
  },
})
