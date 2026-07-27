module Api
  module V1
    class MessageSearchesController < BaseController
      include WorkspaceAuthorization

      before_action :set_workspace
      before_action :require_member!

      MAX_RESULTS = 20

      # GET /api/v1/workspaces/:workspace_id/messages/search?q=検索語
      def show
        query = params[:q].to_s.strip

        if query.empty?
          return render json: { messages: [], query: "", total_count: 0 }
        end

        messages = Message
          .where(channel_id: visible_channel_ids)
          .where("messages.body ILIKE ? ESCAPE '\\'", "%#{ActiveRecord::Base.sanitize_sql_like(query)}%")
          .includes(:user, :channel)
          .order(created_at: :desc)
          .limit(MAX_RESULTS)

        render json: {
          messages: messages.map { |m| message_search_json(m) },
          query: query,
          total_count: messages.size
        }
      end

      private

      # 公開チャンネルは全件、非公開チャンネルは本人が参加中のものだけを対象とする。
      # owner/adminは未参加の非公開チャンネルも含める(ChannelAuthorization#channel_visible?と同じ権限)。
      def visible_channel_ids
        if current_membership.manager?
          @workspace.channels.select(:id)
        else
          joined_private_ids = current_user.channel_memberships
                                            .where(channel_id: @workspace.channels.select(:id))
                                            .select(:channel_id)
          @workspace.channels.kind_public.select(:id)
                    .or(@workspace.channels.where(id: joined_private_ids).select(:id))
        end
      end

      def message_search_json(message)
        {
          id: message.id,
          channel: { id: message.channel.id, name: message.channel.name },
          user: message.user.public_attributes,
          body: message.body,
          created_at: message.created_at,
          updated_at: message.updated_at,
          is_edited: message.created_at != message.updated_at
        }
      end
    end
  end
end
