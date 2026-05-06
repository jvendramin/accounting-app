import { relations } from "drizzle-orm"
import {
  bigint,
  bigserial,
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
