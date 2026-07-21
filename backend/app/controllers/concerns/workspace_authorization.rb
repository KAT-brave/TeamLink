# ワークスペースのスコープと権限判定を集約する。
# 権限判定は必ずバックエンドで行い、フロントの表示制御には依存しない。
module WorkspaceAuthorization
  extend ActiveSupport::Concern

  private

  def set_workspace
    @workspace = Workspace.find_by(id: params[:workspace_id] || params[:id])
    render_not_found unless @workspace
  end

  # 自分のこのワークスペースでのメンバーシップ。
  def current_membership
    return @current_membership if defined?(@current_membership)
    @current_membership = @workspace&.membership_for(current_user)
  end

  # 非所属者は詳細を閲覧できない。存在を漏らさないため404を返す。
  def require_member!
    render_not_found unless current_membership
  end

  # 名前編集・招待コード・メンバー削除は所有者/管理者のみ。
  # 非所属者には存在を漏らさないため404、所属だが権限不足は403。
  def require_manager!
    return render_not_found unless current_membership
    render_forbidden unless current_membership.manager?
  end

  def render_not_found
    render json: { error: "ワークスペースが見つかりません。" }, status: :not_found
  end

  def render_forbidden
    render json: { error: "この操作を行う権限がありません。" }, status: :forbidden
  end
end
