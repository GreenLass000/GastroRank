import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:3030',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/leaflet')) {
            return 'leaflet'
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    proxy: apiProxy,
  },
})
