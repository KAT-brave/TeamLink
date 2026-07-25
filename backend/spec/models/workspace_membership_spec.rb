require "rails_helper"

RSpec.describe WorkspaceMembership, type: :model do
  it "同一ワークスペースへの重複参加を許さない" do
    ws = create(:workspace)
    user = create(:user)
    create(:workspace_membership, workspace: ws, user: user)
    expect(build(:workspace_membership, workspace: ws, user: user)).not_to be_valid
  end

  it "role enum を持つ" do
    expect(WorkspaceMembership.roles.keys).to contain_exactly("member", "admin", "owner")
  end

  it "manager? は owner/admin で真" do
    expect(build(:workspace_membership, role: :owner).manager?).to be(true)
    expect(build(:workspace_membership, role: :admin).manager?).to be(true)
    expect(build(:workspace_membership, role: :member).manager?).to be(false)
  end

  describe "destroy時のChannelMembership削除" do
    let(:owner) { create(:user) }
    let(:member) { create(:user) }
    let(:other_user) { create(:user) }
    let(:ws1) { create(:workspace, :with_owner_membership, owner: owner) }
    let(:ws2) { create(:workspace, :with_owner_membership, owner: owner) }
    let(:ch1) { create(:channel, workspace: ws1, created_by: owner) }
    let(:ch2) { create(:channel, workspace: ws2, created_by: owner) }

    before do
      create(:workspace_membership, workspace: ws1, user: member, role: :member)
      create(:workspace_membership, workspace: ws2, user: member, role: :member)
      create(:workspace_membership, workspace: ws1, user: other_user, role: :member)
      create(:channel_membership, channel: ch1, user: member)
      create(:channel_membership, channel: ch2, user: member)
      create(:channel_membership, channel: ch1, user: other_user)
    end

    it "ワークスペースメンバー削除時に、同じワークスペースのChannelMembershipが削除される" do
      ws1_mem = ws1.membership_for(member)
      expect {
        ws1_mem.destroy
      }.to change(ChannelMembership, :count).by(-1)
      expect(ch1.membership_for(member)).to be_nil
    end

    it "別ワークスペースのChannelMembershipは削除されない" do
      ws1_mem = ws1.membership_for(member)
      expect {
        ws1_mem.destroy
      }.not_to change { ch2.membership_for(member) }
      expect(ch2.membership_for(member)).to be_present
    end

    it "他ユーザーのChannelMembershipは削除されない" do
      ws1_mem = ws1.membership_for(member)
      expect {
        ws1_mem.destroy
      }.not_to change { ch1.membership_for(other_user) }
      expect(ch1.membership_for(other_user)).to be_present
    end
  end
end
