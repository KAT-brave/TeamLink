require "rails_helper"

RSpec.describe "Api::V1::Messages", type: :request do
  let(:owner)    { create(:user) }
  let(:admin)    { create(:user) }
  let(:member)   { create(:user) }
  let(:other)    { create(:user) }
  let(:workspace) { create(:workspace, :with_owner_membership, owner: owner) }
  let(:base)     { "/api/v1/workspaces/#{workspace.id}/channels" }

  before do
    create(:workspace_membership, workspace: workspace, user: admin, role: :admin)
    create(:workspace_membership, workspace: workspace, user: member, role: :member)
    create(:workspace_membership, workspace: workspace, user: other, role: :member)
  end

  let(:public_channel) do
    create(:channel, :with_creator_membership, workspace: workspace, created_by: member, kind: :public)
  end
  let(:private_channel) do
    create(:channel, :with_creator_membership, workspace: workspace, created_by: member, kind: :private)
  end

  describe "共通" do
    describe "認証" do
      it "未ログイン時は401（index）" do
        get "#{base}/#{public_channel.id}/messages"
        expect(response).to have_http_status(:unauthorized)
      end

      it "未ログイン時は401（create）" do
        post "#{base}/#{public_channel.id}/messages", params: { message: { body: "test" } }, as: :json
        expect(response).to have_http_status(:unauthorized)
      end
    end

    describe "ワークスペース未所属" do
      it "index は404" do
        outsider = create(:user)
        login_as(outsider)
        get "#{base}/#{public_channel.id}/messages"
        expect(response).to have_http_status(:not_found)
      end

      it "create は404" do
        outsider = create(:user)
        login_as(outsider)
        post "#{base}/#{public_channel.id}/messages", params: { message: { body: "test" } }, as: :json
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "チャンネルが存在しない" do
      it "404（index）" do
        login_as(member)
        get "#{base}/99999/messages"
        expect(response).to have_http_status(:not_found)
      end
    end

    describe "別ワークスペースのチャンネル" do
      it "404（index）" do
        other_ws = create(:workspace)
        other_ch = create(:channel, workspace: other_ws, created_by: create(:user))
        login_as(owner)
        get "/api/v1/workspaces/#{other_ws.id}/channels/#{other_ch.id}/messages"
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe "GET index" do
    it "公開チャンネル未参加のワークスペース所属者も閲覧できる" do
      create(:message, channel: public_channel, user: member, body: "msg1")
      login_as(other)
      get "#{base}/#{public_channel.id}/messages"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "非公開チャンネル参加者は閲覧できる" do
      create(:channel_membership, channel: private_channel, user: other)
      create(:message, channel: private_channel, user: member, body: "msg1")
      login_as(other)
      get "#{base}/#{private_channel.id}/messages"
      expect(response).to have_http_status(:ok)
    end

    it "非公開チャンネル未参加の一般メンバーは404" do
      login_as(other)
      get "#{base}/#{private_channel.id}/messages"
      expect(response).to have_http_status(:not_found)
    end

    it "未参加のadminは非公開チャンネルの一覧を閲覧できる" do
      create(:message, channel: private_channel, user: member, body: "msg1")
      login_as(admin)
      get "#{base}/#{private_channel.id}/messages"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "古い順に返る" do
      msg1 = create(:message, channel: public_channel, user: member, body: "first")
      msg2 = create(:message, channel: public_channel, user: member, body: "second")
      msg3 = create(:message, channel: public_channel, user: member, body: "third")

      login_as(other)
      get "#{base}/#{public_channel.id}/messages"
      ids = JSON.parse(response.body)["messages"].map { |m| m["id"] }
      expect(ids).to eq([ msg1.id, msg2.id, msg3.id ])
    end

    it "同じcreated_atの場合はid順に返る" do
      now = Time.current
      msg1 = create(:message, channel: public_channel, user: member, body: "msg1", created_at: now)
      msg2 = create(:message, channel: public_channel, user: member, body: "msg2", created_at: now)
      msg3 = create(:message, channel: public_channel, user: member, body: "msg3", created_at: now)

      login_as(other)
      get "#{base}/#{public_channel.id}/messages"
      ids = JSON.parse(response.body)["messages"].map { |m| m["id"] }
      expect(ids).to eq([ msg1.id, msg2.id, msg3.id ])
    end

    it "投稿者情報を含む" do
      create(:message, channel: public_channel, user: member, body: "msg")
      login_as(other)
      get "#{base}/#{public_channel.id}/messages"
      msg_data = JSON.parse(response.body)["messages"].first
      expect(msg_data["user"]["id"]).to eq(member.id)
      expect(msg_data["user"]["name"]).to eq(member.name)
      expect(msg_data["user"]["email"]).to eq(member.email)
    end

    it "can_edit、can_deleteが本人だけtrue" do
      msg = create(:message, channel: public_channel, user: member, body: "msg")
      login_as(member)
      get "#{base}/#{public_channel.id}/messages"
      msg_data = JSON.parse(response.body)["messages"].first
      expect(msg_data["can_edit"]).to be(true)
      expect(msg_data["can_delete"]).to be(true)
    end

    it "他人のメッセージではcan_edit、can_deleteがfalse" do
      create(:message, channel: public_channel, user: member, body: "msg")
      login_as(other)
      get "#{base}/#{public_channel.id}/messages"
      msg_data = JSON.parse(response.body)["messages"].first
      expect(msg_data["can_edit"]).to be(false)
      expect(msg_data["can_delete"]).to be(false)
    end

    it "0件の場合は空配列" do
      login_as(member)
      get "#{base}/#{public_channel.id}/messages"
      expect(JSON.parse(response.body)["messages"]).to eq([])
    end
  end

  describe "POST create" do
    it "公開チャンネル参加者は投稿できる" do
      login_as(member)
      expect {
        post "#{base}/#{public_channel.id}/messages", params: { message: { body: "Hello" } }, as: :json
      }.to change(Message, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "公開チャンネル未参加者は403" do
      login_as(other)
      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "Hello" } }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(Message.count).to eq(0)
    end

    it "非公開チャンネル参加者は投稿できる" do
      create(:channel_membership, channel: private_channel, user: other)
      login_as(other)
      expect {
        post "#{base}/#{private_channel.id}/messages", params: { message: { body: "Hello" } }, as: :json
      }.to change(Message, :count).by(1)
      expect(response).to have_http_status(:created)
    end

    it "非公開チャンネル未参加の一般メンバーは404" do
      login_as(other)
      # private_channel は member が作成（created_by）しており、other は未参加
      post "#{base}/#{private_channel.id}/messages", params: { message: { body: "Hello" } }, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "未参加のadminは投稿できず403" do
      login_as(admin)
      post "#{base}/#{private_channel.id}/messages", params: { message: { body: "Hello" } }, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "投稿者がcurrent_userになる" do
      login_as(member)
      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "Hello" } }, as: :json
      msg = Message.last
      expect(msg.user_id).to eq(member.id)
    end

    it "リクエストに別ユーザーのuser_idを含めても無視する" do
      login_as(member)
      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "Hello", user_id: other.id } }, as: :json
      msg = Message.last
      expect(msg.user_id).to eq(member.id)
    end

    it "空文字は422" do
      login_as(member)
      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "" } }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "空白、タブ、改行だけは422" do
      login_as(member)
      [ "   ", "\t", "\n" ].each do |body|
        post "#{base}/#{public_channel.id}/messages", params: { message: { body: body } }, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    it "5,001文字は422" do
      login_as(member)
      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "a" * 5001 } }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "同じ本文を複数投稿できる" do
      login_as(member)
      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "duplicate" } }, as: :json
      expect(response).to have_http_status(:created)
      msg1_id = JSON.parse(response.body)["message"]["id"]

      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "duplicate" } }, as: :json
      expect(response).to have_http_status(:created)
      msg2_id = JSON.parse(response.body)["message"]["id"]

      expect(msg1_id).not_to eq(msg2_id)
    end

    it "成功時は201（Created）" do
      login_as(member)
      post "#{base}/#{public_channel.id}/messages", params: { message: { body: "Hello" } }, as: :json
      expect(response).to have_http_status(:created)
    end
  end

  describe "PATCH update" do
    it "投稿者本人はbodyを編集できる" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(member)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "edited" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(msg.reload.body).to eq("edited")
    end

    it "成功時は200（OK）" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(member)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "edited" } }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "編集後is_editedがtrue" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(member)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "edited" } }, as: :json
      msg_data = JSON.parse(response.body)["message"]
      expect(msg_data["is_edited"]).to be(true)
    end

    it "他人のメッセージは403" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(other)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "hacked" } }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(msg.reload.body).to eq("original")
    end

    it "adminでも他人のメッセージは403" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(admin)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "hacked" } }, as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "user_idを送っても投稿者は変更されない" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(member)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "edited", user_id: other.id } }, as: :json
      expect(msg.reload.user_id).to eq(member.id)
    end

    it "channel_idを送ってもチャンネルは変更されない" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(member)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "edited", channel_id: 999 } }, as: :json
      expect(msg.reload.channel_id).to eq(public_channel.id)
    end

    it "空白だけへの編集は422" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      login_as(member)
      patch "#{base}/#{public_channel.id}/messages/#{msg.id}", params: { message: { body: "   " } }, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(msg.reload.body).to eq("original")
    end

    it "存在しないメッセージは404" do
      login_as(member)
      patch "#{base}/#{public_channel.id}/messages/99999", params: { message: { body: "edited" } }, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it "別チャンネルのメッセージは404" do
      msg = create(:message, channel: public_channel, user: member, body: "original")
      other_ch = create(:channel, workspace: workspace, created_by: member, kind: :public)
      login_as(member)
      patch "#{base}/#{other_ch.id}/messages/#{msg.id}", params: { message: { body: "edited" } }, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE destroy" do
    it "投稿者本人は削除できる" do
      msg = create(:message, channel: public_channel, user: member, body: "msg")
      login_as(member)
      expect {
        delete "#{base}/#{public_channel.id}/messages/#{msg.id}"
      }.to change(Message, :count).by(-1)
      expect(response).to have_http_status(:no_content)
    end

    it "成功時は204（No Content）" do
      msg = create(:message, channel: public_channel, user: member, body: "msg")
      login_as(member)
      delete "#{base}/#{public_channel.id}/messages/#{msg.id}"
      expect(response).to have_http_status(:no_content)
    end

    it "他人のメッセージは403" do
      msg = create(:message, channel: public_channel, user: member, body: "msg")
      login_as(other)
      delete "#{base}/#{public_channel.id}/messages/#{msg.id}"
      expect(response).to have_http_status(:forbidden)
      expect(Message.exists?(msg.id)).to be(true)
    end

    it "adminでも他人のメッセージ削除は403" do
      msg = create(:message, channel: public_channel, user: member, body: "msg")
      login_as(admin)
      delete "#{base}/#{public_channel.id}/messages/#{msg.id}"
      expect(response).to have_http_status(:forbidden)
    end

    it "別チャンネルのメッセージは404" do
      msg = create(:message, channel: public_channel, user: member, body: "msg")
      other_ch = create(:channel, workspace: workspace, created_by: member, kind: :public)
      login_as(member)
      delete "#{base}/#{other_ch.id}/messages/#{msg.id}"
      expect(response).to have_http_status(:not_found)
    end

    it "チャンネル削除時に関連メッセージも削除される" do
      msg = create(:message, channel: public_channel, user: member, body: "msg")
      public_channel.destroy
      expect(Message.exists?(msg.id)).to be(false)
    end

    it "ユーザー削除時に関連メッセージも削除される" do
      # public_channel は member が created_by だが、message は other が投稿
      msg = create(:message, channel: public_channel, user: other, body: "msg")
      other.destroy
      expect(Message.exists?(msg.id)).to be(false)
    end
  end
end
