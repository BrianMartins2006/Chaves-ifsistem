import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: new URL("./index.html", import.meta.url).pathname,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      ["/api"].map((path) => [
        path,
        {
          target: process.env.API_TARGET || "http://127.0.0.1:8081",
          changeOrigin: true,
        },
      ]),
    ),
  },
});
