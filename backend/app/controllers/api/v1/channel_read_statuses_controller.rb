module Api
  module V1
    class ChannelReadStatusesController < BaseController
      include WorkspaceAuthorization
      include ChannelAuthorization

      before_action :set_workspace
      before_action :require_member!
      before_action :set_channel
      before_action :require_channel_visible!

      # PATCH /api/v1/workspaces/:workspace_id/channels/:channel_id/read
      # クライアントからは message_id を受け取らず、サーバーで最新 ID を決定。
      def update
        latest_message_id = @channel.messages.maximum(:id)

        read_status = @channel.channel_read_statuses.find_or_initialize_by(user_id: current_user.id)

        # 既読位置を巻き戻さない（既存値より小さい場合は更新しない）
        existing_id = read_status.last_read_message_id || 0
        new_id = latest_message_id || 0
        read_status.last_read_message_id = [ existing_id, new_id ].max if new_id > 0 || existing_id == 0

        if read_status.save
          render json: {
            read_status: {
              channel_id: @channel.id,
              last_read_message_id: read_status.last_read_message_id,
              unread_count: 0
            }
          }
        else
          render json: { errors: read_status.errors.messages }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotUnique
        # 同時実行による競合：既存レコードを再取得し、最新メッセージIDまで更新して応答
        latest_message_id = @channel.messages.maximum(:id)
        read_status = @channel.channel_read_statuses.find_by(user_id: current_user.id)
        if read_status
          # 既読位置を巻き戻さないロジックを再適用
          existing_id = read_status.last_read_message_id || 0
          new_id = latest_message_id || 0
          read_status.last_read_message_id = [ existing_id, new_id ].max if new_id > 0 || existing_id == 0
          # 更新を試みる（失敗時は422を返す）
          if read_status.save
            render json: {
              read_status: {
                channel_id: @channel.id,
                last_read_message_id: read_status.last_read_message_id,
                unread_count: 0
              }
            }
          else
            render json: { errors: read_status.errors.messages }, status: :unprocessable_entity
          end
        else
          render json: { errors: { base: [ "既読状態の取得に失敗しました" ] } }, status: :unprocessable_entity
        end
      end

      private

      def set_channel
        @channel = @workspace.channels.find_by(id: params[:channel_id])
        render_channel_not_found unless @channel
      end
    end
  end
end
