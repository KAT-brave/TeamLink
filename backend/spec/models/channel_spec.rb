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
end
