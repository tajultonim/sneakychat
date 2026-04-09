// vite.config.js
import { defineConfig } from "file:///home/tonim/Downloads/files%20(3)/sneakychat/node_modules/vite/dist/node/index.js";
import { svelte } from "file:///home/tonim/Downloads/files%20(3)/sneakychat/node_modules/@sveltejs/vite-plugin-svelte/src/index.js";
var vite_config_default = defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    // Proxy socket.io to the backend during development
    proxy: {
      "/socket.io": {
        target: "http://sneakychat.azurewebsites.net",
        ws: true,
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS90b25pbS9Eb3dubG9hZHMvZmlsZXMgKDMpL3NuZWFreWNoYXRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3RvbmltL0Rvd25sb2Fkcy9maWxlcyAoMykvc25lYWt5Y2hhdC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS90b25pbS9Eb3dubG9hZHMvZmlsZXMlMjAoMykvc25lYWt5Y2hhdC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHsgc3ZlbHRlIH0gZnJvbSAnQHN2ZWx0ZWpzL3ZpdGUtcGx1Z2luLXN2ZWx0ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtzdmVsdGUoKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgLy8gUHJveHkgc29ja2V0LmlvIHRvIHRoZSBiYWNrZW5kIGR1cmluZyBkZXZlbG9wbWVudFxuICAgIHByb3h5OiB7XG4gICAgICAnL3NvY2tldC5pbyc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL3NuZWFreWNoYXQuYXp1cmV3ZWJzaXRlcy5uZXQnLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtULFNBQVMsb0JBQW9CO0FBQy9VLFNBQVMsY0FBYztBQUV2QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsT0FBTyxDQUFDO0FBQUEsRUFDbEIsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBO0FBQUEsSUFFTixPQUFPO0FBQUEsTUFDTCxjQUFjO0FBQUEsUUFDWixRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
