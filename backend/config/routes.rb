Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    resources :accounts do
      collection do
        post :bulk_create
        post :bulk_destroy
      end
    end
    resources :transactions do
      collection do
        post :bulk_create
        post :bulk_destroy
      end
    end
    resources :receipts do
      collection { post :presign }
    end
    get "reports/profit_and_loss", to: "reports#profit_and_loss"
    get "reports/balance_sheet", to: "reports#balance_sheet"
    get "reports/cashflow", to: "reports#cashflow"
  end
end
