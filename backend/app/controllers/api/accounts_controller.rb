module Api
  class AccountsController < BaseController
    before_action :set_account, only: %i[show update destroy]

    def index
      accounts = Account.order(:account_type, :code, :name)
      render json: accounts.map { |a| serialize(a) }
    end

    def show
      render json: serialize(@account)
    end

    def create
      account = Account.create!(account_params)
      render json: serialize(account), status: :created
    end

    def update
      @account.update!(account_params)
      render json: serialize(@account)
    end

    def destroy
      @account.destroy
      head :no_content
    end

    def bulk_create
      created = []
      errors = []
      Array(params[:accounts]).each_with_index do |raw, i|
        attrs = raw.permit(:name, :code, :account_type, :description).to_h
        a = Account.new(attrs)
        if a.save
          created << serialize(a)
        else
          errors << { row: i, error: a.errors.full_messages.join(", "), data: attrs }
        end
      end
      render json: { created: created, errors: errors }
    end

    def bulk_destroy
      ids = Array(params[:ids]).map(&:to_i)
      Account.where(id: ids).destroy_all
      head :no_content
    end

    private

    def set_account
      @account = Account.find(params[:id])
    end

    def account_params
      params.require(:account).permit(:name, :code, :account_type, :description)
    end

    def serialize(a)
      a.as_json.merge(balance: a.balance.to_f)
    end
  end
end
