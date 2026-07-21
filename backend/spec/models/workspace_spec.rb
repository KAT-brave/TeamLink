require "rails_helper"

RSpec.describe Workspace, type: :model do
  it "有効なファクトリを持つ" do
    expect(build(:workspace)).to be_valid
  end

  it "name が必須" do
    expect(build(:workspace, name: "")).not_to be_valid
  end

  it "作成時に招待コードを自動採番する" do
    ws = create(:workspace)
    expect(ws.invite_code).to be_present
  end

  it "招待コードは推測しにくい十分な長さ" do
    expect(Workspace.generate_invite_code.length).to be >= 24
  end

  it "招待コードは一意" do
    ws = create(:workspace)
    expect(build(:workspace, invite_code: ws.invite_code)).not_to be_valid
  end

  it "招待コードを再発行できる" do
    ws = create(:workspace)
    old = ws.invite_code
    ws.regenerate_invite_code!
    expect(ws.invite_code).not_to eq(old)
  end
end
