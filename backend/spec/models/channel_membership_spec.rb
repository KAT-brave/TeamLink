require "rails_helper"

RSpec.describe ChannelMembership, type: :model do
  let(:workspace) { create(:workspace) }
  let(:channel) { create(:channel, workspace: workspace) }
  let(:user) { create(:user) }

  before { create(:workspace_membership, workspace: workspace, user: user, role: :member) }

  it "ワークスペース所属者なら有効" do
    expect(build(:channel_membership, channel: channel, user: user)).to be_valid
  end

  describe "関連" do
    it { expect(described_class.reflect_on_association(:channel).macro).to eq(:belongs_to) }
    it { expect(described_class.reflect_on_association(:user).macro).to eq(:belongs_to) }
  end

  it "同一channel/userの重複を禁止する" do
    create(:channel_membership, channel: channel, user: user)
    expect(build(:channel_membership, channel: channel, user: user)).not_to be_valid
  end

  it "チャンネルと別ワークスペース所属のユーザーは参加できない" do
    outsider = create(:user) # workspace に未所属
    expect(build(:channel_membership, channel: channel, user: outsider)).not_to be_valid
  end
end
