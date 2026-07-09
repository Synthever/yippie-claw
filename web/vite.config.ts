import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api ke backend Fastify (:3001) — frontend & backend beda port saat dev.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://127.0.0.1:9898', changeOrigin: true },
    },
  },
})
