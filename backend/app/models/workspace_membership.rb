class WorkspaceMembership < ApplicationRecord
  # 役割: 一般メンバー / 管理者 / 所有者
  enum :role, { member: 0, admin: 1, owner: 2 }

  belongs_to :workspace
  belongs_to :user

  validates :user_id, uniqueness: { scope: :workspace_id }
  validates :role, presence: true

  before_destroy :destroy_channel_memberships_in_workspace

  # 名前編集・メンバー削除・招待コード操作が可能か。
  def manager?
    owner? || admin?
  end

  def public_attributes
    { id: id, user: user.public_attributes, role: role }
  end

  private

  # ワークスペース退出・除名時に、同じワークスペース内の非公開チャンネル参加情報を削除する。
  # 非公開チャンネルは招待制のため、ワークスペースから出たユーザーが再参加時に
  # 招待なしでアクセスできないよう整合性を保つ。
  def destroy_channel_memberships_in_workspace
    ChannelMembership
      .joins(:channel)
      .where(user_id: user_id, channels: { workspace_id: workspace_id })
      .destroy_all
  end
end
