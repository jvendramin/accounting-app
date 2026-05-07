"use client"

import { useEffect, useState } from "react"

// Cross-platform splash for installed PWAs. The element is server-rendered
// hidden by default; `@media (display-mode: standalone)` in globals.css
// reveals it on iOS / Android home-screen launches so users see a branded
// frame from the very first paint (before JS even hydrates), then this
// component fades it out once the app is ready.
export function PwaSplash() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    if (!isStandalone) {
      setHidden(true)
      return
    }
    // Give the shell a couple of frames to render under the splash, then
    // fade out.
    const t = setTimeout(() => setHidden(true), 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      data-pwa-splash
      data-hidden={hidden ? "true" : undefined}
      aria-hidden
      className="pwa-splash pointer-events-none fixed inset-0 z-[100] hidden flex-col items-center justify-center gap-4 bg-bg text-fg transition-opacity duration-300 data-[hidden]:opacity-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="size-24 drop-shadow-md" />
      <div className="text-2xl font-semibold tracking-tight">Books</div>
    </div>
  )
}
