-- The Rails-era schema declared `created_at` / `updated_at` as NOT NULL but
-- relied on Rails callbacks to populate them. Drizzle's `.defaultNow()` is
-- only a TypeScript-side hint, so inserts skipping those columns failed at
-- the DB with `null value in column "created_at" ... violates not-null`.
-- Set DB-level defaults so any client (Drizzle, raw psql, future ORM) just
-- works.

alter table transactions  alter column created_at set default now(),
                          alter column updated_at set default now();
alter table journal_lines alter column created_at set default now(),
                          alter column updated_at set default now();
alter table accounts      alter column created_at set default now(),
                          alter column updated_at set default now();
alter table receipts      alter column created_at set default now(),
                          alter column updated_at set default now();
