import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../..",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL ?? "http://localhost:8080",
        changeOrigin: true
      }
    }
  }
});
