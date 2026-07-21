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
end
