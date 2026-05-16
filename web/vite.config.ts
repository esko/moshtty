import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "ghostty-web": fileURLToPath(
        new URL("./node_modules/ghostty-web/lib/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
    proxy: {
      "/api": "http://127.0.0.1:8765",
      "/pty": {
        target: "ws://127.0.0.1:8765",
        ws: true,
      },
    },
  },
});
