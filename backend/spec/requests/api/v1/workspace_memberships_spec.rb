require "rails_helper"

RSpec.describe "Api::V1::WorkspaceMemberships", type: :request do
  let(:owner) { create(:user) }
  let(:ws) { create(:workspace, :with_owner_membership, owner: owner) }

  describe "GET members (一覧)" do
    it "所属者はメンバー一覧を取得できる" do
      login_as(owner)
      get "/api/v1/workspaces/#{ws.id}/members"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["members"].size).to eq(1)
    end

    it "非所属者は404" do
      outsider = create(:user)
      login_as(outsider)
      get "/api/v1/workspaces/#{ws.id}/members"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE members/me (自主退出)" do
    it "一般メンバーは退出できる" do
      member = create(:user)
      create(:workspace_membership, workspace: ws, user: member, role: :member)
      login_as(member)
      expect {
        delete "/api/v1/workspaces/#{ws.id}/members/me"
      }.to change(WorkspaceMembership, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "所有者の退出はブロックされる(422)" do
      login_as(owner)
      delete "/api/v1/workspaces/#{ws.id}/members/me"
      expect(response).to have_http_status(:unprocessable_content)
      expect(ws.membership_for(owner)).to be_present
    end
  end

  describe "DELETE members/:id (管理者による削除)" do
    let(:member) { create(:user) }
    let!(:member_ms) { create(:workspace_membership, workspace: ws, user: member, role: :member) }

    it "所有者は一般メンバーを削除できる" do
      login_as(owner)
      expect {
        delete "/api/v1/workspaces/#{ws.id}/members/#{member.id}"
      }.to change(WorkspaceMembership, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "管理者は一般メンバーを削除できる" do
      admin = create(:user)
      create(:workspace_membership, workspace: ws, user: admin, role: :admin)
      login_as(admin)
      delete "/api/v1/workspaces/#{ws.id}/members/#{member.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "一般メンバーは削除できない(403)" do
      other = create(:user)
      create(:workspace_membership, workspace: ws, user: other, role: :member)
      login_as(other)
      delete "/api/v1/workspaces/#{ws.id}/members/#{member.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "所有者は削除できない(管理者が試行しても403)" do
      admin = create(:user)
      create(:workspace_membership, workspace: ws, user: admin, role: :admin)
      login_as(admin)
      delete "/api/v1/workspaces/#{ws.id}/members/#{owner.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "非所属者は404" do
      outsider = create(:user)
      login_as(outsider)
      delete "/api/v1/workspaces/#{ws.id}/members/#{member.id}"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "認証" do
    it "未ログインは401 (GET members)" do
      get "/api/v1/workspaces/#{ws.id}/members"
      expect(response).to have_http_status(:unauthorized)
    end

    it "未ログインは401 (DELETE members/me)" do
      delete "/api/v1/workspaces/#{ws.id}/members/me"
      expect(response).to have_http_status(:unauthorized)
    end

    it "未ログインは401 (DELETE members/:id)" do
      other = create(:user)
      delete "/api/v1/workspaces/#{ws.id}/members/#{other.id}"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "退出後の非公開チャンネルアクセス制御" do
    let(:member) { create(:user) }
    let(:private_channel) { create(:channel, workspace: ws, kind: :private, created_by: owner) }

    before do
      create(:workspace_membership, workspace: ws, user: member, role: :member)
      create(:channel_membership, channel: private_channel, user: member)
      login_as(member)
    end

    it "退出前は非公開チャンネル詳細を取得できる" do
      get "/api/v1/workspaces/#{ws.id}/channels/#{private_channel.id}"
      expect(response).to have_http_status(:ok)
    end

    it "退出後は非公開チャンネル詳細が404になる" do
      delete "/api/v1/workspaces/#{ws.id}/members/me"
      get "/api/v1/workspaces/#{ws.id}/channels/#{private_channel.id}"
      expect(response).to have_http_status(:not_found)
    end

    it "退出後に再参加しても非公開チャンネルが一覧に出ない" do
      delete "/api/v1/workspaces/#{ws.id}/members/me"
      create(:workspace_membership, workspace: ws, user: member, role: :member)
      login_as(member)
      get "/api/v1/workspaces/#{ws.id}/channels"
      channels = JSON.parse(response.body)["channels"]
      expect(channels.map { |c| c["id"] }).not_to include(private_channel.id)
    end
  end
end
