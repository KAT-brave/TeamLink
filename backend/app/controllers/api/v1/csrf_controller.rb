module Api
  module V1
    class CsrfController < BaseController
      skip_before_action :authenticate!, only: :show

      # GET /api/v1/auth/csrf : SPA が変更系リクエストで送る CSRF トークンを返す。
      def show
        render json: { csrfToken: form_authenticity_token }
      end
    end
  end
end
