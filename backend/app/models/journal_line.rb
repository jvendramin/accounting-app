class JournalLine < ApplicationRecord
  belongs_to :txn, class_name: "Transaction", foreign_key: "transaction_id", inverse_of: :journal_lines
  belongs_to :account

  validates :debit, :credit, numericality: { greater_than_or_equal_to: 0 }
end
