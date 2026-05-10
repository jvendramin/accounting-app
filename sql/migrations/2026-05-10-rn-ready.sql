-- Schema upgrades for "RN-ready" data layer.
-- Idempotent — safe to re-run.
-- Strategy: additive only (no drops). Existing queries keep working.

BEGIN;

-- 1. accounts.category — orthogonal to account_type. Drives the "where
--    money lives / where it offsets" pickers without TS heuristics.
DO $$ BEGIN
  CREATE TYPE account_category AS ENUM (
    'cash',     -- assets you spend from / liabilities you charge against
    'income',
    'expense',
    'tax',      -- collected on behalf of a tax authority (GST, HST, etc.)
    'equity',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS category account_category;

-- Backfill: derive from account_type + name where the type alone is
-- ambiguous (e.g. tax-flavoured liabilities).
UPDATE accounts SET category =
  CASE
    WHEN lower(name) ~ '(gst|hst|pst|vat|sales tax|tax payable)' THEN 'tax'
    WHEN account_type = 'asset'                                   THEN 'cash'
    WHEN account_type = 'liability'                               THEN 'cash'
    WHEN account_type = 'income'                                  THEN 'income'
    WHEN account_type = 'expense'                                 THEN 'expense'
    WHEN account_type = 'equity'                                  THEN 'equity'
    ELSE 'other'
  END::account_category
WHERE category IS NULL;

-- 2. taxes.account_id — replaces name-based matching between a tax row
--    and the GL account that gets credited / debited for it.
ALTER TABLE taxes
  ADD COLUMN IF NOT EXISTS account_id bigint
    REFERENCES accounts(id) ON DELETE SET NULL;

UPDATE taxes t SET account_id = a.id
  FROM accounts a
 WHERE t.account_id IS NULL
   AND lower(a.name) = lower(t.name);

-- 3. transactions.external_source + external_id — replaces the
--    "Square invoice X" regex on `reference`. Unique per (source, id)
--    so future syncs do an indexed lookup, not a string scan.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_source varchar,
  ADD COLUMN IF NOT EXISTS external_id     varchar;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_uniq
  ON transactions(external_source, external_id)
 WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- Backfill from existing reference values for Square + Wave.
UPDATE transactions
   SET external_source = 'square',
       external_id     = (regexp_match(reference, 'Square invoice (\S+)'))[1]
 WHERE external_source IS NULL
   AND reference ~ 'Square invoice ';

UPDATE transactions
   SET external_source = 'wave'
 WHERE external_source IS NULL
   AND reference LIKE 'Wave import%';

-- 4. journal_lines.role — single source of truth for "principal cash
--    side" vs "category" vs "tax". Populated by trigger going forward,
--    backfilled now from line shape + account category.
DO $$ BEGIN
  CREATE TYPE journal_line_role AS ENUM ('principal', 'category', 'tax');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE journal_lines
  ADD COLUMN IF NOT EXISTS role journal_line_role;

-- Backfill: principal = the (debit for deposit / credit for withdrawal)
-- line whose account.category = 'cash'. Tax = any line whose account
-- category = 'tax'. Everything else = category.
WITH principals AS (
  SELECT DISTINCT ON (jl.transaction_id) jl.id
    FROM journal_lines jl
    JOIN transactions  t ON t.id  = jl.transaction_id
    JOIN accounts      a ON a.id  = jl.account_id
   WHERE a.category = 'cash'
     AND ((t.transaction_type = 'deposit'    AND jl.debit  > 0)
       OR (t.transaction_type = 'withdrawal' AND jl.credit > 0))
   ORDER BY jl.transaction_id, GREATEST(jl.debit, jl.credit) DESC
)
UPDATE journal_lines jl SET role =
  CASE
    WHEN jl.id IN (SELECT id FROM principals) THEN 'principal'
    WHEN (SELECT category FROM accounts WHERE id = jl.account_id) = 'tax' THEN 'tax'
    ELSE 'category'
  END::journal_line_role
WHERE role IS NULL;

-- Trigger: classify role on every insert/update so RN clients (or
-- API callers that omit the column) still get the right value.
CREATE OR REPLACE FUNCTION journal_lines_set_role() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_acct_category account_category;
  v_txn_type      varchar;
  v_max_principal numeric;
BEGIN
  IF NEW.role IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT category INTO v_acct_category FROM accounts WHERE id = NEW.account_id;
  SELECT transaction_type INTO v_txn_type FROM transactions WHERE id = NEW.transaction_id;

  IF v_acct_category = 'tax' THEN
    NEW.role := 'tax';
  ELSIF v_acct_category = 'cash'
    AND ((v_txn_type = 'deposit'    AND NEW.debit  > 0)
      OR (v_txn_type = 'withdrawal' AND NEW.credit > 0)) THEN
    -- Don't blindly stamp principal — only the largest cash-side line
    -- on this transaction is principal. Tie-break: first one inserted.
    SELECT GREATEST(MAX(debit), MAX(credit))
      INTO v_max_principal
      FROM journal_lines
     WHERE transaction_id = NEW.transaction_id
       AND role = 'principal';
    IF v_max_principal IS NULL OR GREATEST(NEW.debit, NEW.credit) > v_max_principal THEN
      -- Demote any earlier "principal" on this txn to category.
      UPDATE journal_lines SET role = 'category'
        WHERE transaction_id = NEW.transaction_id AND role = 'principal';
      NEW.role := 'principal';
    ELSE
      NEW.role := 'category';
    END IF;
  ELSE
    NEW.role := 'category';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS journal_lines_set_role_trg ON journal_lines;
CREATE TRIGGER journal_lines_set_role_trg
  BEFORE INSERT ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION journal_lines_set_role();

-- 5. Balanced journal — deferrable so multi-statement inserts (one
--    transaction + N lines) commit cleanly; the constraint fires once
--    per outer transaction at COMMIT time.
CREATE OR REPLACE FUNCTION transactions_assert_balanced() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_dr numeric;
  v_cr numeric;
  v_n  int;
BEGIN
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0), COUNT(*)
    INTO v_dr, v_cr, v_n
    FROM journal_lines
   WHERE transaction_id = NEW.id;
  -- Allow zero-line transactions (in-flight inserts) to slip through;
  -- only enforce balance when at least one line exists at commit time.
  IF v_n > 0 AND ABS(v_dr - v_cr) > 0.005 THEN
    RAISE EXCEPTION
      'Transaction % is unbalanced: debits=% credits=%',
      NEW.id, v_dr, v_cr USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS transactions_assert_balanced_trg ON transactions;
