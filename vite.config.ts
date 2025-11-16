import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/auth': {
        target: 'https://valuable-parrot-115.convex.site',
        changeOrigin: true,
        secure: true,
      },
      '/api/webhook/stripe': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable', '@react-three/fiber', '@react-three/drei', 'three'],
    exclude: []
  }
})
