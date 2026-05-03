require "date"

Account.destroy_all
Transaction.destroy_all

accounts = {
  cash: Account.create!(name: "Cash", code: "1000", account_type: "asset"),
  bank: Account.create!(name: "Bank Checking", code: "1010", account_type: "asset"),
  ar: Account.create!(name: "Accounts Receivable", code: "1100", account_type: "asset"),
  ap: Account.create!(name: "Accounts Payable", code: "2000", account_type: "liability"),
  equity: Account.create!(name: "Owner's Equity", code: "3000", account_type: "equity"),
  sales: Account.create!(name: "Sales Revenue", code: "4000", account_type: "income"),
  services: Account.create!(name: "Service Revenue", code: "4100", account_type: "income"),
  rent: Account.create!(name: "Rent Expense", code: "5000", account_type: "expense"),
  software: Account.create!(name: "Software Subscriptions", code: "5100", account_type: "expense"),
  meals: Account.create!(name: "Meals & Entertainment", code: "5200", account_type: "expense"),
  travel: Account.create!(name: "Travel", code: "5300", account_type: "expense"),
}

def post_txn(date, description, type, lines, reference: nil)
  amount = lines.sum { |l| l[:debit].to_f }
  txn = Transaction.create!(date: date, description: description, transaction_type: type, reference: reference, amount: amount)
  lines.each { |l| JournalLine.create!(transaction_id: txn.id, account_id: l[:account].id, debit: l[:debit] || 0, credit: l[:credit] || 0, memo: l[:memo]) }
  txn
end

today = Date.current
6.times do |i|
  m = today.prev_month(i)
  post_txn(m, "Client invoice ##{1000 + i}", "deposit",
    [{ account: accounts[:bank], debit: 4500 + i*250 }, { account: accounts[:sales], credit: 4500 + i*250 }], reference: "INV-#{1000+i}")
  post_txn(m + 2, "Stripe deposit", "deposit",
    [{ account: accounts[:bank], debit: 1200 }, { account: accounts[:services], credit: 1200 }])
  post_txn(m + 5, "Office rent", "withdrawal",
    [{ account: accounts[:rent], debit: 1800 }, { account: accounts[:bank], credit: 1800 }], reference: "RENT")
  post_txn(m + 7, "GitHub + Figma + Linear", "withdrawal",
    [{ account: accounts[:software], debit: 240 }, { account: accounts[:bank], credit: 240 }])
  post_txn(m + 12, "Client lunch", "withdrawal",
    [{ account: accounts[:meals], debit: 84 }, { account: accounts[:bank], credit: 84 }])
  post_txn(m + 18, "Flight to client site", "withdrawal",
    [{ account: accounts[:travel], debit: 420 }, { account: accounts[:bank], credit: 420 }]) if i.even?
end

post_txn(today - 30, "Owner contribution", "journal_entry",
  [{ account: accounts[:bank], debit: 10000 }, { account: accounts[:equity], credit: 10000 }], reference: "OPEN")

puts "Seeded #{Account.count} accounts and #{Transaction.count} transactions."
