require "rails_helper"

RSpec.describe Channel, type: :model do
  it "有効なファクトリを持つ" do
    expect(build(:channel)).to be_valid
  end

  describe "関連" do
    it { expect(described_class.reflect_on_association(:workspace).macro).to eq(:belongs_to) }
    it { expect(described_class.reflect_on_association(:created_by).macro).to eq(:belongs_to) }
    it { expect(described_class.reflect_on_association(:channel_memberships).macro).to eq(:has_many) }
    it { expect(described_class.reflect_on_association(:members).macro).to eq(:has_many) }
    it { expect(described_class.reflect_on_association(:channel_read_statuses).macro).to eq(:has_many) }
  end

  describe "kind enum" do
    it "public/private を持ち prefix 付き判定メソッドを持つ" do
      expect(described_class.kinds).to eq("public" => 0, "private" => 1)
      expect(build(:channel, kind: :public).kind_public?).to be(true)
      expect(build(:channel, kind: :private).kind_private?).to be(true)
    end
  end

  describe "name" do
    it "必須" do
      expect(build(:channel, name: "")).not_to be_valid
    end

    it "保存前に前後の空白を除去する" do
      ch = create(:channel, name: "  general  ")
      expect(ch.name).to eq("general")
    end

    it "同一ワークスペース内で大文字小文字を無視して重複を禁止" do
      ws = create(:workspace)
      create(:channel, workspace: ws, name: "General")
      expect(build(:channel, workspace: ws, name: "general")).not_to be_valid
    end

    it "別ワークスペースでは同名を許可する" do
      create(:channel, name: "General")
      expect(build(:channel, workspace: create(:workspace), name: "General")).to be_valid
    end
  end

  describe "description" do
    it "500文字以内は有効" do
      expect(build(:channel, description: "a" * 500)).to be_valid
    end

    it "501文字は無効" do
      expect(build(:channel, description: "a" * 501)).not_to be_valid
    end

    it "任意(nil可)" do
      expect(build(:channel, description: nil)).to be_valid
    end
  end

  describe "#unread_count" do
    let(:channel) { create(:channel) }
    let(:user) { create(:user) }
    let(:other_user) { create(:user) }

    it "既読レコードなしは 0" do
      expect(channel.unread_count(user)).to eq(0)
    end

    it "メッセージなしは 0" do
      create(:channel_read_status, channel: channel, user: user)
      expect(channel.unread_count(user)).to eq(0)
    end

    it "existing で他人のメッセージをカウント" do
      read_status = create(:channel_read_status, channel: channel, user: user, last_read_message_id: nil)
      m1 = create(:message, channel: channel, user: user)
      m2 = create(:message, channel: channel, user: other_user)
      read_status.update(last_read_message_id: m1.id)
      expect(channel.unread_count(user)).to eq(1)
    end

    it "既読位置以前をカウントしない" do
      m1 = create(:message, channel: channel, user: other_user)
      m2 = create(:message, channel: channel, user: other_user)
      read_status = create(:channel_read_status, channel: channel, user: user, last_read_message_id: m1.id)
      expect(channel.unread_count(user)).to eq(1)
    end

    it "自分の投稿をカウントしない" do
      m1 = create(:message, channel: channel, user: user)
      m2 = create(:message, channel: channel, user: user)
      m3 = create(:message, channel: channel, user: other_user)
      create(:channel_read_status, channel: channel, user: user, last_read_message_id: nil)
      expect(channel.unread_count(user)).to eq(1)
    end

    it "削除されたメッセージをカウントしない" do
      m1 = create(:message, channel: channel, user: other_user)
      m2 = create(:message, channel: channel, user: other_user)
      m3 = create(:message, channel: channel, user: other_user)
      m2.destroy
      create(:channel_read_status, channel: channel, user: user, last_read_message_id: m1.id)
      expect(channel.unread_count(user)).to eq(1)
    end

    it "既読位置のメッセージを削除してもlast_read_message_idが維持される場合、過去メッセージが未読へ戻らない" do
      m1 = create(:message, channel: channel, user: other_user)
      m2 = create(:message, channel: channel, user: other_user)
      m3 = create(:message, channel: channel, user: other_user)
      read_status = create(:channel_read_status, channel: channel, user: user, last_read_message_id: m2.id)
      m2.destroy
      # last_read_message_id = m2.id、しかし m2 は削除済み
      # 未読 = m3 の 1 件
      expect(channel.unread_count(user)).to eq(1)
    end

    it "複数チャンネルを分離" do
      channel2 = create(:channel, workspace: channel.workspace)
      m1 = create(:message, channel: channel, user: other_user)
      m2 = create(:message, channel: channel2, user: other_user)
      create(:channel_read_status, channel: channel, user: user, last_read_message_id: nil)
      create(:channel_read_status, channel: channel2, user: user, last_read_message_id: nil)
      expect(channel.unread_count(user)).to eq(1)
      expect(channel2.unread_count(user)).to eq(1)
    end

    it "別ユーザーの既読位置と混ざらない" do
      other_user2 = create(:user)
      m1 = create(:message, channel: channel, user: other_user)
      m2 = create(:message, channel: channel, user: other_user)
      create(:channel_read_status, channel: channel, user: user, last_read_message_id: m1.id)
      create(:channel_read_status, channel: channel, user: other_user2, last_read_message_id: nil)
      expect(channel.unread_count(user)).to eq(1)
      expect(channel.unread_count(other_user2)).to eq(2)
    end

    it "ユーザーが nil の場合は 0" do
      expect(channel.unread_count(nil)).to eq(0)
    end
  end
end
