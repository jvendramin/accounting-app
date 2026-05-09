"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Integration = {
  id: string
  name: string
  blurb: string
  status: "available" | "soon"
  href?: string
  logo: React.ReactNode
}

// Inline SVG of the Wave mark — three rounded vertical strokes in graduated
// blues on a warm-cream circle. Used as a fallback until the official PNG is
// dropped at /public/integrations/wave.png; the Logo component below prefers
// the file when present.
const WaveLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 64 64" aria-hidden {...props}>
    <circle cx="32" cy="32" r="32" fill="#F8EFE8" />
    {/* Short stroke (back) — leftmost, leaning right, deep blue */}
    <rect
      x="12"
      y="20"
      width="11"
      height="28"
      rx="5.5"
      fill="#0033E0"
      transform="rotate(15 17.5 34)"
    />
    {/* Mid stroke — taller, mid blue, hooks at bottom */}
    <path
      d="M28 16 q5.5 -2 10 0 v26 q-5 12 -16 7 q9 0 6 -10 z"
      fill="#1E70F0"
    />
    {/* Front stroke — tallest, light blue */}
    <path
      d="M40 14 q5.5 -2 10 0 v28 q-5 12 -14 8 q7 -1 4 -9 z"
      fill="#5BA9F2"
    />
  </svg>
)

const Logo = ({ slug }: { slug: string }) => {
  // Always try the PNG first; onError flips in the inline SVG if absent.
  const [errored, setErrored] = useState(false)
  return (
    <div className="size-12 shrink-0 overflow-hidden rounded-xl border bg-bg shadow-xs sm:size-14">
      {errored ? (
        slug === "wave" ? (
          <WaveLogo className="size-full" />
        ) : (
          <div className="size-full bg-muted" />
        )
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/integrations/${slug}.png`}
          alt=""
          className="size-full object-contain"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  )
}

const INTEGRATIONS: Integration[] = [
  {
    id: "wave",
    name: "Wave Accounting",
    blurb:
      "Import your chart of accounts and historical journal entries from Wave's Account Transactions (General Ledger) CSV export.",
    status: "available",
    href: "/integrations/wave",
    logo: <Logo slug="wave" />,
  },
  {
    id: "square",
    name: "Square",
    blurb:
      "Pull paid invoices from your Square account and review them as deposit suggestions before importing.",
    status: "available",
    href: "/integrations/square",
    logo: <Logo slug="square" />,
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    blurb: "Bring over your books from QuickBooks via their API or a CSV export.",
    status: "soon",
    logo: <Logo slug="quickbooks" />,
  },
  {
    id: "stripe",
    name: "Stripe",
    blurb: "Auto-import payouts, fees, and refunds as journal entries.",
    status: "soon",
    logo: <Logo slug="stripe" />,
  },
  {
    id: "plaid",
    name: "Plaid",
    blurb: "Live bank-feed transactions matched to your chart of accounts.",
    status: "soon",
    logo: <Logo slug="plaid" />,
  },
]

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Integrations
        </h1>
        <p className="text-sm text-muted-fg">
          Connect external services to import data into Books or sync ongoing
          activity.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map((it) => (
          <IntegrationCard key={it.id} item={it} />
        ))}
      </div>
    </div>
  )
}

function IntegrationCard({ item }: { item: Integration }) {
  const isAvailable = item.status === "available"
  const router = useRouter()
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start gap-3">
        {item.logo}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CardTitle className="min-w-0 flex-1 truncate text-base sm:text-lg">
              {item.name}
            </CardTitle>
            {!isAvailable && (
              <Badge intent="secondary" className="shrink-0">
                Coming soon
              </Badge>
            )}
          </div>
          <CardDescription className="mt-1 text-sm">
            {item.blurb}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        {isAvailable && item.href ? (
          <Button
            className="w-full sm:w-auto"
            onPress={() => router.push(item.href!)}
          >
            Set up
          </Button>
        ) : (
          <Button intent="outline" isDisabled className="w-full sm:w-auto">
            Notify me
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
