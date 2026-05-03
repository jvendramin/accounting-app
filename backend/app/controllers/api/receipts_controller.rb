module Api
  class ReceiptsController < BaseController
    before_action :set_receipt, only: %i[show destroy]

    def index
      scope = Receipt.order(created_at: :desc)
      scope = scope.where(user_sub: params[:user_sub]) if params[:user_sub].present?
      render json: scope.as_json
    end

    def show
      render json: @receipt
    end

    def create
      receipt = Receipt.create!(receipt_params)
      render json: receipt, status: :created
    end

    # Generate a presigned PUT URL scoped to the caller's user folder.
    # Body: { filename, content_type, user_sub }
    def presign
      bucket = ENV["AWS_S3_BUCKET"]
      if bucket.blank? || ENV["AWS_ACCESS_KEY_ID"].blank?
        return render json: { error: "S3 not configured. Set AWS_* in .env" }, status: :service_unavailable
      end

      user_sub = params[:user_sub].to_s.presence || "anonymous"
      folder = "receipts/#{user_sub}"
      key = "#{folder}/#{SecureRandom.uuid}-#{params[:filename]}"

      require "aws-sdk-s3"
      client_opts = {
        region: ENV["AWS_REGION"],
        credentials: Aws::Credentials.new(ENV["AWS_ACCESS_KEY_ID"], ENV["AWS_SECRET_ACCESS_KEY"]),
      }
      # Honor a custom S3-compatible endpoint (Backblaze B2, R2, MinIO, etc.).
      if ENV["AWS_S3_ENDPOINT"].present?
        client_opts[:endpoint] = ENV["AWS_S3_ENDPOINT"]
        client_opts[:force_path_style] = true
      end
      signer = Aws::S3::Presigner.new(client: Aws::S3::Client.new(**client_opts))

      url = signer.presigned_url(
        :put_object,
        bucket: bucket,
        key: key,
        content_type: params[:content_type] || "application/octet-stream",
      )

      public_url =
        if ENV["AWS_S3_ENDPOINT"].present?
          "#{ENV['AWS_S3_ENDPOINT'].chomp('/')}/#{bucket}/#{key}"
        else
          "https://#{bucket}.s3.#{ENV['AWS_REGION']}.amazonaws.com/#{key}"
        end

      render json: {
        upload_url: url,
        key: key,
        folder: folder,
        bucket: bucket,
        public_url: public_url,
      }
    end

    def destroy
      @receipt.destroy
      head :no_content
    end

    private

    def set_receipt
      @receipt = Receipt.find(params[:id])
    end

    def receipt_params
      params.require(:receipt).permit(
        :transaction_id, :filename, :s3_key, :url, :content_type, :size,
        :user_sub, :folder, :bucket, :etag,
        metadata: {},
      )
    end
  end
end
