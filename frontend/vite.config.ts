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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts"
          if (id.includes("@tanstack/react-table") || id.includes("@tanstack/react-virtual")) return "vendor-table"
          if (id.includes("@dnd-kit")) return "vendor-dnd"
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "vendor-dates"
          if (id.includes("@neondatabase/neon-js") || id.includes("@neondatabase/auth") || id.includes("better-auth")) return "vendor-auth"
          if (id.includes("filepond")) return "vendor-filepond"
          if (id.includes("axios")) return "vendor-net"
          if (id.includes("lucide-react")) return "vendor-icons"
          if (id.includes("radix-ui") || id.includes("@radix-ui")) return "vendor-radix"
          if (id.includes("react-router")) return "vendor-router"
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("\\react\\") || id.includes("\\react-dom\\")) return "vendor-react"
          return "vendor"
        },
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
})
