import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { WorkspaceDetail } from '../WorkspaceDetail'
import * as api from '../../api/workspaces'
import * as authStore from '../../store/auth'

vi.mock('../../api/workspaces')
vi.mock('../../store/auth')

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/workspaces/1']}>
      <Routes>
        <Route path="/workspaces/:id" element={<WorkspaceDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authStore.useAuth).mockReturnValue({
    user: { id: 1, name: 'Owner', email: 'o@example.com' },
    loading: false,
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  })
  vi.mocked(api.listMembers).mockResolvedValue([
    { id: 10, user: { id: 1, name: 'Owner', email: 'o@example.com' }, role: 'owner' },
    { id: 11, user: { id: 2, name: 'Bob', email: 'b@example.com' }, role: 'member' },
  ])
})

describe('WorkspaceDetail', () => {
  it('所有者には編集フォーム・招待コード・メンバー削除ボタンを表示する', async () => {
    vi.mocked(api.getWorkspace).mockResolvedValue({
      workspace: { id: 1, name: 'Alpha', owner_id: 1 },
      role: 'owner',
    })
    vi.mocked(api.getInviteCode).mockResolvedValue('secret-code-xyz')
    renderDetail()

    expect(await screen.findByLabelText('ワークスペース名')).toBeInTheDocument()
    expect(screen.getByLabelText('招待コード')).toHaveTextContent('secret-code-xyz')
    // 一般メンバー Bob には削除ボタンが出る（owner 自身には出ない）
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
  })

  it('一般メンバーには編集フォームを出さず退出ボタンを表示する', async () => {
    vi.mocked(authStore.useAuth).mockReturnValue({
      user: { id: 2, name: 'Bob', email: 'b@example.com' },
      loading: false,
      signup: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    })
    vi.mocked(api.getWorkspace).mockResolvedValue({
      workspace: { id: 1, name: 'Alpha', owner_id: 1 },
      role: 'member',
    })
    renderDetail()

    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByLabelText('ワークスペース名')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '退出する' })).toBeInTheDocument()
    expect(api.getInviteCode).not.toHaveBeenCalled()
  })
})
