"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

type Ctx = {
  theme: Theme
  resolved: "light" | "dark"
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<Ctx | null>(null)
const STORAGE_KEY = "primitive-theme"

function applyTheme(t: Theme): "light" | "dark" {
  const resolved =
    t === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : t
  document.documentElement.classList.toggle("dark", resolved === "dark")
  return resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolved, setResolved] = useState<"light" | "dark">("light")

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system"
    setThemeState(stored)
    setResolved(applyTheme(stored))

    if (stored === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const onChange = () => setResolved(applyTheme("system"))
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    }
  }, [])

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t)
    setThemeState(t)
    setResolved(applyTheme(t))
  }

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}

// Inline bootstrap script — drop in the document <head> via
// `dangerouslySetInnerHTML` so the html.dark class is set BEFORE first paint
// and we get no flash of wrong theme on reload.
export const themeBootstrapScript = `
(function() {
  try {
    var s = localStorage.getItem('${STORAGE_KEY}') || 'system';
    var dark = s === 'dark' || (s === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`
