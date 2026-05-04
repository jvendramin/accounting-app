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
          // React core and every package it imports synchronously must live
          // in the SAME chunk. If a sibling chunk loads first and calls a
          // React API (e.g. useLayoutEffect) before the React module has
          // finished initializing, you get
          //   "Cannot read properties of undefined (reading 'useLayoutEffect')"
          // Keep this matcher first so it wins over react-router/@radix-ui/etc.
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store|react-is)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-react"
          }
          if (id.includes("react-router")) return "vendor-router"
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts"
          if (id.includes("@tanstack/react-table") || id.includes("@tanstack/react-virtual")) return "vendor-table"
          if (id.includes("@dnd-kit")) return "vendor-dnd"
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "vendor-dates"
          if (id.includes("@neondatabase/neon-js") || id.includes("@neondatabase/auth") || id.includes("better-auth")) return "vendor-auth"
          if (id.includes("filepond")) return "vendor-filepond"
          if (id.includes("axios")) return "vendor-net"
          if (id.includes("lucide-react")) return "vendor-icons"
          if (id.includes("radix-ui") || id.includes("@radix-ui")) return "vendor-radix"
          return "vendor"
        },
      },
    },
  },
  esbuild: {
    legalComments: "none",
  },
})
