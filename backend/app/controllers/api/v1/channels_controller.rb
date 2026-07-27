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
        joined_channel_ids = current_user.channel_memberships.where(channel_id: @workspace.channels.select(:id)).pluck(:channel_id).to_set
        joined_private_ids = @workspace.channels.kind_private
                                       .where(id: joined_channel_ids)
                                       .select(:id)
        channels = @workspace.channels
                             .where(id: public_ids).or(@workspace.channels.where(id: joined_private_ids))
                             .select(
                               "channels.*",
                               ApplicationRecord.sanitize_sql_array([
                                 %{
                                   CASE
                                     WHEN NOT EXISTS (
                                       SELECT 1
                                       FROM channel_read_statuses
                                       WHERE user_id = ? AND channel_id = channels.id
                                     )
                                     THEN 0
                                     ELSE (
                                       SELECT COUNT(*)
                                       FROM messages
                                       WHERE channel_id = channels.id
                                       AND id > COALESCE(
                                         (SELECT last_read_message_id
                                          FROM channel_read_statuses
                                          WHERE user_id = ? AND channel_id = channels.id),
                                         0
                                       )
                                       AND user_id != ?
                                     )
                                   END AS unread_count
                                 },
                                 current_user.id,
                                 current_user.id,
                                 current_user.id
                               ])
                             )
                             .order(:created_at)
        render json: { channels: channels.map { |c| channel_json(c, unread_count: c.read_attribute(:unread_count), joined: joined_channel_ids.include?(c.id)) } }
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

      # ユーザーごとの状態(参加済み/管理可否/未読件数)はコントローラ側で付与する。
      def channel_json(channel, unread_count: nil, joined: nil)
        json = channel.public_attributes.merge(
          joined: joined.nil? ? channel.membership_for(current_user).present? : joined,
          can_manage: channel.created_by_id == current_user.id || workspace_manager?
        )
        json[:unread_count] = unread_count.nil? ? channel.unread_count(current_user) : unread_count
        json
      end
    end
  end
end
