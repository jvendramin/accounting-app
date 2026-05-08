"use client"

import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@/components/ui/tabs"

export default function WaveIntegrationPage() {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button
          intent="plain"
          size="sm"
          onPress={() => router.push("/integrations")}
          className="self-start -ml-2"
        >
          ← Integrations
        </Button>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/integrations/wave.png"
            alt="Wave"
            className="size-12 shrink-0 overflow-hidden rounded-xl border bg-bg shadow-xs sm:size-14 object-contain"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Wave Accounting
            </h1>
            <p className="text-sm text-muted-fg">
              Bring your books over from Wave in one shot.
            </p>
          </div>
        </div>
      </div>

      <Tabs aria-label="Wave import sections" className="w-full">
        <TabList>
          <Tab id="transactions">Transactions</Tab>
          <Tab id="accounts">Accounts</Tab>
          <Tab id="categories">Categories</Tab>
        </TabList>
        <TabPanels className="w-full">
          <TabPanel id="transactions" className="pt-4 grid gap-4 w-full">
            <TransactionsTab />
          </TabPanel>
          <TabPanel id="accounts" className="pt-4 w-full">
            <ComingSoon
              title="Import accounts"
              copy="Bring your Wave Chart of Accounts over en masse — name, type, subtype, currency. Coming next."
            />
          </TabPanel>
          <TabPanel id="categories" className="pt-4 w-full">
            <ComingSoon
              title="Import categories"
              copy="Map Wave's expense / income classifications onto Books categories. Coming next."
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  )
}

function TransactionsTab() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Step 1 — Export from Wave
          </CardTitle>
          <CardDescription>
            Wave doesn't expose a transaction-level public API, so the
            migration uses their CSV export.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <ol className="grid gap-2 list-decimal pl-5">
            <li>
              In Wave, open <span className="font-medium">Reports</span> →{" "}
              <span className="font-medium">
                Account Transactions (General Ledger)
              </span>
              .
            </li>
            <li>
              Set the <span className="font-medium">Date Range</span> to a
              custom range covering everything you want to migrate (the
              earliest entry → today).
            </li>
            <li>
              Click <span className="font-medium">Export → CSV</span>. Save the
              file locally.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Step 2 — Upload &amp; review
          </CardTitle>
          <CardDescription>
            We'll parse the CSV, infer your chart of accounts, pair each entry
            into a double-entry transaction, and show you a preview before
            anything is written to the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="rounded-md border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-fg">
            Importer UI coming next — for now drop the CSV here once we wire
            the upload widget.
          </div>
          <Button isDisabled className="w-full sm:w-auto">
            Upload CSV
          </Button>
        </CardContent>
      </Card>
    </>
  )
}

function ComingSoon({ title, copy }: { title: string; copy: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        <CardDescription>{copy}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button intent="outline" isDisabled className="w-full sm:w-auto">
          Coming soon
        </Button>
      </CardContent>
    </Card>
  )
}
