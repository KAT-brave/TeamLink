module Api
  module V1
    class MessagesController < BaseController
      include WorkspaceAuthorization
      include ChannelAuthorization

      before_action :set_workspace
      before_action :require_member!
      before_action :set_channel
      before_action :require_channel_visible!, only: :index
      before_action :set_message, only: %i[update destroy]

      # GET /api/v1/workspaces/:workspace_id/channels/:channel_id/messages
      def index
        messages = @channel.messages.ordered.includes(:user)
        render json: { messages: messages.map { |m| message_json(m) } }
      end

      # POST /api/v1/workspaces/:workspace_id/channels/:channel_id/messages
      def create
        # 非公開チャンネル未参加者には存在を秘匿
        unless channel_visible?
          return render_channel_not_found
        end

        unless channel_member?
          return render json: { error: "このチャンネルへの投稿権限がありません。" }, status: :forbidden
        end

        message = @channel.messages.new(create_params.merge(user: current_user))
        if message.save
          broadcast_message_created(message)
          render json: { message: message_json(message) }, status: :created
        else
          render json: { errors: message.errors.messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/workspaces/:workspace_id/channels/:channel_id/messages/:id
      def update
        unless @message.user_id == current_user.id
          return render_forbidden
        end

        if @message.update(update_params)
          broadcast_message_updated(@message)
          render json: { message: message_json(@message) }
        else
          render json: { errors: @message.errors.messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/workspaces/:workspace_id/channels/:channel_id/messages/:id
      def destroy
        unless @message.user_id == current_user.id
          return render_forbidden
        end

        message_id = @message.id
        channel_id = @message.channel_id

        if @message.destroy
          broadcast_message_deleted(message_id, channel_id)
          head :no_content
        else
          render json: { errors: @message.errors.messages }, status: :unprocessable_entity
        end
      end

      private

      def set_message
        @message = @channel.messages.find_by(id: params[:id])
        render_channel_not_found unless @message
      end

      def create_params
        params.require(:message).permit(:body)
      end

      def update_params
        params.require(:message).permit(:body)
      end

      def message_json(message)
        message.public_attributes.merge(
          can_edit: message.user_id == current_user.id,
          can_delete: message.user_id == current_user.id
        )
      end

      def message_broadcast_json(message)
        message.public_attributes
      end

      def broadcast_message_created(message)
        channel = message.channel
        ::MessageChannel.broadcast_to(
          channel,
          type: "message_created",
          message: message_broadcast_json(message)
        )
      rescue StandardError => e
        log_broadcast_failure("message_created", message.id, channel.id, e)
      end

      def broadcast_message_updated(message)
        channel = message.channel
        ::MessageChannel.broadcast_to(
          channel,
          type: "message_updated",
          message: message_broadcast_json(message)
        )
      rescue StandardError => e
        log_broadcast_failure("message_updated", message.id, channel.id, e)
      end

      def broadcast_message_deleted(message_id, channel_id)
        channel = Channel.find_by(id: channel_id)
        return unless channel

        ::MessageChannel.broadcast_to(
          channel,
          type: "message_deleted",
          message_id: message_id,
          channel_id: channel_id
        )
      rescue StandardError => e
        log_broadcast_failure("message_deleted", message_id, channel_id, e)
      end

      def log_broadcast_failure(event, message_id, channel_id, error)
        Rails.logger.error(
          "Message broadcast failed event=#{event} message_id=#{message_id} " \
          "channel_id=#{channel_id} error=#{error.class} message=#{error.message.inspect}"
        )
      end

      def render_forbidden
        render json: { error: "この操作を行う権限がありません。" }, status: :forbidden
      end
    end
  end
end
