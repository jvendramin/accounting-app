"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { toast } from "sonner"
import { auth } from "@/lib/auth"
import { api } from "@/lib/api"
import { useTheme } from "@/components/theme-provider"

type PrefsShape = {
  personal: {
    display_name?: string
    avatar_url?: string
    timezone?: string
    locale?: string
    date_format?: string
  }
  business: {
    business_name?: string
    legal_name?: string
    tax_id?: string
    currency?: string
    address_line1?: string
    address_line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
    phone?: string
    email?: string
    website?: string
    fiscal_year_start_month?: string
  }
  app: {
    theme?: "light" | "dark" | "system"
    default_dashboard_tab?: "overview" | "suggestions"
    table_density?: "comfortable" | "compact"
    items_per_page?: string
    show_suggestions?: boolean
    default_tx_type?: "deposit" | "withdrawal"
  }
}

const empty: PrefsShape = { personal: {}, business: {}, app: {} }

const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
]
const LOCALES = ["en-US", "en-GB", "en-CA", "en-AU", "fr-FR", "de-DE", "ja-JP"]
const DATE_FORMATS = ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "DD MMM YYYY"]
const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "JPY"]
const COUNTRIES = ["US", "CA", "GB", "AU", "DE", "FR", "JP", "Other"]
const MONTHS = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
] as const

