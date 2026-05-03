# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_05_02_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pg_session_jwt"

  create_table "accounts", force: :cascade do |t|
    t.string "account_type", null: false
    t.string "code"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["account_type"], name: "index_accounts_on_account_type"
  end

  create_table "journal_lines", force: :cascade do |t|
    t.bigint "account_id", null: false
    t.datetime "created_at", null: false
    t.decimal "credit", precision: 14, scale: 2, default: "0.0"
    t.decimal "debit", precision: 14, scale: 2, default: "0.0"
    t.string "memo"
    t.bigint "transaction_id", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_journal_lines_on_account_id"
    t.index ["transaction_id"], name: "index_journal_lines_on_transaction_id"
  end

  create_table "receipts", force: :cascade do |t|
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "s3_key"
    t.integer "size"
    t.bigint "transaction_id"
    t.datetime "updated_at", null: false
    t.string "url"
    t.index ["transaction_id"], name: "index_receipts_on_transaction_id"
  end

  create_table "transactions", force: :cascade do |t|
    t.decimal "amount", precision: 14, scale: 2, default: "0.0"
    t.datetime "created_at", null: false
    t.date "date", null: false
    t.string "description", null: false
    t.string "reference"
    t.string "status", default: "posted"
    t.string "transaction_type", null: false
    t.datetime "updated_at", null: false
    t.index ["date"], name: "index_transactions_on_date"
    t.index ["transaction_type"], name: "index_transactions_on_transaction_type"
  end

  add_foreign_key "journal_lines", "accounts"
  add_foreign_key "journal_lines", "transactions"
  add_foreign_key "receipts", "transactions"
end
