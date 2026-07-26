require 'rails_helper'

module ApplicationCable
  describe Connection, type: :channel do
    let(:user) { create(:user) }

    describe "connect 成功" do
      it "有効なsession[:user_id]で接続成功" do
        connect(session: { user_id: user.id })
        expect(connection.current_user).to eq(user)
      end
    end

    describe "connect 未認証拒否" do
      it "session[:user_id]なしで接続拒否" do
        expect { connect }.to raise_error(
          ActionCable::Connection::Authorization::UnauthorizedError
        )
      end
    end

    describe "connect 存在しないユーザー拒否" do
      it "存在しないuser_idで接続拒否" do
        expect { connect(session: { user_id: 999999 }) }.to raise_error(
          ActionCable::Connection::Authorization::UnauthorizedError
        )
      end
    end
  end
end
