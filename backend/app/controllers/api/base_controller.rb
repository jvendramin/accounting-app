module Api
  class BaseController < ActionController::API
    rescue_from ActiveRecord::RecordNotFound, with: :not_found
    rescue_from ActiveRecord::RecordInvalid, with: :unprocessable

    private

    def not_found(e)
      render json: { error: e.message }, status: :not_found
    end

    def unprocessable(e)
      render json: { error: e.message, details: e.record&.errors }, status: :unprocessable_entity
    end
  end
end
