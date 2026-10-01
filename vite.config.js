import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    include: ["grapesjs"],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        agent: resolve(__dirname, "agent.html"),
      },
    },
  },
});
