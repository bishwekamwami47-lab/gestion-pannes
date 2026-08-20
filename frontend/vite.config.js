import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, les appels à /api/ sont transmis au backend Django (port 8000)
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
