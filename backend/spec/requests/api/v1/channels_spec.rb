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

    it "unread_count が応答に含まれることを確認" do
      public_channel
      login_as(member)
      get base
      channels = JSON.parse(response.body)["channels"]
      expect(channels[0]).to include("unread_count")
    end

    describe "unread_count の計算(回帰: ChannelReadStatus不在時のバグ修正)" do
      it "ChannelReadStatusなし・既存メッセージありでも unread_count は 0" do
        create_list(:message, 3, channel: public_channel, user: creator)
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch["unread_count"]).to eq(0)
      end

      it "ChannelReadStatusなし・メッセージなしでも unread_count は 0" do
        public_channel
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch["unread_count"]).to eq(0)
      end

      it "ChannelReadStatusあり・last_read_message_id が nil の場合、その後の他人の投稿を未読としてカウントする" do
        create(:channel_read_status, channel: public_channel, user: member, last_read_message_id: nil)
        create(:message, channel: public_channel, user: creator)
        create(:message, channel: public_channel, user: creator)
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch["unread_count"]).to eq(2)
      end

      it "ChannelReadStatusあり・last_read_message_id設定済みの場合、それより後のメッセージだけカウントする" do
        m1 = create(:message, channel: public_channel, user: creator)
        create(:channel_read_status, channel: public_channel, user: member, last_read_message_id: m1.id)
        m2 = create(:message, channel: public_channel, user: creator)
        m3 = create(:message, channel: public_channel, user: creator)
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch["unread_count"]).to eq(2)
      end

      it "自分の投稿は未読件数から除外される" do
        create(:channel_read_status, channel: public_channel, user: member, last_read_message_id: nil)
        create(:message, channel: public_channel, user: member)
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch["unread_count"]).to eq(0)
      end

      it "別ユーザーのChannelReadStatusと混ざらない" do
        create(:channel_read_status, channel: public_channel, user: admin, last_read_message_id: nil)
        create(:message, channel: public_channel, user: creator)
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch["unread_count"]).to eq(0)
      end

      it "複数チャンネルで unread_count が正しく分離される" do
        other_channel = create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :public, name: "other-ch")
        create(:channel_read_status, channel: public_channel, user: member, last_read_message_id: nil)
        create(:channel_read_status, channel: other_channel, user: member, last_read_message_id: nil)
        create(:message, channel: public_channel, user: creator)
        create_list(:message, 2, channel: other_channel, user: creator)
        login_as(member)
        get base
        channels = JSON.parse(response.body)["channels"]
        ch_a = channels.find { |c| c["id"] == public_channel.id }
        ch_b = channels.find { |c| c["id"] == other_channel.id }
        expect(ch_a["unread_count"]).to eq(1)
        expect(ch_b["unread_count"]).to eq(2)
      end

      it "PATCH /read前後で一覧のunread_countが期待どおり変化する" do
        create_list(:message, 3, channel: public_channel, user: creator)
        login_as(member)

        # PATCH /read 前: ChannelReadStatusなしのため0
        get base
        ch_before = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch_before["unread_count"]).to eq(0)

        # 初回既読化
        patch "/api/v1/workspaces/#{workspace.id}/channels/#{public_channel.id}/read"
        expect(response).to have_http_status(:ok)

        # 別ユーザーが新規投稿
        create(:message, channel: public_channel, user: creator)

        get base
        ch_after = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch_after["unread_count"]).to eq(1)

        # 再既読化
        patch "/api/v1/workspaces/#{workspace.id}/channels/#{public_channel.id}/read"
        get base
        ch_reread = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch_reread["unread_count"]).to eq(0)
      end

      it "Channel#unread_count(user)モデルメソッドと一覧APIの値が一致する" do
        create(:channel_read_status, channel: public_channel, user: member, last_read_message_id: nil)
        create_list(:message, 4, channel: public_channel, user: creator)
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        model_value = public_channel.reload.unread_count(member)
        expect(ch["unread_count"]).to eq(model_value)
        expect(ch["unread_count"]).to eq(4)
      end

      it "回帰: 一度も開いていないチャンネルに既存メッセージが複数あってもunread_countは0" do
        create_list(:message, 6, channel: public_channel, user: creator)
        expect(ChannelReadStatus.where(user: member, channel: public_channel)).not_to exist
        login_as(member)
        get base
        ch = JSON.parse(response.body)["channels"].find { |c| c["id"] == public_channel.id }
        expect(ch["unread_count"]).to eq(0)
      end
    end

    it "複数チャンネル時のクエリ数がチャンネル数に比例しない（N+1確認）" do
      # 1 チャンネル時のクエリ数
      login_as(member)
      query_count_1 = 0
      ActiveSupport::Notifications.subscribe("sql.active_record") do |_n, _s, _f, _u, payload|
        query_count_1 += 1 unless payload[:sql].include?("SCHEMA")
      end
      get base
      ActiveSupport::Notifications.unsubscribe("sql.active_record")

      # 5 チャンネル時のクエリ数
      3.times { create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :public) }
      query_count_5 = 0
      ActiveSupport::Notifications.subscribe("sql.active_record") do |_n, _s, _f, _u, payload|
        query_count_5 += 1 unless payload[:sql].include?("SCHEMA")
      end
      get base
      ActiveSupport::Notifications.unsubscribe("sql.active_record")

      # 10 チャンネル時のクエリ数
      5.times { create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :public) }
      query_count_10 = 0
      ActiveSupport::Notifications.subscribe("sql.active_record") do |_n, _s, _f, _u, payload|
        query_count_10 += 1 unless payload[:sql].include?("SCHEMA")
      end
      get base
      ActiveSupport::Notifications.unsubscribe("sql.active_record")

      # クエリ数が増えすぎていないことを確認（チャンネル数に比例しない = N+1 なし）
      expect(query_count_5).to be <= query_count_1 * 2
      expect(query_count_10).to be <= query_count_1 * 3

      puts "--- Query count measurement ---"
      puts "1 channel: #{query_count_1} queries"
      puts "5 channels: #{query_count_5} queries"
      puts "10 channels: #{query_count_10} queries"
      puts "Growth rate (5 vs 1): #{(query_count_5.to_f / query_count_1).round(2)}x"
      puts "Growth rate (10 vs 1): #{(query_count_10.to_f / query_count_1).round(2)}x"
    end

    it "SQL詳細記録：1チャンネル時" do
      login_as(member)
      queries = []
      ActiveSupport::Notifications.subscribe("sql.active_record") do |_n, _s, _f, _u, payload|
        sql = payload[:sql]
        next if sql.include?("SCHEMA") || sql.include?("TRANSACTION") || sql.include?("CACHE") ||
                sql.include?("SAVEPOINT") || sql.include?("RELEASE")
        queries << sql
      end
      get base
      ActiveSupport::Notifications.unsubscribe("sql.active_record")

      puts "\n--- 1 Channel SQL Details ---"
      queries.each_with_index do |sql, idx|
        if sql.include?("SELECT")
          if sql.include?("users")
            puts "#{idx + 1}: [User] #{sql[0..100]}"
          elsif sql.include?("workspaces")
            puts "#{idx + 1}: [Workspace] #{sql[0..100]}"
          elsif sql.include?("workspace_memberships")
            puts "#{idx + 1}: [WorkspaceMembership] #{sql[0..100]}"
          elsif sql.include?("channel_memberships")
            puts "#{idx + 1}: [ChannelMembership] #{sql[0..100]}"
          elsif sql.include?("channels")
            puts "#{idx + 1}: [Channels+unread] #{sql[0..100]}"
          else
            puts "#{idx + 1}: [Other] #{sql[0..100]}"
          end
        end
      end
      puts "Total: #{queries.count} queries"
    end

    it "SQL詳細記録：5チャンネル時" do
      login_as(member)
      3.times { create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :public) }
      queries = []
      ActiveSupport::Notifications.subscribe("sql.active_record") do |_n, _s, _f, _u, payload|
        sql = payload[:sql]
        next if sql.include?("SCHEMA") || sql.include?("TRANSACTION") || sql.include?("CACHE") ||
                sql.include?("SAVEPOINT") || sql.include?("RELEASE")
        queries << sql
      end
      get base
      ActiveSupport::Notifications.unsubscribe("sql.active_record")

      puts "\n--- 5 Channels SQL Details ---"
      queries.each_with_index do |sql, idx|
        if sql.include?("SELECT")
          if sql.include?("users")
            puts "#{idx + 1}: [User] #{sql[0..100]}"
          elsif sql.include?("workspaces")
            puts "#{idx + 1}: [Workspace] #{sql[0..100]}"
          elsif sql.include?("workspace_memberships")
            puts "#{idx + 1}: [WorkspaceMembership] #{sql[0..100]}"
          elsif sql.include?("channel_memberships")
            puts "#{idx + 1}: [ChannelMembership] #{sql[0..100]}"
          elsif sql.include?("channels")
            puts "#{idx + 1}: [Channels+unread] #{sql[0..100]}"
          else
            puts "#{idx + 1}: [Other] #{sql[0..100]}"
          end
        end
      end
      puts "Total: #{queries.count} queries"
    end

    it "SQL詳細記録：10チャンネル時" do
      login_as(member)
      9.times { create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :public) }
      queries = []
      ActiveSupport::Notifications.subscribe("sql.active_record") do |_n, _s, _f, _u, payload|
        sql = payload[:sql]
        next if sql.include?("SCHEMA") || sql.include?("TRANSACTION") || sql.include?("CACHE") ||
                sql.include?("SAVEPOINT") || sql.include?("RELEASE")
        queries << sql
      end
      get base
      ActiveSupport::Notifications.unsubscribe("sql.active_record")

      puts "\n--- 10 Channels SQL Details ---"
      queries.each_with_index do |sql, idx|
        if sql.include?("SELECT")
          if sql.include?("users")
            puts "#{idx + 1}: [User] #{sql[0..100]}"
          elsif sql.include?("workspaces")
            puts "#{idx + 1}: [Workspace] #{sql[0..100]}"
          elsif sql.include?("workspace_memberships")
            puts "#{idx + 1}: [WorkspaceMembership] #{sql[0..100]}"
          elsif sql.include?("channel_memberships")
            puts "#{idx + 1}: [ChannelMembership] #{sql[0..100]}"
          elsif sql.include?("channels")
            puts "#{idx + 1}: [Channels+unread] #{sql[0..100]}"
          else
            puts "#{idx + 1}: [Other] #{sql[0..100]}"
          end
        end
      end
      puts "Total: #{queries.count} queries"
    end

    it "SQL詳細記録：20チャンネル時" do
      login_as(member)
      19.times { create(:channel, :with_creator_membership, workspace: workspace, created_by: creator, kind: :public) }
      queries = []
      ActiveSupport::Notifications.subscribe("sql.active_record") do |_n, _s, _f, _u, payload|
        sql = payload[:sql]
        next if sql.include?("SCHEMA") || sql.include?("TRANSACTION") || sql.include?("CACHE") ||
                sql.include?("SAVEPOINT") || sql.include?("RELEASE")
        queries << sql
      end
      get base
      ActiveSupport::Notifications.unsubscribe("sql.active_record")

      puts "\n--- 20 Channels SQL Details ---"
      queries.each_with_index do |sql, idx|
        if sql.include?("SELECT")
          if sql.include?("users")
            puts "#{idx + 1}: [User] #{sql[0..100]}"
          elsif sql.include?("workspaces")
            puts "#{idx + 1}: [Workspace] #{sql[0..100]}"
          elsif sql.include?("workspace_memberships")
            puts "#{idx + 1}: [WorkspaceMembership] #{sql[0..100]}"
          elsif sql.include?("channel_memberships")
            puts "#{idx + 1}: [ChannelMembership] #{sql[0..100]}"
          elsif sql.include?("channels")
            puts "#{idx + 1}: [Channels+unread] #{sql[0..100]}"
          else
            puts "#{idx + 1}: [Other] #{sql[0..100]}"
          end
        end
      end
      puts "Total: #{queries.count} queries"
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
