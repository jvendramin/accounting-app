import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// TODO: port the recharts-based Dashboard from the Vite app. The API route
// /api/reports/profit_and_loss is already implemented and returns the same
// shape as the Rails endpoint, so the existing client-side fetch + recharts
// code should drop in with minimal changes.

export default function DashboardPage() {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-fg text-sm">
          Port me — see <code>/api/reports/profit_and_loss</code> for the data
          source. Use recharts (already installed) for the bar/line charts.
        </CardContent>
      </Card>
    </div>
  )
}
