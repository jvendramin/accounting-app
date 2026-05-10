import { relations } from "drizzle-orm"
import {
  bigint,
  bigserial,
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"

// Mirrors the existing Neon `public` schema created by the Rails app so this
// Next.js port can read/write the same data without migrations.

export const accounts = pgTable("accounts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name").notNull(),
  code: varchar("code"),
  accountType: varchar("account_type").notNull(),
  // Orthogonal to accountType — drives "where money lives" pickers
  // (cash) vs offsetting GL accounts (income / expense / tax).
  // Backfilled by the 2026-05-10 migration; new rows can leave it
  // null and the trigger / app will pick a sensible default.
  category: varchar("category"),
  description: text("description"),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
})

export const transactions = pgTable("transactions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  date: date("date").notNull(),
  description: varchar("description").notNull(),
  reference: varchar("reference"),
  transactionType: varchar("transaction_type").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  status: varchar("status").default("posted"),
  // Strongly-typed integration source ('square', 'wave', etc.) +
  // foreign id. Unique together so a Square invoice can only be
  // imported once; replaces the regex on `reference`.
  externalSource: varchar("external_source"),
  externalId: varchar("external_id"),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
})

export const journalLines = pgTable("journal_lines", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  transactionId: bigint("transaction_id", { mode: "number" }).notNull(),
  accountId: bigint("account_id", { mode: "number" }).notNull(),
  debit: numeric("debit", { precision: 14, scale: 2 }).default("0").notNull(),
  credit: numeric("credit", { precision: 14, scale: 2 }).default("0").notNull(),
  memo: text("memo"),
  // 'principal' (the cash leg) | 'category' (income/expense leg) |
  // 'tax'. Auto-classified by the journal_lines_set_role trigger; any
  // client (RN, future API consumers) can pick the cash side without
  // re-implementing the largest-line heuristic.
  role: varchar("role"),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
})

export const receipts = pgTable("receipts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  transactionId: bigint("transaction_id", { mode: "number" }),
  filename: varchar("filename").notNull(),
  contentType: varchar("content_type"),
  size: integer("size"),
  s3Key: varchar("s3_key"),
  url: varchar("url"),
  userSub: varchar("user_sub"),
  folder: varchar("folder"),
  bucket: varchar("bucket"),
  etag: varchar("etag"),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  analysis: text("analysis"),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
})

export const transactionsRelations = relations(transactions, ({ many }) => ({
  journalLines: many(journalLines),
  receipts: many(receipts),
}))

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  transaction: one(transactions, {
    fields: [journalLines.transactionId],
    references: [transactions.id],
  }),
  account: one(accounts, {
    fields: [journalLines.accountId],
    references: [accounts.id],
  }),
}))

export const receiptsRelations = relations(receipts, ({ one }) => ({
  transaction: one(transactions, {
    fields: [receipts.transactionId],
    references: [transactions.id],
  }),
}))

export const categories = pgTable("categories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name").notNull(),
  kind: varchar("kind").notNull(),
  color: varchar("color"),
  description: text("description"),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
})

export type Category = typeof categories.$inferSelect

export const taxes = pgTable("taxes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name").notNull(),
  rate: numeric("rate", { precision: 7, scale: 4 }).notNull(),
  // The GL account that gets credited (deposit) or debited
  // (withdrawal) for this tax. Replaces fragile name-based
  // matching between taxes.name and accounts.name.
  accountId: bigint("account_id", { mode: "number" }),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const transactionTaxes = pgTable("transaction_taxes", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  transactionId: bigint("transaction_id", { mode: "number" }).notNull(),
  taxId: bigint("tax_id", { mode: "number" }).notNull(),
  rate: numeric("rate", { precision: 7, scale: 4 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export type Tax = typeof taxes.$inferSelect

export const transactionDrafts = pgTable("transaction_drafts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name").notNull(),
  payload: text("payload").notNull(),
  userSub: varchar("user_sub"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})
export type TransactionDraft = typeof transactionDrafts.$inferSelect

export const squareIgnoredInvoices = pgTable("square_ignored_invoices", {
  squareId: varchar("square_id").primaryKey(),
  ignoredAt: timestamp("ignored_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
})

export const userPreferences = pgTable("user_preferences", {
  userSub: varchar("user_sub").primaryKey(),
  prefs: text("prefs").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .defaultNow()
    .notNull(),
})

export type Account = typeof accounts.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type JournalLine = typeof journalLines.$inferSelect
export type Receipt = typeof receipts.$inferSelect
