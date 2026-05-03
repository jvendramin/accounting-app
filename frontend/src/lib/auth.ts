import { createClient } from "@neondatabase/neon-js"
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters"

const authUrl = import.meta.env.VITE_NEON_AUTH_URL
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL ?? authUrl

if (!authUrl) {
  throw new Error(
    "Missing VITE_NEON_AUTH_URL in .env.local — copy it from Neon Console → Auth.",
  )
}

export const neon = createClient({
  auth: {
    adapter: BetterAuthReactAdapter(),
    url: authUrl,
  },
  dataApi: { url: dataApiUrl },
})

export const auth = neon.auth
