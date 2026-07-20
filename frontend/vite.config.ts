/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 開発時は /api と /cable を Rails(バックエンド) へプロキシし、
// 同一オリジン扱いにして httpOnly セッションCookie を素直に扱う。
const backend = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/cable': { target: backend, ws: true, changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
})
