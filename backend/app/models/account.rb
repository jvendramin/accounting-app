class Account < ApplicationRecord
  TYPES = %w[asset liability equity income expense].freeze

  has_many :journal_lines, dependent: :destroy
  has_many :transactions, through: :journal_lines

  validates :name, presence: true
  validates :account_type, inclusion: { in: TYPES }

  def balance
    debits = journal_lines.sum(:debit)
    credits = journal_lines.sum(:credit)
    case account_type
    when "asset", "expense"
      debits - credits
    else
      credits - debits
    end
  end
end
