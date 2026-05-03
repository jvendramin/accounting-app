module Api
  class TransactionsController < BaseController
    before_action :set_transaction, only: %i[show update destroy]

    def index
      txns = Transaction.includes(journal_lines: :account, receipts: []).order(date: :desc, id: :desc)
      txns = txns.where(transaction_type: params[:type]) if params[:type].present?
      if params[:q].present?
        q = "%#{params[:q]}%"
        txns = txns.where("description ILIKE ? OR reference ILIKE ?", q, q)
      end
      txns = txns.where("date >= ?", params[:from]) if params[:from].present?
      txns = txns.where("date <= ?", params[:to]) if params[:to].present?
      render json: txns.map { |t| serialize(t) }
    end

    def show
      render json: serialize(@transaction)
    end

    def create
      txn = Transaction.create!(transaction_params)
      render json: serialize(txn), status: :created
    end

    def update
      @transaction.journal_lines.destroy_all if params[:transaction][:journal_lines_attributes]
      @transaction.update!(transaction_params)
      render json: serialize(@transaction)
    end

    def destroy
      @transaction.destroy
      head :no_content
    end

    def bulk_destroy
      ids = Array(params[:ids]).map(&:to_i)
      Transaction.where(id: ids).destroy_all
      head :no_content
    end

    # Imports simple deposit/withdrawal rows.
    # Each row: { date, description, reference, kind: deposit|withdrawal, account_id, category_id, amount }
    def bulk_create
      created = []
      errors = []
      ActiveRecord::Base.transaction do
        Array(params[:transactions]).each_with_index do |raw, i|
          row = raw.permit(:date, :description, :reference, :kind, :account_id, :category_id, :amount).to_h
          begin
            kind = row[:kind].to_s
            amount = row[:amount].to_f
            raise "amount must be > 0" if amount <= 0
            raise "kind must be deposit or withdrawal" unless %w[deposit withdrawal].include?(kind)
            txn = Transaction.create!(
              date: row[:date], description: row[:description], reference: row[:reference],
              transaction_type: kind, amount: amount,
            )
            if kind == "deposit"
              JournalLine.create!(transaction_id: txn.id, account_id: row[:account_id], debit: amount, credit: 0)
              JournalLine.create!(transaction_id: txn.id, account_id: row[:category_id], debit: 0, credit: amount)
            else
              JournalLine.create!(transaction_id: txn.id, account_id: row[:category_id], debit: amount, credit: 0)
              JournalLine.create!(transaction_id: txn.id, account_id: row[:account_id], debit: 0, credit: amount)
            end
            created << serialize(txn)
          rescue => e
            errors << { row: i, error: e.message, data: row }
          end
        end
      end
      render json: { created: created, errors: errors }
    end

    private

    def set_transaction
      @transaction = Transaction.includes(journal_lines: :account, receipts: []).find(params[:id])
    end

    def transaction_params
      params.require(:transaction).permit(
        :date, :description, :reference, :transaction_type, :amount, :status,
        journal_lines_attributes: [:id, :account_id, :debit, :credit, :memo, :_destroy]
      )
    end

    def serialize(t)
      t.as_json.merge(
        amount: t.amount.to_f,
        journal_lines: t.journal_lines.map { |l|
          { id: l.id, account_id: l.account_id, account_name: l.account.name,
            debit: l.debit.to_f, credit: l.credit.to_f, memo: l.memo }
        },
        receipts: t.receipts.as_json
      )
    end
  end
end
