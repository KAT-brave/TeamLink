module Api
  module V1
    class ChannelMembershipsController < BaseController
      include WorkspaceAuthorization
      include ChannelAuthorization

      before_action :set_workspace
      before_action :require_member!
      before_action :set_channel
      before_action :require_channel_visible!, only: :index
      before_action :require_channel_manager!, only: :create # 招待

      # GET /api/v1/workspaces/:workspace_id/channels/:id/members
      def index
        memberships = @channel.channel_memberships.includes(:user).order(:created_at)
        render json: { members: memberships.map { |m| member_json(m) } }
      end

      # POST /api/v1/workspaces/:workspace_id/channels/:id/join
      def join
        if @channel.kind_private?
          # 非公開は招待のみ。未参加者には存在を秘匿し404、既参加は409。
          return render_channel_not_found unless channel_member?

          return render json: { error: "すでにこのチャンネルに参加しています。" }, status: :conflict
        end

        return render json: { error: "すでにこのチャンネルに参加しています。" }, status: :conflict if channel_member?

        @channel.channel_memberships.create!(user: current_user)
        render json: { channel: @channel.public_attributes }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.messages }, status: :unprocessable_entity
      end

      # DELETE /api/v1/workspaces/:workspace_id/channels/:id/members/me
      def leave
        membership = @channel.membership_for(current_user)
        return render_channel_not_found unless membership

        if @channel.created_by_id == current_user.id
          return render json: { error: "チャンネル作成者は退出できません。" }, status: :unprocessable_entity
        end

        membership.destroy
        head :no_content
      end

      # POST /api/v1/workspaces/:workspace_id/channels/:id/members (非公開への招待)
      def create
        target = User.find_by(id: params[:user_id])
        # 招待対象は同じワークスペース所属者のみ。それ以外は422。
        unless target && @workspace.membership_for(target)
          return render json: { error: "招待できるのは同じワークスペースの所属者のみです。" },
                        status: :unprocessable_entity
        end

        if @channel.membership_for(target)
          return render json: { error: "すでにこのチャンネルに参加しています。" }, status: :conflict
        end

        membership = @channel.channel_memberships.create!(user: target)
        render json: { member: member_json(membership) }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.messages }, status: :unprocessable_entity
      end

      private

      def member_json(membership)
        { id: membership.id, user: membership.user.public_attributes }
      end
    end
  end
end
