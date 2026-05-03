module Api
  class ReportsController < BaseController
    def profit_and_loss
      from = parse_date(params[:from], 1.year.ago.to_date.beginning_of_month)
      to = parse_date(params[:to], Date.current)
      lines = JournalLine.joins(:txn, :account).where(transactions: { date: from..to })

      income_rows = aggregate(lines.where(accounts: { account_type: "income" }), credit_minus_debit: true)
      expense_rows = aggregate(lines.where(accounts: { account_type: "expense" }), credit_minus_debit: false)

      total_income = income_rows.sum { |r| r[:amount] }
      total_expense = expense_rows.sum { |r| r[:amount] }

      render json: {
        from: from, to: to,
        income: income_rows, expense: expense_rows,
        total_income: total_income, total_expense: total_expense,
        net_income: total_income - total_expense,
        monthly: monthly_pnl(from, to)
      }
    end

    def balance_sheet
      as_of = parse_date(params[:as_of], Date.current)
      lines = JournalLine.joins(:txn, :account).where("transactions.date <= ?", as_of)

      assets = aggregate(lines.where(accounts: { account_type: "asset" }), credit_minus_debit: false)
      liabilities = aggregate(lines.where(accounts: { account_type: "liability" }), credit_minus_debit: true)
      equity = aggregate(lines.where(accounts: { account_type: "equity" }), credit_minus_debit: true)

      render json: {
        as_of: as_of,
        assets: assets, liabilities: liabilities, equity: equity,
        total_assets: assets.sum { |r| r[:amount] },
        total_liabilities: liabilities.sum { |r| r[:amount] },
        total_equity: equity.sum { |r| r[:amount] }
      }
    end

    def cashflow
      from = parse_date(params[:from], 6.months.ago.to_date.beginning_of_month)
      to = parse_date(params[:to], Date.current)
      cash_account_ids = Account.where(account_type: "asset").where("name ILIKE ? OR name ILIKE ?", "%cash%", "%bank%").pluck(:id)
      monthly = (from.beginning_of_month..to).group_by { |d| d.beginning_of_month }.keys.uniq.map do |m|
        scope = JournalLine.joins(:txn).where(account_id: cash_account_ids).where(transactions: { date: m..m.end_of_month })
        inflow = scope.sum(:debit).to_f
        outflow = scope.sum(:credit).to_f
        { month: m.strftime("%Y-%m"), inflow: inflow, outflow: outflow, net: inflow - outflow }
      end
      render json: { from: from, to: to, monthly: monthly }
    end

    private

    def parse_date(v, default)
      v.present? ? Date.parse(v) : default
    end

    def aggregate(scope, credit_minus_debit:)
      scope.group("accounts.id", "accounts.name").pluck("accounts.id", "accounts.name", "SUM(journal_lines.debit)", "SUM(journal_lines.credit)").map do |id, name, d, c|
        amount = credit_minus_debit ? (c.to_f - d.to_f) : (d.to_f - c.to_f)
        { account_id: id, name: name, amount: amount }
      end.sort_by { |r| -r[:amount] }
    end

    def monthly_pnl(from, to)
      months = []
      cur = from.beginning_of_month
      while cur <= to
        scope = JournalLine.joins(:txn, :account).where(transactions: { date: cur..cur.end_of_month })
        income = scope.where(accounts: { account_type: "income" }).sum("credit - debit").to_f
        expense = scope.where(accounts: { account_type: "expense" }).sum("debit - credit").to_f
        months << { month: cur.strftime("%Y-%m"), income: income, expense: expense, net: income - expense }
        cur = cur.next_month
      end
      months
    end
  end
end