export function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const session = auth.useSession()
  const userSub = session.data?.user?.id ?? null
  const userEmail = session.data?.user?.email ?? ""
  const { theme, setTheme } = useTheme()

  const [prefs, setPrefs] = useState<PrefsShape>(empty)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen || !userSub) return
    setLoading(true)
    api
      .get<PrefsShape>("/api/preferences", { user_sub: userSub })
      .then((p) => setPrefs({ ...empty, ...p }))
      .catch(() => setPrefs(empty))
      .finally(() => setLoading(false))
  }, [isOpen, userSub])

  const set = useMemo(
    () => ({
      personal: <K extends keyof PrefsShape["personal"]>(
        k: K,
        v: PrefsShape["personal"][K],
      ) => setPrefs((p) => ({ ...p, personal: { ...p.personal, [k]: v } })),
      business: <K extends keyof PrefsShape["business"]>(
        k: K,
        v: PrefsShape["business"][K],
      ) => setPrefs((p) => ({ ...p, business: { ...p.business, [k]: v } })),
      app: <K extends keyof PrefsShape["app"]>(
        k: K,
        v: PrefsShape["app"][K],
      ) => setPrefs((p) => ({ ...p, app: { ...p.app, [k]: v } })),
    }),
    [],
  )

  const save = async () => {
    if (!userSub) {
      toast.error("Not signed in")
      return
    }
    setSaving(true)
    try {
      await api.put("/api/preferences", { user_sub: userSub, prefs })
      // App-level theme echoes to the runtime theme provider.
      if (prefs.app.theme && prefs.app.theme !== theme) {
        setTheme(prefs.app.theme)
      }
      toast.success("Settings saved")
      onClose()
    } catch {
      /* api helper toasts */
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalContent
      size="3xl"
      isOpen={isOpen}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <ModalHeader>
        <ModalTitle>Settings</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Tabs aria-label="Settings sections">
          <TabList>
            <Tab id="personal">Personal</Tab>
            <Tab id="business">Business profile</Tab>
            <Tab id="app">App settings</Tab>
          </TabList>
          <TabPanels>
            <TabPanel id="personal" className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  value={prefs.personal.display_name ?? ""}
                  onChange={(v) => set.personal("display_name", v)}
                >
                  <Label>Display name</Label>
                  <Input />
                </TextField>
                <TextField value={userEmail} isReadOnly>
                  <Label>Email</Label>
                  <Input />
                </TextField>
                <TextField
                  value={prefs.personal.avatar_url ?? ""}
                  onChange={(v) => set.personal("avatar_url", v)}
                  className="sm:col-span-2"
                >
                  <Label>Avatar URL</Label>
                  <Input placeholder="https://…" />
                </TextField>
                <div className="grid gap-1.5">
                  <Label>Timezone</Label>
                  <Select
                    aria-label="Timezone"
                    selectedKey={prefs.personal.timezone ?? ""}
                    onSelectionChange={(k) =>
                      set.personal("timezone", String(k))
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {TIMEZONES.map((t) => (
                        <SelectItem key={t} id={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Locale</Label>
                  <Select
                    aria-label="Locale"
                    selectedKey={prefs.personal.locale ?? ""}
                    onSelectionChange={(k) => set.personal("locale", String(k))}
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {LOCALES.map((t) => (
                        <SelectItem key={t} id={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Date format</Label>
                  <Select
                    aria-label="Date format"
                    selectedKey={prefs.personal.date_format ?? ""}
                    onSelectionChange={(k) =>
                      set.personal("date_format", String(k))
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {DATE_FORMATS.map((t) => (
                        <SelectItem key={t} id={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="business" className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  value={prefs.business.business_name ?? ""}
                  onChange={(v) => set.business("business_name", v)}
                >
                  <Label>Business name</Label>
                  <Input />
                </TextField>
                <TextField
                  value={prefs.business.legal_name ?? ""}
                  onChange={(v) => set.business("legal_name", v)}
                >
                  <Label>Legal name</Label>
                  <Input />
                </TextField>
                <TextField
                  value={prefs.business.tax_id ?? ""}
                  onChange={(v) => set.business("tax_id", v)}
                >
                  <Label>Tax ID</Label>
                  <Input placeholder="EIN / GST / VAT" />
                </TextField>
                <div className="grid gap-1.5">
                  <Label>Currency</Label>
                  <Select
                    aria-label="Currency"
                    selectedKey={prefs.business.currency ?? ""}
                    onSelectionChange={(k) =>
                      set.business("currency", String(k))
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {CURRENCIES.map((t) => (
                        <SelectItem key={t} id={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TextField
                  value={prefs.business.address_line1 ?? ""}
                  onChange={(v) => set.business("address_line1", v)}
                  className="sm:col-span-2"
                >
                  <Label>Address line 1</Label>
                  <Input />
                </TextField>
                <TextField
                  value={prefs.business.address_line2 ?? ""}
                  onChange={(v) => set.business("address_line2", v)}
                  className="sm:col-span-2"
                >
                  <Label>Address line 2</Label>
                  <Input />
                </TextField>
                <TextField
                  value={prefs.business.city ?? ""}
                  onChange={(v) => set.business("city", v)}
                >
                  <Label>City</Label>
                  <Input />
                </TextField>
                <TextField
                  value={prefs.business.state ?? ""}
                  onChange={(v) => set.business("state", v)}
                >
                  <Label>State / Province</Label>
                  <Input />
                </TextField>
                <TextField
                  value={prefs.business.postal_code ?? ""}
                  onChange={(v) => set.business("postal_code", v)}
                >
                  <Label>Postal code</Label>
                  <Input />
                </TextField>
                <div className="grid gap-1.5">
                  <Label>Country</Label>
                  <Select
                    aria-label="Country"
                    selectedKey={prefs.business.country ?? ""}
                    onSelectionChange={(k) =>
                      set.business("country", String(k))
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {COUNTRIES.map((t) => (
                        <SelectItem key={t} id={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TextField
                  value={prefs.business.phone ?? ""}
                  onChange={(v) => set.business("phone", v)}
                >
                  <Label>Phone</Label>
                  <Input type="tel" />
                </TextField>
                <TextField
                  value={prefs.business.email ?? ""}
                  onChange={(v) => set.business("email", v)}
                >
                  <Label>Business email</Label>
                  <Input type="email" />
                </TextField>
                <TextField
                  value={prefs.business.website ?? ""}
                  onChange={(v) => set.business("website", v)}
                  className="sm:col-span-2"
                >
                  <Label>Website</Label>
                  <Input placeholder="https://…" />
                </TextField>
                <div className="grid gap-1.5">
                  <Label>Fiscal year starts</Label>
                  <Select
                    aria-label="Fiscal year start month"
                    selectedKey={prefs.business.fiscal_year_start_month ?? ""}
                    onSelectionChange={(k) =>
                      set.business("fiscal_year_start_month", String(k))
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      {MONTHS.map(([id, label]) => (
                        <SelectItem key={id} id={id}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabPanel>

            <TabPanel id="app" className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Theme</Label>
                  <Select
                    aria-label="Theme"
                    selectedKey={prefs.app.theme ?? theme}
                    onSelectionChange={(k) =>
                      set.app("theme", k as "light" | "dark" | "system")
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem id="light">Light</SelectItem>
                      <SelectItem id="dark">Dark</SelectItem>
                      <SelectItem id="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Default dashboard tab</Label>
                  <Select
                    aria-label="Default dashboard tab"
                    selectedKey={prefs.app.default_dashboard_tab ?? "overview"}
                    onSelectionChange={(k) =>
                      set.app(
                        "default_dashboard_tab",
                        k as "overview" | "suggestions",
                      )
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem id="overview">Overview</SelectItem>
                      <SelectItem id="suggestions">Suggestions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Table density</Label>
                  <Select
                    aria-label="Table density"
                    selectedKey={prefs.app.table_density ?? "comfortable"}
                    onSelectionChange={(k) =>
                      set.app(
                        "table_density",
                        k as "comfortable" | "compact",
                      )
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem id="comfortable">Comfortable</SelectItem>
                      <SelectItem id="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TextField
                  value={prefs.app.items_per_page ?? "50"}
                  onChange={(v) => set.app("items_per_page", v)}
                >
                  <Label>Rows per page</Label>
                  <Input type="number" min={10} max={500} step={10} />
                </TextField>
                <div className="grid gap-1.5">
                  <Label>Default new transaction type</Label>
                  <Select
                    aria-label="Default new transaction type"
                    selectedKey={prefs.app.default_tx_type ?? "withdrawal"}
                    onSelectionChange={(k) =>
                      set.app(
                        "default_tx_type",
                        k as "deposit" | "withdrawal",
                      )
                    }
                  >
                    <SelectTrigger />
                    <SelectContent>
                      <SelectItem id="deposit">Deposit</SelectItem>
                      <SelectItem id="withdrawal">Withdrawal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between sm:col-span-2 rounded-md border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">
                      Show transaction suggestions
                    </div>
                    <div className="text-xs text-muted-fg">
                      Surface recurring transactions on the Dashboard.
                    </div>
                  </div>
                  <Switch
                    isSelected={prefs.app.show_suggestions ?? true}
                    onChange={(v) => set.app("show_suggestions", v)}
                  />
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
        {loading && (
          <div className="mt-2 text-xs text-muted-fg">Loading settings…</div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button intent="outline" onPress={onClose}>
          Cancel
        </Button>
        <Button onPress={save} isPending={saving}>
          Save
        </Button>
      </ModalFooter>
    </ModalContent>
  )
}
