import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../../store/auth'
import { Signup } from '../Signup'
import * as authApi from '../../api/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/auth')

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <AuthProvider>
        <Routes>
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<div>ホーム画面</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authApi.fetchMe).mockRejectedValue(new ApiError(401, 'ログインが必要です。'))
})

describe('Signup', () => {
  it('登録成功で自動ログインしホームへ遷移する', async () => {
    vi.mocked(authApi.signup).mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' })
    renderSignup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('表示名'), 'Alice')
    await user.type(screen.getByLabelText('メールアドレス'), 'alice@example.com')
    await user.type(screen.getByLabelText('パスワード(8文字以上)'), 'password123')
    await user.click(screen.getByRole('button', { name: '登録' }))

    expect(await screen.findByText('ホーム画面')).toBeInTheDocument()
  })

  it('メール重複などのバリデーションエラーを表示する', async () => {
    vi.mocked(authApi.signup).mockRejectedValue(
      new ApiError(422, '入力が不正です。', { email: ['はすでに使用されています'] }),
    )
    renderSignup()
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('表示名'), 'Alice')
    await user.type(screen.getByLabelText('メールアドレス'), 'dup@example.com')
    await user.type(screen.getByLabelText('パスワード(8文字以上)'), 'password123')
    await user.click(screen.getByRole('button', { name: '登録' }))

    expect(await screen.findByText('はすでに使用されています')).toBeInTheDocument()
  })
})
