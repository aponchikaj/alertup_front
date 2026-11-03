import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // FX-064: long-lived vendor code in its own chunks, so a release that
        // only touches app code leaves ~300 kB of cached libraries valid.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'scheduler'],
          'vendor-router': ['react-router', 'react-router-dom'],
          'vendor-anime': ['animejs'],
        },
      },
    },
  },
  server: {
    host: true, // allow access from network
    port: 5173, // your dev port
    strictPort: true, // optional: fail if port is taken
    allowedHosts: [
      "slipless-greg-urticaceous.ngrok-free.dev" // <-- add your Ngrok domain here
    ],
  },
})
