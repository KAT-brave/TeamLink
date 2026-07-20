module Api
  module V1
    class HealthController < BaseController
      skip_before_action :authenticate!, only: :show

      # GET /api/v1/health : 死活監視用。
      def show
        render json: { status: "ok" }
      end
    end
  end
end
