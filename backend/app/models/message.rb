class Message < ApplicationRecord
  belongs_to :channel
  belongs_to :user

  validates :body, presence: true,
                   length: { maximum: 5000 },
                   format: { with: /\S/, message: "は空白のみでは投稿できません" }

  scope :ordered, -> { order(:created_at, :id) }

  def public_attributes
    {
      id: id,
      channel_id: channel_id,
      user: user.public_attributes,
      body: body,
      created_at: created_at,
      updated_at: updated_at,
      is_edited: created_at != updated_at
    }
  end
end
