import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    strictPort: true,
  },
  define: {
    // Ensure process.env is available
    'process.env': {}
  },
  // Environment variable handling
  envPrefix: 'VITE_',
  // Base public path for production
  base: mode === 'production' ? '/anisync/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Ensure environment variables are replaced
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          paypal: ['@paypal/paypal-js']
        }
      }
    }
  }
}))
