import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../store/auth'
import { ProtectedRoute } from '../ProtectedRoute'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>保護ページ</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>ログイン画面</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('ProtectedRoute', () => {
  it('未ログインなら /login へリダイレクトする', async () => {
    vi.mocked(authApi.fetchMe).mockRejectedValue(new ApiError(401, 'ログインが必要です。'))
    renderApp()
    expect(await screen.findByText('ログイン画面')).toBeInTheDocument()
  })

  it('ログイン済みなら保護ページを表示する', async () => {
    vi.mocked(authApi.fetchMe).mockResolvedValue({ id: 1, name: 'Bob', email: 'bob@example.com' })
    renderApp()
    expect(await screen.findByText('保護ページ')).toBeInTheDocument()
  })
})
