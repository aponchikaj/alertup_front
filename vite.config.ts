import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    host: true, // allow access from network
    port: 5173, // your dev port
    strictPort: true, // optional: fail if port is taken
    allowedHosts: [
      "slipless-greg-urticaceous.ngrok-free.dev" // <-- add your Ngrok domain here
    ],
  },
})
