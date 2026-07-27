import { apiFetch } from './client'
import type { User } from './auth'

export type ChannelKind = 'public' | 'private'

// バックエンドの channel_json に対応(joined / can_manage / unread_count はコントローラ付与)。
export type Channel = {
  id: number
  workspace_id: number
  name: string
  description: string | null
  kind: ChannelKind
  created_by_id: number
  joined: boolean
  can_manage: boolean
  unread_count: number
}

export type ChannelMember = { id: number; user: User }

export type ChannelInput = {
  name: string
  description?: string
  kind: ChannelKind
}

export async function listChannels(workspaceId: number): Promise<Channel[]> {
  const data = await apiFetch<{ channels: Channel[] }>(`/workspaces/${workspaceId}/channels`)
  return data.channels
}

export async function createChannel(workspaceId: number, input: ChannelInput): Promise<Channel> {
  const data = await apiFetch<{ channel: Channel }>(`/workspaces/${workspaceId}/channels`, {
    method: 'POST',
    body: { channel: input },
  })
  return data.channel
}

export async function getChannel(workspaceId: number, channelId: number): Promise<Channel> {
  const data = await apiFetch<{ channel: Channel }>(
    `/workspaces/${workspaceId}/channels/${channelId}`,
  )
  return data.channel
}

export async function updateChannel(
  workspaceId: number,
  channelId: number,
  input: { name: string; description?: string },
): Promise<Channel> {
  const data = await apiFetch<{ channel: Channel }>(
    `/workspaces/${workspaceId}/channels/${channelId}`,
    { method: 'PATCH', body: { channel: input } },
  )
  return data.channel
}

export async function deleteChannel(workspaceId: number, channelId: number): Promise<void> {
  await apiFetch<void>(`/workspaces/${workspaceId}/channels/${channelId}`, { method: 'DELETE' })
}

export async function joinChannel(workspaceId: number, channelId: number): Promise<void> {
  await apiFetch<void>(`/workspaces/${workspaceId}/channels/${channelId}/join`, { method: 'POST' })
}

export async function leaveChannel(workspaceId: number, channelId: number): Promise<void> {
  await apiFetch<void>(`/workspaces/${workspaceId}/channels/${channelId}/members/me`, {
    method: 'DELETE',
  })
}

export async function listChannelMembers(
  workspaceId: number,
  channelId: number,
): Promise<ChannelMember[]> {
  const data = await apiFetch<{ members: ChannelMember[] }>(
    `/workspaces/${workspaceId}/channels/${channelId}/members`,
  )
  return data.members
}

export async function inviteChannelMember(
  workspaceId: number,
  channelId: number,
  userId: number,
): Promise<ChannelMember> {
  const data = await apiFetch<{ member: ChannelMember }>(
    `/workspaces/${workspaceId}/channels/${channelId}/members`,
    { method: 'POST', body: { user_id: userId } },
  )
  return data.member
}
