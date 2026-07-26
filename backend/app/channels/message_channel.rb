class MessageChannel < ApplicationCable::Channel
  def subscribed
    reject_unauth unless current_user

    @channel_id = params[:channel_id].to_i
    @channel = Channel.find_by(id: @channel_id)
    reject_channel_not_found unless @channel

    reject_workspace_not_member unless user_workspace_member?
    reject_channel_not_visible unless channel_visible?

    stream_for @channel
  end

  def unsubscribed
    # cleanup when subscription ends
  end

  private

  def user_workspace_member?
    return false unless @channel

    @current_membership ||= current_user.workspace_memberships.find_by(workspace_id: @channel.workspace_id)
    @current_membership.present?
  end

  def channel_member?
    return false unless @channel

    @channel.membership_for(current_user).present?
  end

  def workspace_manager?
    return false unless @current_membership

    @current_membership.manager?
  end

  def channel_visible?
    return false unless @channel
    return true if @channel.kind_public?

    channel_member? || workspace_manager?
  end

  def reject_unauth
    reject
  end

  def reject_workspace_not_member
    reject
  end

  def reject_channel_not_found
    reject
  end

  def reject_channel_not_visible
    reject
  end
end
