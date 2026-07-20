import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from '../auth'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function Probe() {
  const { user, loading } = useAuth()
  if (loading) return <p>読み込み中</p>
  return <p>{user ? `ログイン中: ${user.name}` : '未ログイン'}</p>
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AuthProvider', () => {
  it('起動時に /me からログイン状態を復元する', async () => {
    vi.mocked(authApi.fetchMe).mockResolvedValue({ id: 1, name: 'Carol', email: 'carol@example.com' })
    renderProbe()
    expect(await screen.findByText('ログイン中: Carol')).toBeInTheDocument()
  })

  it('/me が401なら未ログイン扱いにする', async () => {
    vi.mocked(authApi.fetchMe).mockRejectedValue(new ApiError(401, 'ログインが必要です。'))
    renderProbe()
    expect(await screen.findByText('未ログイン')).toBeInTheDocument()
  })
})
