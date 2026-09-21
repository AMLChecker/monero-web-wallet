import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Dev server only listens on loopback; the browser talks to this origin and Vite proxies /api to the local backend. */
const backendPort = process.env.MONERO_BACKEND_PORT || '18082';
const frontendPort = Number(process.env.MONERO_FRONTEND_PORT || 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: frontendPort + 1,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
  },
});
