import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ChannelDetail } from '../ChannelDetail'
import * as api from '../../api/channels'
import type { Channel } from '../../api/channels'
import * as wsApi from '../../api/workspaces'
import * as authStore from '../../store/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/channels')
vi.mock('../../api/workspaces')
vi.mock('../../store/auth')

const CURRENT_USER = { id: 1, name: 'Alice', email: 'a@example.com' }

function makeChannel(over: Partial<Channel> = {}): Channel {
  return {
    id: 3,
    workspace_id: 10,
    name: 'general',
    description: 'the general channel',
    kind: 'public',
    created_by_id: 1,
    joined: true,
    can_manage: true,
    ...over,
  }
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/workspaces/10/channels/3']}>
      <Routes>
        <Route path="/workspaces/:workspaceId/channels/:channelId" element={<ChannelDetail />} />
        <Route path="/workspaces/:workspaceId/channels" element={<div>チャンネル一覧画面</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authStore.useAuth).mockReturnValue({
    user: CURRENT_USER,
    loading: false,
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  })
  vi.mocked(api.listChannelMembers).mockResolvedValue([
    { id: 1, user: CURRENT_USER },
  ])
  vi.mocked(wsApi.listMembers).mockResolvedValue([
    { id: 1, user: CURRENT_USER, role: 'owner' },
    { id: 2, user: { id: 2, name: 'Bob', email: 'b@example.com' }, role: 'member' },
  ])
})

describe('ChannelDetail', () => {
  it('ローディング中はローディング表示', () => {
    vi.mocked(api.getChannel).mockReturnValue(new Promise(() => {}))
    renderDetail()
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('チャンネル詳細を表示する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'general' })).toBeInTheDocument()
    expect(screen.getByText('the general channel', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('公開')).toBeInTheDocument()
    expect(screen.getByText('参加中')).toBeInTheDocument()
  })

  it('404は権限/存在エラーを表示する', async () => {
    vi.mocked(api.getChannel).mockRejectedValue(new ApiError(404, 'not found'))
    renderDetail()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'チャンネルが存在しない、または閲覧権限がありません。',
    )
  })

  it('管理権限があると編集UIを表示する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ can_manage: true }))
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'チャンネルを編集' })).toBeInTheDocument()
  })

  it('管理権限がないと編集UIを表示しない', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ can_manage: false, created_by_id: 2 }))
    renderDetail()
    await screen.findByRole('heading', { name: 'general' })
    expect(screen.queryByRole('heading', { name: 'チャンネルを編集' })).not.toBeInTheDocument()
  })

  it('チャンネル名・説明を更新する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
    vi.mocked(api.updateChannel).mockResolvedValue(makeChannel({ name: 'renamed' }))
    renderDetail()
    await screen.findByRole('heading', { name: 'チャンネルを編集' })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '更新' }))
    expect(api.updateChannel).toHaveBeenCalledWith(10, 3, {
      name: 'general',
      description: 'the general channel',
    })
  })

  it('公開の未参加チャンネルで参加できる', async () => {
    vi.mocked(api.getChannel)
      .mockResolvedValueOnce(makeChannel({ kind: 'public', joined: false, can_manage: false, created_by_id: 2 }))
      .mockResolvedValueOnce(makeChannel({ kind: 'public', joined: true, can_manage: false, created_by_id: 2 }))
    vi.mocked(api.joinChannel).mockResolvedValue(undefined)
    renderDetail()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '参加' }))
    expect(api.joinChannel).toHaveBeenCalledWith(10, 3)
  })

  it('参加者(非作成者)は退出でき、一覧へ遷移する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(
      makeChannel({ joined: true, created_by_id: 2, can_manage: false }),
    )
    vi.mocked(api.leaveChannel).mockResolvedValue(undefined)
    renderDetail()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '退出する' }))
    expect(api.leaveChannel).toHaveBeenCalledWith(10, 3)
    expect(await screen.findByText('チャンネル一覧画面')).toBeInTheDocument()
  })

  it('作成者には退出ボタンを表示しない', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true, created_by_id: 1 }))
    renderDetail()
    await screen.findByRole('heading', { name: 'general' })
    expect(screen.queryByRole('button', { name: '退出する' })).not.toBeInTheDocument()
  })

  it('非公開かつ管理権限があると招待UIを表示する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ kind: 'private', can_manage: true }))
    renderDetail()
    expect(await screen.findByRole('heading', { name: 'メンバーを招待' })).toBeInTheDocument()
  })

  it('管理権限がないと招待UIを表示しない', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(
      makeChannel({ kind: 'private', can_manage: false, created_by_id: 2 }),
    )
    renderDetail()
    await screen.findByRole('heading', { name: 'general' })
    expect(screen.queryByRole('heading', { name: 'メンバーを招待' })).not.toBeInTheDocument()
  })

  it('招待成功でメンバー一覧を更新する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ kind: 'private', can_manage: true }))
    vi.mocked(api.listChannelMembers)
      .mockResolvedValueOnce([{ id: 1, user: CURRENT_USER }])
      .mockResolvedValueOnce([
        { id: 1, user: CURRENT_USER },
        { id: 2, user: { id: 2, name: 'Bob', email: 'b@example.com' } },
      ])
    vi.mocked(api.inviteChannelMember).mockResolvedValue({
      id: 2,
      user: { id: 2, name: 'Bob', email: 'b@example.com' },
    })
    renderDetail()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'メンバーを招待' })
    await user.selectOptions(screen.getByLabelText('招待するユーザー'), '2')
    await user.click(screen.getByRole('button', { name: '招待' }))
    expect(api.inviteChannelMember).toHaveBeenCalledWith(10, 3, 2)
    expect(await screen.findByText('Bob')).toBeInTheDocument()
  })

  it('削除は確認後に実行され一覧へ遷移する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ can_manage: true }))
    vi.mocked(api.deleteChannel).mockResolvedValue(undefined)
    window.confirm = vi.fn().mockReturnValue(true)
    renderDetail()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '削除' }))
    expect(api.deleteChannel).toHaveBeenCalledWith(10, 3)
    expect(await screen.findByText('チャンネル一覧画面')).toBeInTheDocument()
  })

  it('削除失敗時はエラーを表示する', async () => {
    vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ can_manage: true }))
    vi.mocked(api.deleteChannel).mockRejectedValue(new ApiError(403, '権限がありません。'))
    window.confirm = vi.fn().mockReturnValue(true)
    renderDetail()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '削除' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('権限がありません。')
  })
})
