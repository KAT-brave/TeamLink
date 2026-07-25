require "rails_helper"

RSpec.describe "Api::V1::Channels", type: :request do
  let(:owner)   { create(:user) }
  let(:workspace) { create(:workspace, :with_owner_membership, owner: owner) }
  let(:admin)   { create(:user) }
  let(:member)  { create(:user) }
  let(:creator) { create(:user) }
  let(:base) { "/api/v1/workspaces/#{workspace.id}/channels" }

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

  describe "認証(未ログインは401)" do
    it "index" do
      get base
      expect(response).to have_http_status(:unauthorized)
    end

    it "show" do
      get "#{base}/#{public_channel.id}"
      expect(response).to have_http_status(:unauthorized)
    end

    it "create" do
      post base, params: { channel: { name: "x", kind: "public" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "update" do
      patch "#{base}/#{public_channel.id}", params: { channel: { name: "x" } }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "destroy" do
      delete "#{base}/#{public_channel.id}"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "ワークスペース未所属者" do
    it "一覧は404" do
      login_as(create(:user))
      get base
      expect(response).to have_http_status(:not_found)
    end

    it "詳細は404" do
      login_as(create(:user))
      get "#{base}/#{public_channel.id}"
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST create" do
    it "作成でき、作成者が自動参加する" do
      login_as(creator)
      expect {
        post base, params: { channel: { name: "New", description: "d", kind: "public" } }, as: :json
      }.to change(Channel, :count).by(1)
      expect(response).to have_http_status(:created)
      ch = Channel.find_by(name: "New")
      expect(ch.created_by).to eq(creator)
      expect(ch.membership_for(creator)).to be_present
      expect(JSON.parse(response.body).dig("channel", "joined")).to be(true)
    end

    it "kind未指定は422" do
      login_as(creator)
      post base, params: { channel: { name: "NoKind" } }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "kindが不正な値は422" do
      login_as(creator)
      post base, params: { channel: { name: "Bad", kind: "secret" } }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "同一ワークスペース内の重複名は422" do
      public_channel
      login_as(creator)
      post base, params: { channel: { name: "PUBLIC-CH", kind: "public" } }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "作成失敗時にChannelだけが残らない(transaction)" do
      login_as(creator)
      allow_any_instance_of(ChannelMembership).to receive(:save!)
        .and_raise(ActiveRecord::RecordInvalid.new(ChannelMembership.new))
      expect {
        post base, params: { channel: { name: "Atomic", kind: "public" } }, as: :json
      }.not_to change(Channel, :count)
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "ChannelMembership作成時にRecordNotUniqueが発生すると409" do
      login_as(creator)
      allow_any_instance_of(ChannelMembership).to receive(:save!)
        .and_raise(ActiveRecord::RecordNotUnique.new('duplicate key value violates unique constraint'))
      post base, params: { channel: { name: "Unique", kind: "public" } }, as: :json
      expect(response).to have_http_status(:conflict)
      expect(JSON.parse(response.body)).to eq({ "error" => "既に登録されています。" })
    end
  end

  describe "GET index" do
    it "公開は全件、非公開は自分が参加中のものだけ" do
      public_channel
      joined_private = create(:channel, :with_creator_membership, workspace: workspace,
                                                                   created_by: member, kind: :private, name: "joined-pri")
      unjoined_private = private_channel # creator のみ参加、member は未参加
      login_as(member)
      get base
      ids = JSON.parse(response.body)["channels"].map { |c| c["id"] }
      expect(ids).to include(public_channel.id, joined_private.id)
      expect(ids).not_to include(unjoined_private.id)
    end

    it "owner/adminでも未参加の非公開は通常一覧に出ない" do
      private_channel # creator のみ参加
      login_as(admin)
      get base
      ids = JSON.parse(response.body)["channels"].map { |c| c["id"] }
      expect(ids).not_to include(private_channel.id)
    end
  end

  describe "GET show" do
    it "公開チャンネルは未参加でも閲覧できる" do
      public_channel
      login_as(member) # 未参加
      get "#{base}/#{public_channel.id}"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig("channel", "joined")).to be(false)
    end

    it "非公開チャンネルの参加者は閲覧できる" do
      login_as(creator)
      get "#{base}/#{private_channel.id}"
      expect(response).to have_http_status(:ok)
    end

    it "非公開チャンネル未参加の一般メンバーは404" do
      login_as(member)
      get "#{base}/#{private_channel.id}"
      expect(response).to have_http_status(:not_found)
    end

    it "owner/adminは未参加の非公開を管理目的で取得できる" do
      login_as(admin)
      get "#{base}/#{private_channel.id}"
      expect(response).to have_http_status(:ok)
    end
  end

  describe "PATCH update" do
    it "作成者は編集できる" do
      login_as(creator)
      patch "#{base}/#{public_channel.id}", params: { channel: { name: "renamed", description: "d2" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(public_channel.reload.name).to eq("renamed")
    end

    it "owner/adminは編集できる" do
      login_as(admin)
      patch "#{base}/#{public_channel.id}", params: { channel: { name: "byadmin" } }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "一般メンバーは編集できない(403)" do
      login_as(member)
      patch "#{base}/#{public_channel.id}", params: { channel: { name: "hack" } }, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "kindはPATCHで変更できない" do
      login_as(creator)
      patch "#{base}/#{public_channel.id}", params: { channel: { kind: "private", name: "keep" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(public_channel.reload.kind_public?).to be(true)
    end
  end

  describe "DELETE destroy" do
    it "作成者は削除できる" do
      public_channel
      login_as(creator)
      expect {
        delete "#{base}/#{public_channel.id}"
      }.to change(Channel, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "owner/adminは削除できる" do
      private_channel
      login_as(owner)
      delete "#{base}/#{private_channel.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "一般メンバーは削除できない(403)" do
      public_channel
      login_as(member)
      delete "#{base}/#{public_channel.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "削除でChannelMembershipも削除される" do
      public_channel
      login_as(creator)
      expect {
        delete "#{base}/#{public_channel.id}"
      }.to change(ChannelMembership, :count).by(-1)
    end
  end
end
