module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      user = User.find_by(id: session[:user_id])
      reject_unauthorized_connection unless user
      user
    end

    def session
      @session ||= request.session
    end
  end
end
