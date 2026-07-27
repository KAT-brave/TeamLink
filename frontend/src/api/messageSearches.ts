import { apiFetch } from './client'

export type MessageSearchResult = {
  id: number
  channel: {
    id: number
    name: string
  }
  user: {
    id: number
    name: string
  }
  body: string
  created_at: string
  updated_at: string
  is_edited: boolean
}

export type MessageSearchResponse = {
  messages: MessageSearchResult[]
  query: string
  total_count: number
}

export async function searchMessages(
  workspaceId: number,
  query: string,
): Promise<MessageSearchResponse> {
  const params = new URLSearchParams({ q: query })
  return apiFetch<MessageSearchResponse>(
    `/workspaces/${workspaceId}/messages/search?${params.toString()}`,
  )
}
