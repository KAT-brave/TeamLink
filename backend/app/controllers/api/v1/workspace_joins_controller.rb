module Api
  module V1
    class WorkspaceJoinsController < BaseController
      # POST /api/v1/workspaces/join : 招待コードで参加
      def create
        workspace = Workspace.find_by(invite_code: params[:code].to_s)
        # 無効なコードは存在を漏らさないため404。
        return render json: { error: "招待コードが無効です。" }, status: :not_found unless workspace

        membership = workspace.workspace_memberships.new(user: current_user, role: :member)
        if membership.save
          render json: { workspace: workspace.public_attributes }, status: :created
        elsif workspace.membership_for(current_user)
          # 同じユーザーの重複参加を防ぐ。
          render json: { error: "すでにこのワークスペースに参加しています。" }, status: :conflict
        else
          render json: { errors: membership.errors.messages }, status: :unprocessable_entity
        end
      end
    end
  end
end
