import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In dev the app calls /api/* on its own origin and Vite forwards to the
    // API, so there is no CORS round-trip locally. In production VITE_API_URL
    // points at the deployed API instead.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
