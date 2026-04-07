import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4001,
    proxy: {
      "/fwf-api": {
        target: "https://openapi.fwf.ac.at",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fwf-api/, ""),
        secure: true,
      },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
