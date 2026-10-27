import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API is proxied in development so the browser only ever talks to :5173.
// Set VITE_API_BASE_URL in .env to point somewhere else.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/health': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
