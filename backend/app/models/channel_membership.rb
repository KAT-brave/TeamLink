class ChannelMembership < ApplicationRecord
  belongs_to :channel
  belongs_to :user

  validates :user_id, uniqueness: { scope: :channel_id }
  validate :user_belongs_to_channel_workspace

  private

  # 参加ユーザーはチャンネルと同じワークスペースに所属していなければならない。
  def user_belongs_to_channel_workspace
    return if channel.blank? || user.blank?
    return if channel.workspace.membership_for(user).present?

    errors.add(:user, "はこのチャンネルのワークスペースに所属していません")
  end
end
