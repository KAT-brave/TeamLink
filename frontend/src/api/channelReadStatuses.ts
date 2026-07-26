import { apiFetch } from './client'

export type ChannelReadStatusResponse = {
  read_status: {
    channel_id: number
    last_read_message_id: number | null
    unread_count: number
  }
}

// last_read_message_id はサーバー側で決定するため、リクエストボディは送らない。
export async function updateChannelReadStatus(
  workspaceId: number,
  channelId: number,
): Promise<ChannelReadStatusResponse> {
  return apiFetch<ChannelReadStatusResponse>(
    `/workspaces/${workspaceId}/channels/${channelId}/read`,
    { method: 'PATCH' },
  )
}
