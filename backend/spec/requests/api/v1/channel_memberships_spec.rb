require "rails_helper"

RSpec.describe "Api::V1::ChannelMemberships", type: :request do
  let(:owner)   { create(:user) }
  let(:workspace) { create(:workspace, :with_owner_membership, owner: owner) }
  let(:admin)   { create(:user) }
  let(:member)  { create(:user) }
  let(:creator) { create(:user) }

  before do
    create(:workspace_membership, workspace: workspace, user: admin, role: :admin)
    create(:workspace_membership, workspace: workspace, user: member, role: :member)
    create(:workspace_membership, workspace: workspace, user: creator, role: :member)
  end

  let(:public_channel) do
    create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :public, name: "public-ch")
  end
  let(:private_channel) do
    create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :private, name: "private-ch")
  end
  def ch_base(channel) = "/api/v1/workspaces/#{workspace.id}/channels/#{channel.id}"

  describe "認証(未ログインは401)" do
    it "join" do
      post "#{ch_base(public_channel)}/join"
      expect(response).to have_http_status(:unauthorized)
    end

    it "leave" do
      delete "#{ch_base(public_channel)}/members/me"
      expect(response).to have_http_status(:unauthorized)
    end

    it "members index" do
      get "#{ch_base(public_channel)}/members"
      expect(response).to have_http_status(:unauthorized)
    end

    it "invite" do
      post "#{ch_base(private_channel)}/members", params: { user_id: member.id }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "ワークスペース未所属者" do
    it "join は404" do
      login_as(create(:user))
      post "#{ch_base(public_channel)}/join"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST join" do
    it "公開チャンネルに参加できる" do
      channel = public_channel # 計測前に作成を確定
      login_as(member)
      expect {
        post "#{ch_base(channel)}/join"
      }.to change(ChannelMembership, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "公開チャンネルの重複参加は409" do
      login_as(creator) # 既に参加済み
      post "#{ch_base(public_channel)}/join"
      expect(response).to have_http_status(:conflict)
    end

    it "非公開チャンネルへの自己参加は404" do
      login_as(member) # 未参加の一般メンバー
      post "#{ch_base(private_channel)}/join"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE members/me (退出)" do
    it "一般参加者は退出できる" do
      channel = public_channel
      login_as(member)
      post "#{ch_base(channel)}/join" # member を参加させる
      expect {
        delete "#{ch_base(channel)}/members/me"
      }.to change(ChannelMembership, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "チャンネル作成者は退出できず422" do
      login_as(creator)
      delete "#{ch_base(public_channel)}/members/me"
      expect(response).to have_http_status(:unprocessable_content)
      expect(public_channel.membership_for(creator)).to be_present
    end
  end

  describe "GET members" do
    it "公開は所属者が閲覧できる" do
      login_as(member)
      get "#{ch_base(public_channel)}/members"
      expect(response).to have_http_status(:ok)
    end

    it "非公開未参加の一般メンバーは404" do
      login_as(member)
      get "#{ch_base(private_channel)}/members"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST members (非公開への招待)" do
    it "作成者は招待できる" do
      channel = private_channel # 計測前に作成を確定
      login_as(creator)
      expect {
        post "#{ch_base(channel)}/members", params: { user_id: member.id }, as: :json
      }.to change(ChannelMembership, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "owner/adminは招待できる" do
      login_as(admin)
      post "#{ch_base(private_channel)}/members", params: { user_id: member.id }, as: :json
      expect(response).to have_http_status(:created)
    end

    it "一般参加者による招待は403" do
      # member を非公開チャンネルの参加者にする
      create(:channel_membership, channel: private_channel, user: member)
      login_as(member)
      post "#{ch_base(private_channel)}/members", params: { user_id: admin.id }, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "別ワークスペースのユーザー招待は422" do
      outsider = create(:user) # workspace 未所属
      login_as(creator)
      post "#{ch_base(private_channel)}/members", params: { user_id: outsider.id }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "重複招待は409" do
      create(:channel_membership, channel: private_channel, user: member)
      login_as(creator)
      post "#{ch_base(private_channel)}/members", params: { user_id: member.id }, as: :json
      expect(response).to have_http_status(:conflict)
    end
  end

  describe "関連データの削除" do
    it "ワークスペース削除でChannelとChannelMembershipも削除される" do
      public_channel
      private_channel
      expect {
        workspace.destroy
      }.to change(Channel, :count).to(0)
        .and change(ChannelMembership, :count).to(0)
    end
  end
end
