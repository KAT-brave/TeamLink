require "rails_helper"

RSpec.describe "Api::V1 CSRF protection", type: :request do
  around do |example|
    original = Api::V1::BaseController.allow_forgery_protection
    Api::V1::BaseController.allow_forgery_protection = true
    example.run
    Api::V1::BaseController.allow_forgery_protection = original
  end

  it "CSRFトークン無しの変更系(login)は拒否され422" do
    post "/api/v1/auth/login",
         params: { email: "x@example.com", password: "password123" }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "GET /api/v1/auth/csrf はトークンを返す" do
    get "/api/v1/auth/csrf"
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["csrfToken"]).to be_present
  end
end
