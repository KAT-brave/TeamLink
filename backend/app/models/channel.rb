class Channel < ApplicationRecord
  # kind: public=0 / private=1。Rubyの public/private との衝突を避けるため prefix を付与。
  # 判定は kind_public? / kind_private?、既定値は持たせず作成APIで明示指定させる。
  enum :kind, { public: 0, private: 1 }, prefix: :kind

  belongs_to :workspace
  belongs_to :created_by, class_name: "User"
  has_many :channel_memberships, dependent: :destroy
  has_many :members, through: :channel_memberships, source: :user
  has_many :messages, dependent: :destroy

  before_validation :normalize_name

  validates :name, presence: true, length: { maximum: 80 }
  # 同一ワークスペース内で大文字小文字を無視して一意(DBの関数indexと二重で防止)。
  validates :name, uniqueness: { scope: :workspace_id, case_sensitive: false }, if: -> { name.present? }
  validates :description, length: { maximum: 500 }
  validates :kind, presence: true

  def membership_for(user)
    channel_memberships.find_by(user_id: user&.id)
  end

  def public_attributes
    {
      id: id,
      workspace_id: workspace_id,
      name: name,
      description: description,
      kind: kind,
      created_by_id: created_by_id
    }
  end

  private

  # 保存前に前後空白を除去(表示時の大文字小文字は保持)。
  def normalize_name
    self.name = name.strip if name.is_a?(String)
  end
end
