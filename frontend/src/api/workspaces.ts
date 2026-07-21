import { apiFetch } from './client'
import type { User } from './auth'

export type Role = 'member' | 'admin' | 'owner'
export type Workspace = { id: number; name: string; owner_id: number }
export type Member = { id: number; user: User; role: Role }

export async function listWorkspaces(): Promise<Workspace[]> {
  const data = await apiFetch<{ workspaces: Workspace[] }>('/workspaces')
  return data.workspaces
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const data = await apiFetch<{ workspace: Workspace }>('/workspaces', {
    method: 'POST',
    body: { workspace: { name } },
  })
  return data.workspace
}

export async function getWorkspace(id: number): Promise<{ workspace: Workspace; role: Role }> {
  return apiFetch<{ workspace: Workspace; role: Role }>(`/workspaces/${id}`)
}

export async function updateWorkspace(id: number, name: string): Promise<Workspace> {
  const data = await apiFetch<{ workspace: Workspace }>(`/workspaces/${id}`, {
    method: 'PATCH',
    body: { workspace: { name } },
  })
  return data.workspace
}

export async function listMembers(id: number): Promise<Member[]> {
  const data = await apiFetch<{ members: Member[] }>(`/workspaces/${id}/members`)
  return data.members
}

export async function getInviteCode(id: number): Promise<string> {
  const data = await apiFetch<{ invite_code: string }>(`/workspaces/${id}/invite_code`)
  return data.invite_code
}

export async function regenerateInviteCode(id: number): Promise<string> {
  const data = await apiFetch<{ invite_code: string }>(`/workspaces/${id}/invite_code`, {
    method: 'POST',
  })
  return data.invite_code
}

export async function joinWorkspace(code: string): Promise<Workspace> {
  const data = await apiFetch<{ workspace: Workspace }>('/workspaces/join', {
    method: 'POST',
    body: { code },
  })
  return data.workspace
}

export async function leaveWorkspace(id: number): Promise<void> {
  await apiFetch<void>(`/workspaces/${id}/members/me`, { method: 'DELETE' })
}

export async function removeMember(id: number, userId: number): Promise<void> {
  await apiFetch<void>(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' })
}
