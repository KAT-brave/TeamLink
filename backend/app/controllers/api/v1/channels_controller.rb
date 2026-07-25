module Api
  module V1
    class ChannelsController < BaseController
      include WorkspaceAuthorization
      include ChannelAuthorization

      before_action :set_workspace
      before_action :require_member!
      before_action :set_channel, only: %i[show update destroy]
      before_action :require_channel_visible!, only: :show
      before_action :require_channel_manager!, only: %i[update destroy]

      # GET /api/v1/workspaces/:workspace_id/channels
      # 公開は全件、非公開は自分が参加中のものだけ。
      def index
        public_ids = @workspace.channels.kind_public.select(:id)
        joined_private_ids = @workspace.channels.kind_private
                                       .where(id: current_user.channel_memberships.select(:channel_id))
                                       .select(:id)
        channels = @workspace.channels
                             .where(id: public_ids).or(@workspace.channels.where(id: joined_private_ids))
                             .order(:created_at)
        render json: { channels: channels.map { |c| channel_json(c) } }
      end

      # GET /api/v1/workspaces/:workspace_id/channels/:id
      def show
        render json: { channel: channel_json(@channel) }
      end

      # POST /api/v1/workspaces/:workspace_id/channels
      # 作成者を transaction 内で自動参加させる。
      def create
        channel = @workspace.channels.new(create_params.merge(created_by: current_user))
        ActiveRecord::Base.transaction do
          channel.save!
          channel.channel_memberships.create!(user: current_user)
        end
        render json: { channel: channel_json(channel) }, status: :created
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.messages }, status: :unprocessable_entity
      rescue ArgumentError
        # enum に public/private 以外が指定された場合。
        render json: { errors: { kind: [ "は public または private を指定してください" ] } },
               status: :unprocessable_entity
      end

      # PATCH /api/v1/workspaces/:workspace_id/channels/:id (name/description のみ、kind不可)
      def update
        if @channel.update(update_params)
          render json: { channel: channel_json(@channel) }
        else
          render json: { errors: @channel.errors.messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/workspaces/:workspace_id/channels/:id
      def destroy
        @channel.destroy
        head :no_content
      end

      private

      def create_params
        params.require(:channel).permit(:name, :description, :kind)
      end

      def update_params
        # kind は作成後変更不可。
        params.require(:channel).permit(:name, :description)
      end

      # ユーザーごとの状態(参加済み/管理可否)はコントローラ側で付与する。
      def channel_json(channel)
        channel.public_attributes.merge(
          joined: channel.membership_for(current_user).present?,
          can_manage: channel.created_by_id == current_user.id || workspace_manager?
        )
      end
    end
  end
end
