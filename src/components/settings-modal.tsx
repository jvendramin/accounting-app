"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { TextField } from "@/components/ui/text-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { NumberField, NumberInput } from "@/components/ui/number-field"
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@/components/ui/tabs"
import {
  ComboBox,
  ComboBoxContent,
  ComboBoxInput,
  ComboBoxItem,
} from "@/components/ui/combo-box"
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
            <TabPanel id="personal" className="pt-4 w-full">
              <div className="grid gap-4 w-full sm:grid-cols-2">
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
                <ComboBox
                  aria-label="Timezone"
                  selectedKey={prefs.personal.timezone ?? null}
                  onSelectionChange={(k) =>
                    set.personal("timezone", k == null ? "" : String(k))
                  }
                >
                  <Label>Timezone</Label>
                  <ComboBoxInput placeholder="Select timezone" />
                  <ComboBoxContent>
                    {TIMEZONES.map((t) => (
                      <ComboBoxItem key={t} id={t}>
                        {t}
                      </ComboBoxItem>
                    ))}
                  </ComboBoxContent>
                </ComboBox>
                <ComboBox
                  aria-label="Locale"
                  selectedKey={prefs.personal.locale ?? null}
                  onSelectionChange={(k) =>
                    set.personal("locale", k == null ? "" : String(k))
                  }
                >
                  <Label>Locale</Label>
                  <ComboBoxInput placeholder="Select locale" />
                  <ComboBoxContent>
                    {LOCALES.map((t) => (
                      <ComboBoxItem key={t} id={t}>
                        {t}
                      </ComboBoxItem>
                    ))}
                  </ComboBoxContent>
                </ComboBox>
                <ComboBox
                  aria-label="Date format"
                  selectedKey={prefs.personal.date_format ?? null}
                  onSelectionChange={(k) =>
                    set.personal("date_format", k == null ? "" : String(k))
                  }
                >
                  <Label>Date format</Label>
                  <ComboBoxInput placeholder="Select date format" />
                  <ComboBoxContent>
                    {DATE_FORMATS.map((t) => (
                      <ComboBoxItem key={t} id={t}>
                        {t}
                      </ComboBoxItem>
                    ))}
                  </ComboBoxContent>
                </ComboBox>
              </div>
            </TabPanel>

            <TabPanel id="business" className="pt-4 w-full">
              <div className="grid gap-4 w-full sm:grid-cols-2">
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
                <ComboBox
                  aria-label="Currency"
                  selectedKey={prefs.business.currency ?? null}
                  onSelectionChange={(k) =>
                    set.business("currency", k == null ? "" : String(k))
                  }
                >
                  <Label>Currency</Label>
                  <ComboBoxInput placeholder="Select currency" />
                  <ComboBoxContent>
                    {CURRENCIES.map((t) => (
                      <ComboBoxItem key={t} id={t}>
                        {t}
                      </ComboBoxItem>
                    ))}
                  </ComboBoxContent>
                </ComboBox>
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
                <ComboBox
                  aria-label="Country"
                  selectedKey={prefs.business.country ?? null}
                  onSelectionChange={(k) =>
                    set.business("country", k == null ? "" : String(k))
                  }
                >
                  <Label>Country</Label>
                  <ComboBoxInput placeholder="Select country" />
                  <ComboBoxContent>
                    {COUNTRIES.map((t) => (
                      <ComboBoxItem key={t} id={t}>
                        {t}
                      </ComboBoxItem>
                    ))}
                  </ComboBoxContent>
                </ComboBox>
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
                <ComboBox
                  aria-label="Fiscal year start month"
                  selectedKey={prefs.business.fiscal_year_start_month ?? null}
                  onSelectionChange={(k) =>
                    set.business(
                      "fiscal_year_start_month",
                      k == null ? "" : String(k),
                    )
                  }
                >
                  <Label>Fiscal year starts</Label>
                  <ComboBoxInput placeholder="Select month" />
                  <ComboBoxContent>
                    {MONTHS.map(([id, label]) => (
                      <ComboBoxItem key={id} id={id} textValue={label}>
                        {label}
                      </ComboBoxItem>
                    ))}
                  </ComboBoxContent>
                </ComboBox>
              </div>
            </TabPanel>

            <TabPanel id="app" className="pt-4 w-full">
              <div className="grid gap-4 w-full sm:grid-cols-2">
                <ComboBox
                  aria-label="Theme"
                  selectedKey={prefs.app.theme ?? theme ?? null}
                  onSelectionChange={(k) =>
                    k && set.app("theme", k as "light" | "dark" | "system")
                  }
                >
                  <Label>Theme</Label>
                  <ComboBoxInput placeholder="Select theme" />
                  <ComboBoxContent>
                    <ComboBoxItem id="light">Light</ComboBoxItem>
                    <ComboBoxItem id="dark">Dark</ComboBoxItem>
                    <ComboBoxItem id="system">System</ComboBoxItem>
                  </ComboBoxContent>
                </ComboBox>
                <ComboBox
                  aria-label="Default dashboard tab"
                  selectedKey={prefs.app.default_dashboard_tab ?? "overview"}
                  onSelectionChange={(k) =>
                    k &&
                    set.app(
                      "default_dashboard_tab",
                      k as "overview" | "suggestions",
                    )
                  }
                >
                  <Label>Default dashboard tab</Label>
                  <ComboBoxInput placeholder="Select tab" />
                  <ComboBoxContent>
                    <ComboBoxItem id="overview">Overview</ComboBoxItem>
                    <ComboBoxItem id="suggestions">Suggestions</ComboBoxItem>
                  </ComboBoxContent>
                </ComboBox>
                <ComboBox
                  aria-label="Table density"
                  selectedKey={prefs.app.table_density ?? "comfortable"}
                  onSelectionChange={(k) =>
                    k &&
                    set.app("table_density", k as "comfortable" | "compact")
                  }
                >
                  <Label>Table density</Label>
                  <ComboBoxInput placeholder="Select density" />
                  <ComboBoxContent>
                    <ComboBoxItem id="comfortable">Comfortable</ComboBoxItem>
                    <ComboBoxItem id="compact">Compact</ComboBoxItem>
                  </ComboBoxContent>
                </ComboBox>
                <NumberField
                  value={Number(prefs.app.items_per_page ?? 50)}
                  onChange={(v) =>
                    set.app(
                      "items_per_page",
                      String(Number.isFinite(v) ? v : 50),
                    )
                  }
                  minValue={10}
                  maxValue={500}
                  step={10}
                >
                  <Label>Rows per page</Label>
                  <NumberInput />
                </NumberField>
                <ComboBox
                  aria-label="Default new transaction type"
                  selectedKey={prefs.app.default_tx_type ?? "withdrawal"}
                  onSelectionChange={(k) =>
                    k &&
                    set.app("default_tx_type", k as "deposit" | "withdrawal")
                  }
                >
                  <Label>Default new transaction type</Label>
                  <ComboBoxInput placeholder="Select type" />
                  <ComboBoxContent>
                    <ComboBoxItem id="deposit">Deposit</ComboBoxItem>
                    <ComboBoxItem id="withdrawal">Withdrawal</ComboBoxItem>
                  </ComboBoxContent>
                </ComboBox>
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
