class Workspace < ApplicationRecord
  belongs_to :owner, class_name: "User"
  has_many :workspace_memberships, dependent: :destroy
  has_many :members, through: :workspace_memberships, source: :user

  validates :name, presence: true, length: { maximum: 100 }
  validates :invite_code, presence: true, uniqueness: true

  before_validation :ensure_invite_code, on: :create

  # 招待コードを推測しにくいランダム値で(再)発行する。
  def regenerate_invite_code!
    update!(invite_code: self.class.generate_invite_code)
  end

  def self.generate_invite_code
    SecureRandom.urlsafe_base64(24)
  end

  # 指定ユーザーのこのワークスペースでのメンバーシップ(無ければ nil)。
  def membership_for(user)
    workspace_memberships.find_by(user_id: user&.id)
  end

  def public_attributes
    { id: id, name: name, owner_id: owner_id }
  end

  private

  def ensure_invite_code
    self.invite_code ||= self.class.generate_invite_code
  end
end
