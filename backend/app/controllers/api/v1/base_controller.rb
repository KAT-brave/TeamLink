module Api
  module V1
    # API v1 の基底コントローラ。認証・CSRF・エラー整形を集約する。
    class BaseController < ActionController::API
      include ActionController::Cookies
      include ActionController::RequestForgeryProtection

      protect_from_forgery with: :exception
      # ActionController::API は test.rb の設定を継承しないため、test では明示的に無効化。
      # (CSRF拒否の検証は csrf_spec で本クラスの属性を個別に有効化して行う)
      self.allow_forgery_protection = false if Rails.env.test?

      before_action :authenticate!

      rescue_from ActionController::InvalidAuthenticityToken do
        render json: { error: "リクエストが無効です。ページを再読み込みしてください。" },
               status: :unprocessable_entity
      end

      rescue_from ActionController::ParameterMissing do
        render json: { error: "入力が不正です。" }, status: :unprocessable_entity
      end

      private

      def current_user
        @current_user ||= User.find_by(id: session[:user_id])
      end

      # 権限確認はフロントに依存せず、必ずバックエンドで行う。
      def authenticate!
        render_unauthorized unless current_user
      end

      def render_unauthorized(message = "ログインが必要です。")
        render json: { error: message }, status: :unauthorized
      end

      def sign_in(user)
        reset_session
        session[:user_id] = user.id
      end

      def sign_out
        reset_session
      end
    end
  end
end
