import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Channels } from '../Channels'
import * as api from '../../api/channels'
import type { Channel } from '../../api/channels'
import { ApiError } from '../../api/client'

vi.mock('../../api/channels')

function makeChannel(over: Partial<Channel> = {}): Channel {
  return {
    id: 1,
    workspace_id: 10,
    name: 'general',
    description: null,
    kind: 'public',
    created_by_id: 1,
    joined: false,
    can_manage: false,
    ...over,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/workspaces/10/channels']}>
      <Routes>
        <Route path="/workspaces/:workspaceId/channels" element={<Channels />} />
        <Route
          path="/workspaces/:workspaceId/channels/:channelId"
          element={<div>チャンネル詳細画面</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listChannels).mockResolvedValue([])
})

describe('Channels', () => {
  it('ローディング中はローディング表示', () => {
    vi.mocked(api.listChannels).mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('チャンネル一覧を公開/非公開バッジ付きで表示する', async () => {
    vi.mocked(api.listChannels).mockResolvedValue([
      makeChannel({ id: 1, name: 'general', kind: 'public', joined: true }),
      makeChannel({ id: 2, name: 'secret', kind: 'private', joined: true }),
    ])
    renderPage()
    expect(await screen.findByText('general')).toBeInTheDocument()
    expect(screen.getByText('secret')).toBeInTheDocument()
    // バッジは各チャンネルの行(li)内で判別できる
    expect(screen.getByText('general').closest('li')).toHaveTextContent('公開')
    expect(screen.getByText('secret').closest('li')).toHaveTextContent('非公開')
  })

  it('0件のときは空表示', async () => {
    renderPage()
    expect(await screen.findByText('チャンネルがありません。')).toBeInTheDocument()
  })

  it('取得失敗時はエラー表示', async () => {
    vi.mocked(api.listChannels).mockRejectedValue(new ApiError(500, '取得に失敗しました。'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('取得に失敗しました。')
  })

  it('作成成功で詳細画面へ遷移する', async () => {
    vi.mocked(api.createChannel).mockResolvedValue(makeChannel({ id: 5, name: 'new-ch' }))
    renderPage()
    await screen.findByText('チャンネルがありません。')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('チャンネル名'), 'new-ch')
    await user.click(screen.getByRole('button', { name: '作成' }))
    expect(await screen.findByText('チャンネル詳細画面')).toBeInTheDocument()
    expect(api.createChannel).toHaveBeenCalledWith(10, {
      name: 'new-ch',
      description: undefined,
      kind: 'public',
    })
  })

  it('作成時のバリデーションエラー(422)を表示する', async () => {
    vi.mocked(api.createChannel).mockRejectedValue(new ApiError(422, 'チャンネル名は既に使用されています。'))
    renderPage()
    await screen.findByText('チャンネルがありません。')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('チャンネル名'), 'dup')
    await user.click(screen.getByRole('button', { name: '作成' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('チャンネル名は既に使用されています。')
  })

  it('公開の未参加チャンネルに参加ボタンを表示し、参加で一覧更新する', async () => {
    vi.mocked(api.listChannels)
      .mockResolvedValueOnce([makeChannel({ id: 1, name: 'general', kind: 'public', joined: false })])
      .mockResolvedValueOnce([makeChannel({ id: 1, name: 'general', kind: 'public', joined: true })])
    vi.mocked(api.joinChannel).mockResolvedValue(undefined)
    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '参加' }))
    expect(api.joinChannel).toHaveBeenCalledWith(10, 1)
    expect(await screen.findByText('✓ 参加済み')).toBeInTheDocument()
  })

  it('参加済みチャンネルには参加ボタンを表示しない', async () => {
    vi.mocked(api.listChannels).mockResolvedValue([
      makeChannel({ id: 1, name: 'general', kind: 'public', joined: true }),
    ])
    renderPage()
    await screen.findByText('general')
    expect(screen.queryByRole('button', { name: '参加' })).not.toBeInTheDocument()
  })

  it('非公開チャンネルには参加ボタンを表示しない', async () => {
    vi.mocked(api.listChannels).mockResolvedValue([
      makeChannel({ id: 2, name: 'secret', kind: 'private', joined: true }),
    ])
    renderPage()
    await screen.findByText('secret')
    expect(screen.queryByRole('button', { name: '参加' })).not.toBeInTheDocument()
  })
})
