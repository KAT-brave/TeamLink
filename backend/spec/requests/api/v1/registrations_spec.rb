require "rails_helper"

RSpec.describe "Api::V1::Registrations", type: :request do
  let(:valid_params) do
    { user: { name: "Alice", email: "alice@example.com", password: "password123" } }
  end

  it "有効な入力で登録し201とユーザーを返す" do
    expect {
      post "/api/v1/auth/signup", params: valid_params, as: :json
    }.to change(User, :count).by(1)

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    expect(body.dig("user", "email")).to eq("alice@example.com")
    expect(body["user"]).not_to have_key("password_digest")
  end

  it "登録後はログイン状態になる(/me が200)" do
    post "/api/v1/auth/signup", params: valid_params, as: :json
    get "/api/v1/me"
    expect(response).to have_http_status(:ok)
  end

  it "メール重複は422" do
    create(:user, email: "alice@example.com")
    post "/api/v1/auth/signup", params: valid_params, as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(JSON.parse(response.body)).to have_key("errors")
  end

  it "不正な入力は422" do
    post "/api/v1/auth/signup",
         params: { user: { name: "", email: "bad", password: "x" } }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end
end
