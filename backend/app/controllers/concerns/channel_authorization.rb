# チャンネルのスコープと権限判定を集約する。
# 権限判定は必ずバックエンドで行い、非公開チャンネルの存在は非該当者に秘匿する。
# 前提: WorkspaceAuthorization の set_workspace / require_member! で
#       ワークスペース所属(current_membership)が確定していること。
module ChannelAuthorization
  extend ActiveSupport::Concern

  private

  # 別ワークスペースのチャンネルを参照できないよう @workspace.channels から取得する。
  # ネスト(members/join)では :channel_id、単体(show等)では :id で渡る。
  def set_channel
    @channel = @workspace.channels.find_by(id: params[:channel_id] || params[:id])
    render_channel_not_found unless @channel
  end

  # 閲覧可否。公開=ワークスペース所属者(既に確定)ならOK。
  # 非公開=チャンネル参加者、または管理上の例外として ws owner/admin のみ。
  def channel_visible?
    return true if @channel.kind_public?

    channel_member? || workspace_manager?
  end

  # 編集・削除・招待の権限: チャンネル作成者 または ws owner/admin。
  def channel_manager?
    @channel.created_by_id == current_user.id || workspace_manager?
  end

  def channel_member?
    @channel.membership_for(current_user).present?
  end

  def workspace_manager?
    current_membership&.manager?
  end

  # 詳細・メンバー一覧: 非該当者には存在を秘匿し404。
  def require_channel_visible!
    render_channel_not_found unless channel_visible?
  end

  # 編集・削除・招待: まず非該当者へは404で秘匿し、閲覧可だが権限不足なら403。
  def require_channel_manager!
    return render_channel_not_found unless channel_visible?
    render_forbidden unless channel_manager?
  end

  # 非公開チャンネルの存在を漏らさないため、ワークスペース非該当と同じ404文言。
  def render_channel_not_found
    render json: { error: "チャンネルが見つかりません。" }, status: :not_found
  end
end
