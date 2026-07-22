require "rails_helper"

RSpec.describe "Api::V1::WorkspaceInviteCodes", type: :request do
  let(:owner) { create(:user) }
  let(:ws) { create(:workspace, :with_owner_membership, owner: owner) }

  it "所有者は招待コードを取得できる" do
    login_as(owner)
    get "/api/v1/workspaces/#{ws.id}/invite_code"
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["invite_code"]).to eq(ws.invite_code)
  end

  it "所有者は招待コードを再発行できる" do
    login_as(owner)
    old = ws.invite_code
    post "/api/v1/workspaces/#{ws.id}/invite_code"
    expect(response).to have_http_status(:created)
    expect(ws.reload.invite_code).not_to eq(old)
  end

  it "一般メンバーは招待コードを取得できない(403)" do
    member = create(:user)
    create(:workspace_membership, workspace: ws, user: member, role: :member)
    login_as(member)
    get "/api/v1/workspaces/#{ws.id}/invite_code"
    expect(response).to have_http_status(:forbidden)
  end

  it "非所属者は404" do
    outsider = create(:user)
    login_as(outsider)
    get "/api/v1/workspaces/#{ws.id}/invite_code"
    expect(response).to have_http_status(:not_found)
  end

  describe "認証" do
    it "未ログインはGETで401" do
      get "/api/v1/workspaces/#{ws.id}/invite_code"
      expect(response).to have_http_status(:unauthorized)
    end

    it "未ログインはPOSTで401" do
      post "/api/v1/workspaces/#{ws.id}/invite_code"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
