require "rails_helper"

RSpec.describe "Api::V1::MessageSearches", type: :request do
  let(:owner)  { create(:user) }
  let(:admin)  { create(:user) }
  let(:member) { create(:user) }
  let(:other)  { create(:user) }
  let(:workspace) { create(:workspace, :with_owner_membership, owner: owner) }
  let(:base) { "/api/v1/workspaces/#{workspace.id}/messages/search" }

  before do
    create(:workspace_membership, workspace: workspace, user: admin, role: :admin)
    create(:workspace_membership, workspace: workspace, user: member, role: :member)
    create(:workspace_membership, workspace: workspace, user: other, role: :member)
  end

  let(:public_channel) do
    create(:channel, :with_creator_membership, workspace: workspace, created_by: member, kind: :public, name: "general")
  end
  let(:private_channel) do
    create(:channel, :with_creator_membership, workspace: workspace, created_by: member, kind: :private, name: "secret")
  end

  describe "認証・所属" do
    it "未ログイン時は401" do
      get base, params: { q: "test" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "存在しないworkspaceは404" do
      login_as(member)
      get "/api/v1/workspaces/999999/messages/search", params: { q: "test" }
      expect(response).to have_http_status(:not_found)
    end

    it "ワークスペース未所属は404" do
      outsider = create(:user)
      login_as(outsider)
      get base, params: { q: "test" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "検索語の扱い" do
    it "qを指定しない場合は検索せず空配列を返す" do
      create(:message, channel: public_channel, user: member, body: "障害対応を開始します")
      login_as(member)
      get base
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["messages"]).to eq([])
      expect(body["query"]).to eq("")
      expect(body["total_count"]).to eq(0)
    end

    it "空文字の場合は検索せず空配列を返す" do
      create(:message, channel: public_channel, user: member, body: "障害対応を開始します")
      login_as(member)
      get base, params: { q: "" }
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["messages"]).to eq([])
      expect(body["total_count"]).to eq(0)
    end

    it "前後の空白は除去して検索する" do
      create(:message, channel: public_channel, user: member, body: "障害対応を開始します")
      login_as(member)
      get base, params: { q: "  障害  " }
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["query"]).to eq("障害")
      expect(body["messages"].size).to eq(1)
    end

    it "完全一致で検索できる" do
      create(:message, channel: public_channel, user: member, body: "障害対応を開始します")
      login_as(member)
      get base, params: { q: "障害対応を開始します" }
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "部分一致で検索できる" do
      create(:message, channel: public_channel, user: member, body: "障害対応を開始します")
      login_as(member)
      get base, params: { q: "対応" }
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "大文字小文字を区別しない" do
      create(:message, channel: public_channel, user: member, body: "Incident Report")
      login_as(member)
      get base, params: { q: "incident" }
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "検索語に%を含んでも通常の文字として扱う" do
      create(:message, channel: public_channel, user: member, body: "進捗は100%です")
      create(:message, channel: public_channel, user: member, body: "無関係なメッセージ")
      login_as(member)
      get base, params: { q: "100%" }
      body = JSON.parse(response.body)
      expect(body["messages"].size).to eq(1)
      expect(body["messages"].first["body"]).to eq("進捗は100%です")
    end

    it "検索語に_を含んでも通常の文字として扱う" do
      create(:message, channel: public_channel, user: member, body: "foo_bar形式で入力")
      create(:message, channel: public_channel, user: member, body: "fooxbar形式で入力")
      login_as(member)
      get base, params: { q: "foo_bar" }
      body = JSON.parse(response.body)
      expect(body["messages"].size).to eq(1)
      expect(body["messages"].first["body"]).to eq("foo_bar形式で入力")
    end
  end

  describe "検索対象チャンネル" do
    it "公開チャンネルのメッセージを検索できる" do
      create(:message, channel: public_channel, user: member, body: "公開チャンネルの投稿です")
      login_as(other)
      get base, params: { q: "公開" }
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "参加中の非公開チャンネルのメッセージを検索できる" do
      create(:channel_membership, channel: private_channel, user: other)
      create(:message, channel: private_channel, user: member, body: "非公開チャンネルの投稿です")
      login_as(other)
      get base, params: { q: "非公開" }
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "未参加の一般memberには非公開チャンネルのメッセージが漏れず、total_countにも含まれない" do
      3.times { |i| create(:message, channel: private_channel, user: member, body: "非公開チャンネルの投稿#{i}です") }
      login_as(other)
      get base, params: { q: "非公開" }
      body = JSON.parse(response.body)
      expect(body["messages"]).to eq([])
      expect(body["total_count"]).to eq(0)
    end

    it "未参加の一般memberにはチャンネル名や件数も一切含まれない" do
      create(:message, channel: private_channel, user: member, body: "極秘プロジェクトの内容です")
      login_as(other)
      get base, params: { q: "極秘" }
      raw_body = response.body
      expect(raw_body).not_to include("プロジェクトの内容")
      expect(raw_body).not_to include(private_channel.name)
    end

    it "owner/adminは未参加の非公開チャンネルも検索できる" do
      create(:message, channel: private_channel, user: member, body: "非公開チャンネルの投稿です")
      login_as(owner)
      get base, params: { q: "非公開" }
      expect(JSON.parse(response.body)["messages"].size).to eq(1)

      login_as(admin)
      get base, params: { q: "非公開" }
      expect(JSON.parse(response.body)["messages"].size).to eq(1)
    end

    it "別ワークスペースのメッセージを含めない" do
      other_workspace = create(:workspace, :with_owner_membership, owner: owner)
      create(:workspace_membership, workspace: other_workspace, user: member, role: :member)
      other_channel = create(:channel, :with_creator_membership, workspace: other_workspace, created_by: member, kind: :public)
      create(:message, channel: other_channel, user: member, body: "別ワークスペースの投稿です")
      create(:message, channel: public_channel, user: member, body: "このワークスペースの投稿です")

      login_as(member)
      get base, params: { q: "投稿" }
      body = JSON.parse(response.body)
      expect(body["messages"].size).to eq(1)
      expect(body["total_count"]).to eq(1)
      expect(body["messages"].first["body"]).to eq("このワークスペースの投稿です")
    end
  end

  describe "並び順と件数上限" do
    it "created_atの降順で返す" do
      old_message = create(:message, channel: public_channel, user: member, body: "検索対象old")
      old_message.update_columns(created_at: 2.days.ago)
      new_message = create(:message, channel: public_channel, user: member, body: "検索対象new")
      new_message.update_columns(created_at: 1.hour.ago)

      login_as(member)
      get base, params: { q: "検索対象" }
      ids = JSON.parse(response.body)["messages"].map { |m| m["id"] }
      expect(ids).to eq([ new_message.id, old_message.id ])
    end

    it "25件該当してもmessagesは20件だが、total_countは実際の総件数25を返す" do
      messages = Array.new(25) do |i|
        m = create(:message, channel: public_channel, user: member, body: "上限確認メッセージ#{i}")
        m.update_columns(created_at: i.hours.ago)
        m
      end
      # created_at が新しい(= 経過時間が短い)順に並ぶため、i が小さいものが先頭に来る。
      newest_20_ids = messages.sort_by(&:created_at).reverse.first(20).map(&:id)

      login_as(member)
      get base, params: { q: "上限確認" }
      body = JSON.parse(response.body)
      expect(body["messages"].size).to eq(20)
      expect(body["total_count"]).to eq(25)
      expect(body["messages"].map { |m| m["id"] }).to eq(newest_20_ids)
    end

    it "20件以下ではtotal_countとmessages.sizeが一致する" do
      3.times { |i| create(:message, channel: public_channel, user: member, body: "少数確認メッセージ#{i}") }

      login_as(member)
      get base, params: { q: "少数確認" }
      body = JSON.parse(response.body)
      expect(body["messages"].size).to eq(3)
      expect(body["total_count"]).to eq(3)
    end
  end

  describe "レスポンス形式" do
    it "channel、user、body、日時、is_editedを含む" do
      message = create(:message, channel: public_channel, user: member, body: "形式確認メッセージ")
      login_as(member)
      get base, params: { q: "形式確認" }
      result = JSON.parse(response.body)["messages"].first

      expect(result["id"]).to eq(message.id)
      expect(result["channel"]).to eq({ "id" => public_channel.id, "name" => public_channel.name })
      expect(result["user"]).to eq({ "id" => member.id, "name" => member.name, "email" => member.email })
      expect(result["body"]).to eq("形式確認メッセージ")
      expect(result["created_at"]).to be_present
      expect(result["updated_at"]).to be_present
      expect(result["is_edited"]).to be(false)
    end

    it "更新済みメッセージはis_editedがtrue" do
      message = create(:message, channel: public_channel, user: member, body: "編集確認メッセージ")
      message.update!(body: "編集確認メッセージ(更新済み)")
      login_as(member)
      get base, params: { q: "編集確認" }
      result = JSON.parse(response.body)["messages"].first
      expect(result["is_edited"]).to be(true)
    end

    it "total_countは検索結果件数と一致する" do
      create(:message, channel: public_channel, user: member, body: "件数確認その1")
      create(:message, channel: public_channel, user: member, body: "件数確認その2")
      login_as(member)
      get base, params: { q: "件数確認" }
      body = JSON.parse(response.body)
      expect(body["total_count"]).to eq(2)
      expect(body["messages"].size).to eq(2)
    end
  end

  describe "N+1防止" do
    it "検索結果が複数件でもuser/channel取得のクエリが増えすぎない" do
      5.times do |i|
        ch = create(:channel, :with_creator_membership, workspace: workspace, created_by: member, kind: :public)
        create(:message, channel: ch, user: member, body: "N1確認メッセージ#{i}")
      end

      login_as(member)

      query_count = 0
      callback = ->(*, payload) { query_count += 1 unless payload[:sql].include?("SCHEMA") }
      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get base, params: { q: "N1確認" }
      end

      expect(JSON.parse(response.body)["messages"].size).to eq(5)
      expect(query_count).to be <= 10
    end
  end
end
