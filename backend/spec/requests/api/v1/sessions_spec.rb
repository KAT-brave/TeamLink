require "rails_helper"

RSpec.describe "Api::V1::Sessions", type: :request do
  let!(:user) { create(:user, email: "bob@example.com", password: "password123") }
  let(:generic_message) { "メールアドレスまたはパスワードが正しくありません。" }

  it "正しい資格情報でログインでき200" do
    post "/api/v1/auth/login",
         params: { email: "bob@example.com", password: "password123" }, as: :json
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig("user", "email")).to eq("bob@example.com")
  end

  it "大文字メールでもログインできる" do
    post "/api/v1/auth/login",
         params: { email: "BOB@example.com", password: "password123" }, as: :json
    expect(response).to have_http_status(:ok)
  end

  it "パスワード誤りは401かつ汎用文言" do
    post "/api/v1/auth/login",
         params: { email: "bob@example.com", password: "wrong" }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(JSON.parse(response.body)["error"]).to eq(generic_message)
  end

  it "存在しないメールも同一の汎用文言を返す(情報を漏らさない)" do
    post "/api/v1/auth/login",
         params: { email: "nobody@example.com", password: "password123" }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(JSON.parse(response.body)["error"]).to eq(generic_message)
  end

  it "ログアウトで204、以降 /me は401" do
    post "/api/v1/auth/login",
         params: { email: "bob@example.com", password: "password123" }, as: :json
    delete "/api/v1/auth/logout"
    expect(response).to have_http_status(:no_content)

    get "/api/v1/me"
    expect(response).to have_http_status(:unauthorized)
  end

  it "未ログインでのログアウトは401" do
    delete "/api/v1/auth/logout"
    expect(response).to have_http_status(:unauthorized)
  end
end
