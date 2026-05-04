"use client"

import { createClient } from "@neondatabase/neon-js"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL
if (!authUrl) {
  throw new Error("NEXT_PUBLIC_NEON_AUTH_URL not set — see .env.example")
}

export const neonClient = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: authUrl,
  },
  dataApi: { url: authUrl },
})

export const auth = neonClient.auth
