import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    // Proxy socket.io to the backend during development
    proxy: {
      '/socket.io': {
        target: 'http://sneakychat.azurewebsites.net',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
