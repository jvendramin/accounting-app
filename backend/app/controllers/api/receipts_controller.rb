module Api
  class ReceiptsController < BaseController
    before_action :set_receipt, only: %i[show destroy]

    def index
      render json: Receipt.order(created_at: :desc).as_json
    end

    def show
      render json: @receipt
    end

    def create
      receipt = Receipt.create!(receipt_params)
      render json: receipt, status: :created
    end

    def presign
      key = "receipts/#{SecureRandom.uuid}-#{params[:filename]}"
      bucket = ENV["AWS_S3_BUCKET"]
      if bucket.blank? || ENV["AWS_ACCESS_KEY_ID"].blank?
        return render json: { error: "S3 not configured. Set AWS_* in .env" }, status: :service_unavailable
      end
      require "aws-sdk-s3"
      signer = Aws::S3::Presigner.new(client: Aws::S3::Client.new(
        region: ENV["AWS_REGION"],
        credentials: Aws::Credentials.new(ENV["AWS_ACCESS_KEY_ID"], ENV["AWS_SECRET_ACCESS_KEY"])
      ))
      url = signer.presigned_url(:put_object, bucket: bucket, key: key,
                                 content_type: params[:content_type] || "application/octet-stream")
      public_url = "https://#{bucket}.s3.#{ENV['AWS_REGION']}.amazonaws.com/#{key}"
      render json: { upload_url: url, key: key, public_url: public_url }
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
      params.require(:receipt).permit(:transaction_id, :filename, :s3_key, :url, :content_type, :size)
    end
  end
end
