# accounting-app-next

Next.js 16 + Intent UI port of the Vite/Rails app at `../accounting-app/`.

## Status

| Layer | State |
| --- | --- |
| Project scaffolded from Intent UI starter | ✅ |
| All 88 Intent UI components installed | ✅ |
| Drizzle schema mirroring existing Neon `public` tables | ✅ |
| Drizzle DB client (`@neondatabase/serverless` + `drizzle-orm`) | ✅ |
| Neon Auth client wired (same as Vite app) | ✅ |
| `(app)` route group with AuthGate + Sidebar shell | ✅ |
| Login form (Intent UI `TextField` / `Button`) | ✅ |
| API routes: accounts CRUD + bulk, transactions CRUD + bulk + bulk_create, all reports | ✅ |
| API routes: receipts CRUD + S3 presign | ✅ |
| Pages: Dashboard, Accounts, Transactions, Receipts, Import, all 3 Reports | ✅ |

## Run

```bash
npm run dev   # http://localhost:3000
```

`.env.local` has the Neon DB URL and Auth REST endpoint pre-filled.

## Porting recipe (for the remaining pages)

The Vite pages live at `../accounting-app/frontend/src/pages/`. For each:

1. Copy the page body into `src/app/(app)/<route>/page.tsx` with `"use client"`.
2. Swap shadcn → Intent UI imports:
   - `Button`: prop `intent="primary|secondary|outline|plain|warning|danger"` (not `variant`), `onPress` (not `onClick`).
   - `Dialog`/`DialogContent` → `Modal`/`ModalContent` from `@/components/ui/modal`.
   - `Input`: wrap in `TextField`, place `<Input />` inside; `value`/`onChange` go on `TextField`.
   - `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`: same names, use `selectedKey`/`onSelectionChange`.
   - `Badge`: `intent` prop instead of `variant`.
   - `DataGrid` from the Vite app → keep `useReactTable` and render via Intent UI's `Table`, or use `Table` with `<TableBody items={rows}>`.
   - `DatePicker` / `DateRangePicker`: already installed.
3. Replace `axios.get("/api/...")` with `fetch("/api/...")` — the Next API routes already implement the endpoints.
4. The Accounts page (`src/app/(app)/accounts/page.tsx`) is the worked example.

## API surface (implemented)

| Method | Path |
| --- | --- |
| GET / POST | `/api/accounts` |
| PUT / DELETE | `/api/accounts/:id` |
| POST | `/api/accounts/bulk_destroy` |
| GET / POST | `/api/transactions?q=&type=&from=&to=` |
| PUT / DELETE | `/api/transactions/:id` |
| POST | `/api/transactions/bulk_destroy` |
| GET | `/api/reports/profit_and_loss?from=&to=` |
| GET | `/api/reports/cashflow?from=&to=` |
| GET | `/api/reports/balance_sheet?as_of=` |

Receipts S3 presign isn't ported yet — see `../accounting-app/backend/app/controllers/api/receipts_controller.rb` for the Rails source.

## Schema

`src/lib/db/schema.ts` mirrors the Neon `public` tables (originally created by Rails). No migrations needed — both apps read/write the same data.

## Auth

`src/lib/auth.ts` exports the same `auth` client as the Vite app (`@neondatabase/neon-js` + `BetterAuthReactAdapter`). `src/components/auth-gate.tsx` gates the `(app)` route group.
