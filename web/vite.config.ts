import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 800,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'vendor'
          }

          if (id.includes('node_modules/framer-motion')) {
            return 'motion'
          }

          if (id.includes('node_modules/@clerk')) {
            return 'clerk'
          }
        },
      },
    },
  },
  envPrefix: ['VITE_API_URL', 'VITE_CLERK_', 'VITE_SOURCE_OF_TRUTH_', 'VITE_STRIPE_'],
  envDir: '..',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
})
