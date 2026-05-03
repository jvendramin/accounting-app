class Receipt < ApplicationRecord
  belongs_to :txn, class_name: "Transaction", foreign_key: "transaction_id", optional: true
  validates :filename, presence: true
end
