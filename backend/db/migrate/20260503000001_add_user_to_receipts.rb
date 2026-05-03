class AddUserToReceipts < ActiveRecord::Migration[8.1]
  def change
    add_column :receipts, :user_sub, :string
    add_column :receipts, :folder, :string
    add_column :receipts, :bucket, :string
    add_column :receipts, :etag, :string
    add_column :receipts, :metadata, :jsonb, default: {}, null: false
    add_index :receipts, :user_sub
  end
end
