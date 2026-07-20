import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../store/auth'
import { Login } from '../Login'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>ホーム画面</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  // 起動時の /me は未ログイン扱い
  vi.mocked(authApi.fetchMe).mockRejectedValue(new ApiError(401, 'ログインが必要です。'))
})

describe('Login', () => {
  it('ログイン成功でホームへ遷移する', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ id: 1, name: 'Bob', email: 'bob@example.com' })
    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'bob@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByText('ホーム画面')).toBeInTheDocument()
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'bob@example.com',
      password: 'password123',
    })
  })

  it('ログイン失敗で汎用エラーを表示する', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(401, 'メールアドレスまたはパスワードが正しくありません。'),
    )
    renderLogin()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('メールアドレス'), 'bob@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'wrong123!')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('メールアドレスまたはパスワードが正しくありません。')
  })
})
