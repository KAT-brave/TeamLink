require "rails_helper"

RSpec.describe Message, type: :model do
  it "有効なファクトリを持つ" do
    expect(build(:message)).to be_valid
  end

  describe "関連" do
    it { expect(described_class.reflect_on_association(:channel).macro).to eq(:belongs_to) }
    it { expect(described_class.reflect_on_association(:user).macro).to eq(:belongs_to) }
  end

  describe "body" do
    it "必須" do
      expect(build(:message, body: "")).not_to be_valid
      expect(build(:message, body: nil)).not_to be_valid
    end

    it "5,000文字を許可する" do
      expect(build(:message, body: "a" * 5000)).to be_valid
    end

    it "5,001文字を拒否する" do
      expect(build(:message, body: "a" * 5001)).not_to be_valid
    end

    it "スペースだけを拒否する" do
      expect(build(:message, body: "   ")).not_to be_valid
    end

    it "タブだけを拒否する" do
      expect(build(:message, body: "\t\t")).not_to be_valid
    end

    it "改行だけを拒否する" do
      expect(build(:message, body: "\n\n")).not_to be_valid
    end

    it "スペースと改行を含む本文を許可する" do
      expect(build(:message, body: "Hello\nWorld  123")).to be_valid
    end

    it "前後空白が自動削除されない" do
      msg = create(:message, body: "  text  ")
      expect(msg.body).to eq("  text  ")
    end

    it "同じ本文を複数保存できる" do
      ws = create(:workspace)
      ch = create(:channel, workspace: ws)
      user1 = create(:user)
      user2 = create(:user)
      create(:workspace_membership, workspace: ws, user: user1)
      create(:workspace_membership, workspace: ws, user: user2)
      create(:channel_membership, channel: ch, user: user1)
      create(:channel_membership, channel: ch, user: user2)

      msg1 = create(:message, channel: ch, user: user1, body: "同じ内容")
      msg2 = create(:message, channel: ch, user: user2, body: "同じ内容")

      expect(msg1.id).not_to eq(msg2.id)
      expect(msg1.body).to eq(msg2.body)
    end
  end

  describe "is_edited" do
    it "作成直後はfalse" do
      msg = create(:message)
      expect(msg.public_attributes[:is_edited]).to be(false)
    end

    it "編集後はtrue" do
      msg = create(:message, body: "original")
      msg.update(body: "edited")
      expect(msg.public_attributes[:is_edited]).to be(true)
    end
  end
end
