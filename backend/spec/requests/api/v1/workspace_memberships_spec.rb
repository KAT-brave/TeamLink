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
end
