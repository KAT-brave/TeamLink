require "rails_helper"

RSpec.describe "Api::V1::WorkspaceJoins", type: :request do
  let(:user) { create(:user) }
  let(:ws) { create(:workspace, :with_owner_membership) }

  describe "認証" do
    it "未ログインは401" do
      post "/api/v1/workspaces/join", params: { code: "any-code" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "認証済み" do
    before { login_as(user) }

    it "正しい招待コードで参加でき member になる" do
      code = ws.invite_code # 計測前にワークスペース(所有者メンバーシップ含む)を確定
      expect {
        post "/api/v1/workspaces/join", params: { code: code }, as: :json
      }.to change(WorkspaceMembership, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(ws.membership_for(user).role).to eq("member")
    end

    it "重複参加は409" do
      post "/api/v1/workspaces/join", params: { code: ws.invite_code }, as: :json
      post "/api/v1/workspaces/join", params: { code: ws.invite_code }, as: :json
      expect(response).to have_http_status(:conflict)
    end

    it "無効なコードは404(存在秘匿)" do
      post "/api/v1/workspaces/join", params: { code: "invalid-code" }, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end
end