CREATE CONSTRAINT TRIGGER transactions_assert_balanced_trg
  AFTER INSERT OR UPDATE ON transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION transactions_assert_balanced();

-- 6. Report RPCs — single source of truth for P&L / Balance Sheet /
--    Cashflow / Taxes. Same shape the API endpoints already return.

CREATE OR REPLACE FUNCTION rpc_report_profit_and_loss(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH lines AS (
    SELECT t.date, jl.debit, jl.credit, a.account_type
      FROM transactions t
      JOIN journal_lines jl ON jl.transaction_id = t.id
      JOIN accounts a       ON a.id = jl.account_id
     WHERE (p_from IS NULL OR t.date >= p_from)
       AND (p_to   IS NULL OR t.date <= p_to)
       AND a.account_type IN ('income','expense')
  ),
  totals AS (
    SELECT
      COALESCE(SUM(CASE WHEN account_type='income'  THEN credit-debit END), 0)::float8 AS total_income,
      COALESCE(SUM(CASE WHEN account_type='expense' THEN debit-credit END), 0)::float8 AS total_expense
    FROM lines
  ),
  monthly AS (
    SELECT
      to_char(date_trunc('month', date), 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN account_type='income'  THEN credit-debit END), 0)::float8 AS income,
      COALESCE(SUM(CASE WHEN account_type='expense' THEN debit-credit END), 0)::float8 AS expense
    FROM lines
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'total_income',  (SELECT total_income FROM totals),
    'total_expense', (SELECT total_expense FROM totals),
    'net_income',    (SELECT total_income - total_expense FROM totals),
    'monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month',   month,
        'income',  income,
        'expense', expense,
        'net',     income - expense
      ) ORDER BY month) FROM monthly
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION rpc_report_cashflow(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH lines AS (
    SELECT t.date, jl.debit, jl.credit
      FROM transactions t
      JOIN journal_lines jl ON jl.transaction_id = t.id
      JOIN accounts a       ON a.id = jl.account_id
     WHERE (p_from IS NULL OR t.date >= p_from)
       AND (p_to   IS NULL OR t.date <= p_to)
       AND a.account_type = 'asset'
  ),
  monthly AS (
    SELECT
      to_char(date_trunc('month', date), 'YYYY-MM') AS month,
      COALESCE(SUM(debit),  0)::float8 AS inflow,
      COALESCE(SUM(credit), 0)::float8 AS outflow
    FROM lines
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month',   month,
        'inflow',  inflow,
        'outflow', outflow,
        'net',     inflow - outflow
      ) ORDER BY month) FROM monthly
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION rpc_report_balance_sheet(
  p_as_of date DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH bal AS (
    SELECT a.id, a.name, a.code, a.account_type,
           COALESCE(
             CASE WHEN a.account_type IN ('asset','expense')
                  THEN SUM(CASE WHEN p_as_of IS NULL OR t.date <= p_as_of THEN jl.debit  - jl.credit END)
                  ELSE SUM(CASE WHEN p_as_of IS NULL OR t.date <= p_as_of THEN jl.credit - jl.debit  END)
             END, 0)::float8 AS balance
      FROM accounts a
      LEFT JOIN journal_lines jl ON jl.account_id = a.id
      LEFT JOIN transactions  t  ON t.id = jl.transaction_id
     GROUP BY a.id
  )
  SELECT jsonb_build_object(
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'code', code,
        'account_type', account_type, 'balance', balance
      ) ORDER BY code NULLS LAST, id) FROM bal
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION rpc_report_taxes(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT tx.id    AS tax_id, tx.name AS tax_name, tx.rate::float8 AS rate,
           tt.tax_amount::float8 AS tax_amount,
           tt.net_amount::float8 AS net_amount,
           tt.transaction_id, t.date, t.description, t.transaction_type,
           t.amount::float8 AS amount
      FROM taxes tx
      LEFT JOIN transaction_taxes tt ON tt.tax_id = tx.id
      LEFT JOIN transactions t       ON t.id = tt.transaction_id
     WHERE (p_from IS NULL OR t.date IS NULL OR t.date >= p_from)
       AND (p_to   IS NULL OR t.date IS NULL OR t.date <= p_to)
  ),
  totals AS (
    SELECT tax_id, tax_name, rate,
           COALESCE(SUM(tax_amount), 0)::float8 AS collected,
           COALESCE(SUM(net_amount), 0)::float8 AS net,
           COUNT(transaction_id)::int          AS count
      FROM base
     GROUP BY tax_id, tax_name, rate
     ORDER BY tax_name
  )
  SELECT jsonb_build_object(
    'totals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tax_id', tax_id, 'tax_name', tax_name, 'rate', rate,
        'collected', collected, 'net', net, 'count', count
      ) ORDER BY tax_name) FROM totals
    ), '[]'::jsonb),
    'details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'transaction_id', transaction_id, 'tax_id', tax_id,
        'tax_name', tax_name, 'tax_rate', rate, 'rate', rate,
        'tax_amount', tax_amount, 'net_amount', net_amount,
        'date', date, 'description', description,
        'transaction_type', transaction_type, 'amount', amount
      ) ORDER BY date DESC, transaction_id DESC)
        FROM base WHERE transaction_id IS NOT NULL
    ), '[]'::jsonb)
  );
$$;

COMMIT;
