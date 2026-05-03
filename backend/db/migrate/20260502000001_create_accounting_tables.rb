class CreateAccountingTables < ActiveRecord::Migration[8.1]
  def change
    create_table :accounts do |t|
      t.string :name, null: false
      t.string :code
      t.string :account_type, null: false # asset, liability, equity, income, expense
      t.text :description
      t.timestamps
    end
    add_index :accounts, :account_type

    create_table :transactions do |t|
      t.date :date, null: false
      t.string :description, null: false
      t.string :reference
      t.string :transaction_type, null: false # deposit, withdrawal, journal_entry, receipt
      t.decimal :amount, precision: 14, scale: 2, default: 0
      t.string :status, default: "posted"
      t.timestamps
    end
    add_index :transactions, :date
    add_index :transactions, :transaction_type

    create_table :journal_lines do |t|
      t.references :transaction, null: false, foreign_key: true
      t.references :account, null: false, foreign_key: true
      t.decimal :debit, precision: 14, scale: 2, default: 0
      t.decimal :credit, precision: 14, scale: 2, default: 0
      t.string :memo
      t.timestamps
    end

    create_table :receipts do |t|
      t.references :transaction, foreign_key: true
      t.string :filename, null: false
      t.string :s3_key
      t.string :url
      t.string :content_type
      t.integer :size
      t.timestamps
    end
  end
end
