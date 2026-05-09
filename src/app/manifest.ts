import type { MetadataRoute } from "next"

// Next.js 16 reads this at /manifest.webmanifest. The file convention also
// auto-emits the <link rel="manifest"> tag into every document head.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Books",
    short_name: "Books",
    description: "Lightweight double-entry accounting.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["finance", "productivity", "business"],
    icons: [
      {
        src: "/pwa-icon.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/pwa-icon.jpg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/pwa-icon.jpg",
        sizes: "1024x1024",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
  }
}
