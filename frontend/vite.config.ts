import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: true,
    // Intentionally NOT using manualChunks. We previously split React from
    // its synchronous deps (scheduler, use-sync-external-store) which caused
    //   "Cannot read properties of undefined (reading 'useLayoutEffect')"
    // in production. Rollup's default chunking groups dynamically-imported
    // routes into their own chunks and keeps tightly-coupled deps together,
    // which is what we want. Don't re-introduce manualChunks unless you
    // really know which packages share runtime state.
  },
  esbuild: {
    legalComments: "none",
  },
})
