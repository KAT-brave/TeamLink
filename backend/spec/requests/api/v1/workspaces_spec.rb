require "rails_helper"

RSpec.describe "Api::V1::Workspaces", type: :request do
  let(:user) { create(:user) }

  describe "認証" do
    it "未ログインは401" do
      get "/api/v1/workspaces"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /workspaces (作成)" do
    before { login_as(user) }

    it "作成でき、作成者が所有者になる" do
      expect {
        post "/api/v1/workspaces", params: { workspace: { name: "My WS" } }, as: :json
      }.to change(Workspace, :count).by(1)
      expect(response).to have_http_status(:created)
      ws = Workspace.last
      expect(ws.owner).to eq(user)
      expect(ws.membership_for(user).role).to eq("owner")
      expect(ws.invite_code).to be_present
    end

    it "name 空は422" do
      post "/api/v1/workspaces", params: { workspace: { name: "" } }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "GET /workspaces (一覧)" do
    it "自分が所属するものだけ返す" do
      mine = create(:workspace, :with_owner_membership, owner: user)
      other = create(:workspace, :with_owner_membership)
      login_as(user)
      get "/api/v1/workspaces"
      ids = JSON.parse(response.body)["workspaces"].map { |w| w["id"] }
      expect(ids).to include(mine.id)
      expect(ids).not_to include(other.id)
    end
  end

  describe "GET /workspaces/:id (詳細)" do
    let(:ws) { create(:workspace, :with_owner_membership, owner: user) }

    it "所属者は閲覧でき role を含む" do
      login_as(user)
      get "/api/v1/workspaces/#{ws.id}"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["role"]).to eq("owner")
    end

    it "非所属者は404(URL直打ちでも閲覧不可)" do
      outsider = create(:user)
      login_as(outsider)
      get "/api/v1/workspaces/#{ws.id}"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /workspaces/:id (名前編集)" do
    let(:ws) { create(:workspace, :with_owner_membership, owner: user) }

    it "所有者は編集できる" do
      login_as(user)
      patch "/api/v1/workspaces/#{ws.id}", params: { workspace: { name: "Renamed" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(ws.reload.name).to eq("Renamed")
    end

    it "管理者は編集できる" do
      admin = create(:user)
      create(:workspace_membership, workspace: ws, user: admin, role: :admin)
      login_as(admin)
      patch "/api/v1/workspaces/#{ws.id}", params: { workspace: { name: "ByAdmin" } }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "一般メンバーは403" do
      member = create(:user)
      create(:workspace_membership, workspace: ws, user: member, role: :member)
      login_as(member)
      patch "/api/v1/workspaces/#{ws.id}", params: { workspace: { name: "X" } }, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "非所属者は404" do
      outsider = create(:user)
      login_as(outsider)
      patch "/api/v1/workspaces/#{ws.id}", params: { workspace: { name: "X" } }, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end
end
