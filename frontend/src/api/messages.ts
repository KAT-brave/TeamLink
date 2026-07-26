import { apiFetch } from './client'
import type { User } from './auth'

export type MessageUser = Pick<User, 'id' | 'name' | 'email'>

export type Message = {
  id: number
  channel_id: number
  user: MessageUser
  body: string
  created_at: string
  updated_at: string
  is_edited: boolean
  can_edit: boolean
  can_delete: boolean
}

export type MessagesResponse = {
  messages: Message[]
}

export type MessageResponse = {
  message: Message
}

export type CreateMessageParams = {
  body: string
}

export type UpdateMessageParams = {
  body: string
}

export async function getMessages(workspaceId: number, channelId: number): Promise<Message[]> {
  const data = await apiFetch<MessagesResponse>(
    `/workspaces/${workspaceId}/channels/${channelId}/messages`,
  )
  return data.messages
}

export async function createMessage(
  workspaceId: number,
  channelId: number,
  body: string,
): Promise<Message> {
  const data = await apiFetch<MessageResponse>(
    `/workspaces/${workspaceId}/channels/${channelId}/messages`,
    { method: 'POST', body: { message: { body } } },
  )
  return data.message
}

export async function updateMessage(
  workspaceId: number,
  channelId: number,
  messageId: number,
  body: string,
): Promise<Message> {
  const data = await apiFetch<MessageResponse>(
    `/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}`,
    { method: 'PATCH', body: { message: { body } } },
  )
  return data.message
}

export async function deleteMessage(
  workspaceId: number,
  channelId: number,
  messageId: number,
): Promise<void> {
  await apiFetch<void>(`/workspaces/${workspaceId}/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
  })
}
