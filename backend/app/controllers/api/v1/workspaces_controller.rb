module Api
  module V1
    class WorkspacesController < BaseController
      include WorkspaceAuthorization

      before_action :set_workspace, only: %i[show update]
      before_action :require_member!, only: :show
      before_action :require_manager!, only: :update

      # GET /api/v1/workspaces : 自分が所属するワークスペース一覧
      def index
        workspaces = current_user.workspaces.order(:created_at)
        render json: { workspaces: workspaces.map(&:public_attributes) }
      end

      # GET /api/v1/workspaces/:id : 詳細(所属者のみ)
      def show
        render json: {
          workspace: @workspace.public_attributes,
          role: current_membership.role
        }
      end

      # POST /api/v1/workspaces : 作成(作成者を所有者に)
      def create
        workspace = Workspace.new(workspace_params.merge(owner: current_user))
        ActiveRecord::Base.transaction do
          workspace.save!
          workspace.workspace_memberships.create!(user: current_user, role: :owner)
        end
        render json: { workspace: workspace.public_attributes }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.messages }, status: :unprocessable_entity
      end

      # PATCH /api/v1/workspaces/:id : 名前編集(所有者/管理者)
      def update
        if @workspace.update(workspace_params)
          render json: { workspace: @workspace.public_attributes }
        else
          render json: { errors: @workspace.errors.messages }, status: :unprocessable_entity
        end
      end

      private

      def workspace_params
        params.require(:workspace).permit(:name)
      end
    end
  end
end
