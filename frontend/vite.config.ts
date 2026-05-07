import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    // @solana/web3.js + wallet-adapter packages assume Node's Buffer +
    // process globals. Polyfill them in the browser bundle.
    nodePolyfills({
      include: ["buffer", "process"],
      globals: { Buffer: true, process: true },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Source-of-truth markdown lives in the repo /docs/ folder. The
      // `?raw` Vite suffix bundles their contents into the JS at build
      // time so the in-site docs page never re-fetches them.
      "@docs": path.resolve(__dirname, "../docs"),
      "@root": path.resolve(__dirname, ".."),
    },
  },
  server: {
    port: 5173,
    // Polling because inotify is unreliable when source lives on /mnt/c
    // and Vite runs from inside WSL.
    watch: { usePolling: true, interval: 250 },
    // Allow imports from the repo root so @docs / @root resolve.
    fs: { allow: [".."] },
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
