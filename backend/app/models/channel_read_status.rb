class ChannelReadStatus < ApplicationRecord
  belongs_to :user
  belongs_to :channel

  validates :user_id, presence: true
  validates :channel_id, presence: true
  validates :user_id, uniqueness: { scope: :channel_id }
  validates :last_read_message_id, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
end
