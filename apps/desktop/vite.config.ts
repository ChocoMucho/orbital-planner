import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const desktopRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: desktopRoot,
  base: "./",
  envDir: repositoryRoot,
  clearScreen: false,
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      allow: [repositoryRoot],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2021",
  },
});
