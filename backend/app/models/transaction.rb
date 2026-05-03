class Transaction < ApplicationRecord
  TYPES = %w[deposit withdrawal journal_entry receipt].freeze

  has_many :journal_lines, dependent: :destroy, inverse_of: :txn
  has_many :accounts, through: :journal_lines
  has_many :receipts, dependent: :destroy

  accepts_nested_attributes_for :journal_lines, allow_destroy: true

  validates :date, :description, :transaction_type, presence: true
  validates :transaction_type, inclusion: { in: TYPES }

  scope :between, ->(from, to) { where(date: from..to) }
end
