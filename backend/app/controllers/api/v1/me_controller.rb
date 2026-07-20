module Api
  module V1
    class MeController < BaseController
      # GET /api/v1/me (ログイン状態の復元に使用)
      def show
        render json: { user: current_user.public_attributes }
      end
    end
  end
end
