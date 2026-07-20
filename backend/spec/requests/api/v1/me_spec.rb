require "rails_helper"

RSpec.describe "Api::V1::Me", type: :request do
  it "未ログインは401" do
    get "/api/v1/me"
    expect(response).to have_http_status(:unauthorized)
  end

  it "ログイン後は200で自分の情報を返す" do
    create(:user, email: "carol@example.com", password: "password123")
    post "/api/v1/auth/login",
         params: { email: "carol@example.com", password: "password123" }, as: :json
    get "/api/v1/me"
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig("user", "email")).to eq("carol@example.com")
  end
end
