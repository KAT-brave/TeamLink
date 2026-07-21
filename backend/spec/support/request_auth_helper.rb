# request spec 用: 実際にログインAPIを叩いてセッションCookieを確立する。
module RequestAuthHelper
  def login_as(user, password: "password123")
    post "/api/v1/auth/login", params: { email: user.email, password: password }, as: :json
    expect(response).to have_http_status(:ok)
  end
end

RSpec.configure do |config|
  config.include RequestAuthHelper, type: :request
end
