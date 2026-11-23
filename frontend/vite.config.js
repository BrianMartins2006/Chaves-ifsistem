import { defineConfig } from "vite";
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      ["/auth", "/api", "/administrador", "/servidor"].map((path) => [
        path,
        {
          target: process.env.API_TARGET || "http://127.0.0.1:8081",
          changeOrigin: true,
        },
      ]),
    ),
  },
});
