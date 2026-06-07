import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_ENV': JSON.stringify(process.env.VITE_APP_ENV || 'msdev'),
    'import.meta.env.VITE_OFFLINE_DEMO': JSON.stringify(process.env.VITE_OFFLINE_DEMO || ''),
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:4080',
      '/socket.io': { target: 'http://localhost:4080', ws: true },
    },
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/leaflet')) return 'leaflet';
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor';
          if (id.includes('node_modules/socket.io-client')) return 'socket';
        },
      },
    },
  },
});
