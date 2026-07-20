import { apiFetch, resetCsrfToken } from './client'

export type User = { id: number; name: string; email: string }

export async function signup(input: {
  name: string
  email: string
  password: string
}): Promise<User> {
  const data = await apiFetch<{ user: User }>('/auth/signup', {
    method: 'POST',
    body: { user: input },
  })
  return data.user
}

export async function login(input: { email: string; password: string }): Promise<User> {
  const data = await apiFetch<{ user: User }>('/auth/login', {
    method: 'POST',
    body: input,
  })
  return data.user
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'DELETE' })
  resetCsrfToken()
}

export async function fetchMe(): Promise<User> {
  const data = await apiFetch<{ user: User }>('/me')
  return data.user
}
