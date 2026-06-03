import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(process.env.VITE_APP_ENV || 'msdev'),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4080',
      '/socket.io': { target: 'http://localhost:4080', ws: true },
    },
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
});
