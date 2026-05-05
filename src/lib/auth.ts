"use client"

import { createClient } from "@neondatabase/neon-js"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL

// Lazy init: createClient + BetterAuthReactAdapter touch browser-only globals
// (window, localStorage). Next.js still server-renders this module for the
// "use client" boundary, so creating the client at module top-level throws
// during SSR. Build it on first access in the browser.
let cached: ReturnType<typeof createClient> | null = null

function getClient() {
  if (cached) return cached
  if (typeof window === "undefined") {
    // During SSR there is no auth session anyway; return a stub that
    // produces a "not signed in" pending state. The real client takes
    // over on hydration.
    return {
      auth: {
        useSession: () => ({ isPending: true, data: null }),
        signIn: { email: async () => ({ error: null }) },
        signUp: { email: async () => ({ error: null }) },
        signOut: async () => {},
      },
    } as any
  }
  if (!authUrl) {
    console.error(
      "NEXT_PUBLIC_NEON_AUTH_URL is not set. Auth flows will be unavailable. " +
        "Set it in Vercel Project Settings → Environment Variables (Production & Preview).",
    )
    // Return the SSR stub permanently rather than crashing the app — pages
    // will render the login screen which will surface the misconfig clearly.
    cached = {
      auth: {
        useSession: () => ({ isPending: false, data: null }),
        signIn: { email: async () => ({ error: { message: "Auth URL missing" } }) },
        signUp: { email: async () => ({ error: { message: "Auth URL missing" } }) },
        signOut: async () => {},
      },
    } as any
    return cached
  }
  cached = createClient({
    auth: {
      adapter: BetterAuthReactAdapter(),
      url: authUrl,
    },
    dataApi: { url: authUrl },
  })
  return cached
}

export const auth = new Proxy({} as ReturnType<typeof createClient>["auth"], {
  get(_target, prop) {
    return (getClient() as any).auth[prop as any]
  },
})
