class WorkspaceMembership < ApplicationRecord
  # 役割: 一般メンバー / 管理者 / 所有者
  enum :role, { member: 0, admin: 1, owner: 2 }

  belongs_to :workspace
  belongs_to :user

  validates :user_id, uniqueness: { scope: :workspace_id }
  validates :role, presence: true

  # 名前編集・メンバー削除・招待コード操作が可能か。
  def manager?
    owner? || admin?
  end

  def public_attributes
    { id: id, user: user.public_attributes, role: role }
  end
end
