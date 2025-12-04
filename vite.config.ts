import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Fitness Planner AI',
        short_name: 'FitnessAI',
        description: 'AI-powered personal fitness trainer',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Expose to network
    allowedHosts: true, // Allow ngrok and other tunnels
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
  preview: {
    host: true,
    allowedHosts: true,
    port: 3000,
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
