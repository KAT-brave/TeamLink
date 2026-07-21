module Api
  module V1
    class WorkspaceInviteCodesController < BaseController
      include WorkspaceAuthorization

      before_action :set_workspace
      before_action :require_manager!

      # GET /api/v1/workspaces/:workspace_id/invite_code : 現在の招待コード(所有者/管理者)
      def show
        render json: { invite_code: @workspace.invite_code }
      end

      # POST /api/v1/workspaces/:workspace_id/invite_code : 招待コード再発行(所有者/管理者)
      def create
        @workspace.regenerate_invite_code!
        render json: { invite_code: @workspace.invite_code }, status: :created
      end
    end
  end
end
