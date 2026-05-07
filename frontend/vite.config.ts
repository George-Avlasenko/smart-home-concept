import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Адрес нашего .NET бэкенда
        changeOrigin: true,
        secure: false,
        ws: true, // Поддержка WebSocket для SSE
        timeout: 0,
        proxyTimeout: 0,
      },
      '/tuya': {
        target: 'http://localhost:5055',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tuya/, ''),
      },
    }
  }
})
