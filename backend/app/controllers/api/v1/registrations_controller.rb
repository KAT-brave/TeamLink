module Api
  module V1
    class RegistrationsController < BaseController
      skip_before_action :authenticate!, only: :create

      # POST /api/v1/auth/signup
      def create
        user = User.new(user_params)
        if user.save
          sign_in(user)
          render json: { user: user.public_attributes }, status: :created
        else
          render json: { errors: user.errors.messages }, status: :unprocessable_entity
        end
      end

      private

      def user_params
        params.require(:user).permit(:name, :email, :password)
      end
    end
  end
end
