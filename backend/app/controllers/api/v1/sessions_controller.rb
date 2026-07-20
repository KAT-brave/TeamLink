module Api
  module V1
    class SessionsController < BaseController
      skip_before_action :authenticate!, only: :create

      # POST /api/v1/auth/login
      def create
        user = User.find_by(email: params[:email].to_s.strip.downcase)
        if user&.authenticate(params[:password])
          sign_in(user)
          render json: { user: user.public_attributes }, status: :ok
        else
          # 認証失敗時は内部情報を出さず汎用文言のみ返す。
          render json: { error: "メールアドレスまたはパスワードが正しくありません。" },
                 status: :unauthorized
        end
      end

      # DELETE /api/v1/auth/logout
      def destroy
        sign_out
        head :no_content
      end
    end
  end
end
