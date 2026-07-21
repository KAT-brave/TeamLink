module Api
  module V1
    class WorkspaceMembershipsController < BaseController
      include WorkspaceAuthorization

      before_action :set_workspace
      before_action :require_member!, only: %i[index leave]
      before_action :require_manager!, only: :destroy

      # GET /api/v1/workspaces/:workspace_id/members : メンバー一覧(所属者のみ)
      def index
        memberships = @workspace.workspace_memberships.includes(:user).order(:created_at)
        render json: { members: memberships.map(&:public_attributes) }
      end

      # DELETE /api/v1/workspaces/:workspace_id/members/me : 自主退出
      def leave
        # 所有者の退出はブロックする。
        if current_membership.owner?
          return render json: {
            error: "所有者は退出できません。先に所有権の移譲またはワークスペースの削除が必要です。"
          }, status: :unprocessable_entity
        end
        current_membership.destroy
        head :no_content
      end

      # DELETE /api/v1/workspaces/:workspace_id/members/:id : メンバー削除(所有者/管理者)
      def destroy
        target = @workspace.workspace_memberships.find_by(user_id: params[:id])
        return render json: { error: "メンバーが見つかりません。" }, status: :not_found unless target

        unless removable?(target)
          return render json: { error: "このメンバーを削除する権限がありません。" }, status: :forbidden
        end

        target.destroy
        head :no_content
      end

      private

      # 所有者は自分以外を削除可。管理者は一般メンバーのみ削除可(所有者/管理者は不可)。
      def removable?(target)
        return false if target.id == current_membership.id
        return false if target.owner?

        if current_membership.owner?
          true
        else # admin
          target.member?
        end
      end
    end
  end
end
