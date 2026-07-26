import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ChannelDetail } from '../ChannelDetail'
import * as api from '../../api/channels'
import type { Channel } from '../../api/channels'
import * as messageApi from '../../api/messages'
import type { Message } from '../../api/messages'
import * as wsApi from '../../api/workspaces'
import * as authStore from '../../store/auth'
import { ApiError } from '../../api/client'

vi.mock('../../api/channels')
vi.mock('../../api/messages')
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

function makeMessage(over: Partial<Message> = {}): Message {
  return {
    id: 100,
    channel_id: 3,
    user: { id: 1, name: 'Alice', email: 'a@example.com' },
    body: 'Hello World',
    created_at: '2026-07-26T10:00:00Z',
    updated_at: '2026-07-26T10:00:00Z',
    is_edited: false,
    can_edit: true,
    can_delete: true,
    ...over,
  }
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
  vi.mocked(messageApi.getMessages).mockResolvedValue([])
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

  describe('メッセージ機能', () => {

    it('メッセージ0件時はメッセージなし表示を出す', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])
      renderDetail()
      expect(await screen.findByText('まだメッセージはありません。')).toBeInTheDocument()
    })

    it('メッセージを一覧表示する', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, user: { id: 1, name: 'Alice', email: 'a@example.com' }, body: 'Hello' }),
        makeMessage({ id: 101, user: { id: 2, name: 'Bob', email: 'b@example.com' }, body: 'World' }),
      ])
      renderDetail()
      expect(await screen.findByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('World')).toBeInTheDocument()
      const alices = screen.getAllByText('Alice')
      expect(alices.length).toBeGreaterThan(0)
      const bobs = screen.getAllByText('Bob')
      expect(bobs.length).toBeGreaterThan(0)
    })

    it('編集済みメッセージに編集済み表示をする', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ is_edited: true }),
      ])
      renderDetail()
      expect(await screen.findByText('（編集済み）')).toBeInTheDocument()
    })

    it('can_editがtrueの場合だけ編集ボタンを表示', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ can_edit: true }),
        makeMessage({ id: 101, can_edit: false }),
      ])
      renderDetail()
      const buttons = await screen.findAllByRole('button', { name: '編集' })
      expect(buttons).toHaveLength(1)
    })

    it('can_deleteがtrueの場合だけ削除ボタンを表示', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ can_manage: false, created_by_id: 2 }))
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, can_delete: true }),
        makeMessage({ id: 101, can_delete: false }),
      ])
      renderDetail()
      await screen.findByRole('heading', { name: 'general' })
      const buttons = screen.queryAllByRole('button', { name: '削除' })
      expect(buttons).toHaveLength(1)
    })

    it('参加中はメッセージフォームを表示', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      renderDetail()
      expect(await screen.findByPlaceholderText('メッセージを入力...')).toBeInTheDocument()
    })

    it('未参加はメッセージフォームを表示しない', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: false, can_manage: false, created_by_id: 2 }))
      renderDetail()
      await screen.findByRole('heading', { name: 'general' })
      expect(screen.queryByPlaceholderText('メッセージを入力...')).not.toBeInTheDocument()
      expect(screen.getByText('チャンネルに参加するとメッセージを投稿できます。')).toBeInTheDocument()
    })

    it('空白のみではメッセージ送信ボタンが無効', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      renderDetail()
      const textarea = await screen.findByPlaceholderText('メッセージを入力...')
      const button = screen.getByRole('button', { name: '送信' })
      expect(button).toBeDisabled()
      await userEvent.setup().type(textarea, '   ')
      expect(button).toBeDisabled()
    })

    it('メッセージを投稿する', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(messageApi.getMessages).mockResolvedValue([])
      vi.mocked(messageApi.createMessage).mockResolvedValue(
        makeMessage({ body: 'Test message' }),
      )
      renderDetail()
      const user = userEvent.setup()
      const textarea = await screen.findByPlaceholderText('メッセージを入力...')
      await user.type(textarea, 'Test message')
      await user.click(screen.getByRole('button', { name: '送信' }))
      expect(messageApi.createMessage).toHaveBeenCalledWith(10, 3, 'Test message')
      expect(await screen.findByText('Test message')).toBeInTheDocument()
    })

    it('メッセージ投稿成功後に入力欄をクリアする', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(messageApi.createMessage).mockResolvedValue(makeMessage())
      renderDetail()
      const user = userEvent.setup()
      const textarea = await screen.findByPlaceholderText('メッセージを入力...')
      await user.type(textarea, 'Test')
      await user.click(screen.getByRole('button', { name: '送信' }))
      await screen.findByText('Hello World')
      expect((textarea as HTMLTextAreaElement).value).toBe('')
    })

    it('編集ボタンをクリックで編集フォームを表示', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ body: 'Original text', can_edit: true }),
      ])
      renderDetail()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: '編集' }))
      const editTextarea = screen.getByDisplayValue('Original text')
      expect(editTextarea).toBeInTheDocument()
    })

    it('メッセージを編集して保存する', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ body: 'Original', can_edit: true }),
      ])
      vi.mocked(messageApi.updateMessage).mockResolvedValue(
        makeMessage({ body: 'Edited' }),
      )
      renderDetail()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: '編集' }))
      const editTextarea = screen.getByDisplayValue('Original')
      await user.clear(editTextarea)
      await user.type(editTextarea, 'Edited')
      await user.click(screen.getByRole('button', { name: '保存' }))
      expect(messageApi.updateMessage).toHaveBeenCalledWith(10, 3, 100, 'Edited')
      expect(await screen.findByText('Edited')).toBeInTheDocument()
    })

    it('削除確認でキャンセルするとAPIを呼ばない', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, can_delete: true, body: 'Message 1' }),
      ])
      window.confirm = vi.fn().mockReturnValue(false)
      renderDetail()
      const user = userEvent.setup()
      await screen.findByText('Message 1')
      const deleteBtn = screen.queryAllByRole('button', { name: '削除' }).find((btn) => {
        const parent = btn.closest('.message-item')
        return parent?.textContent?.includes('Message 1')
      })
      if (deleteBtn) await user.click(deleteBtn)
      expect(messageApi.deleteMessage).not.toHaveBeenCalled()
    })

    it('メッセージを削除する', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'To delete', can_delete: true }),
      ])
      vi.mocked(messageApi.deleteMessage).mockResolvedValue(undefined)
      window.confirm = vi.fn().mockReturnValue(true)
      renderDetail()
      const user = userEvent.setup()
      await screen.findByText('To delete')
      const deleteBtn = screen.queryAllByRole('button', { name: '削除' }).find((btn) => {
        const parent = btn.closest('.message-item')
        return parent?.textContent?.includes('To delete')
      })
      if (deleteBtn) await user.click(deleteBtn)
      expect(messageApi.deleteMessage).toHaveBeenCalledWith(10, 3, 100)
      expect(screen.queryByText('To delete')).not.toBeInTheDocument()
    })

    it('メッセージ操作エラーを表示する', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(messageApi.createMessage).mockRejectedValue(
        new ApiError(400, '無効なリクエストです。'),
      )
      renderDetail()
      const user = userEvent.setup()
      const textarea = await screen.findByPlaceholderText('メッセージを入力...')
      await user.type(textarea, 'Test')
      await user.click(screen.getByRole('button', { name: '送信' }))
      expect(await screen.findByText('無効なリクエストです。')).toBeInTheDocument()
    })

    it('投稿成功時に同じIDのメッセージは重複追加しない', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Existing message' }),
      ])
      vi.mocked(messageApi.createMessage).mockResolvedValue(
        makeMessage({ id: 100, body: 'Existing message' })
      )
      renderDetail()
      const user = userEvent.setup()
      const textarea = await screen.findByPlaceholderText('メッセージを入力...')
      await user.type(textarea, 'Existing message')
      await user.click(screen.getByRole('button', { name: '送信' }))
      await screen.findByText('Existing message')
      const allMessages = screen.getAllByText('Existing message')
      expect(allMessages.length).toBe(1)
    })

    it('投稿成功時に既存メッセージが消えない', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Message 1' }),
        makeMessage({ id: 101, body: 'Message 2' }),
      ])
      vi.mocked(messageApi.createMessage).mockResolvedValue(
        makeMessage({ id: 102, body: 'Message 3' })
      )
      renderDetail()
      const user = userEvent.setup()
      const textarea = await screen.findByPlaceholderText('メッセージを入力...')
      await user.type(textarea, 'Message 3')
      await user.click(screen.getByRole('button', { name: '送信' }))
      expect(await screen.findByText('Message 1')).toBeInTheDocument()
      expect(screen.getByText('Message 2')).toBeInTheDocument()
      expect(screen.getByText('Message 3')).toBeInTheDocument()
    })

    it('編集成功時に対象外のメッセージは保持される', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Message 1', can_edit: true }),
        makeMessage({ id: 101, body: 'Message 2', can_edit: false }),
      ])
      vi.mocked(messageApi.updateMessage).mockResolvedValue(
        makeMessage({ id: 100, body: 'Edited Message 1', can_edit: true })
      )
      renderDetail()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: '編集' }))
      const editTextarea = screen.getByDisplayValue('Message 1')
      await user.clear(editTextarea)
      await user.type(editTextarea, 'Edited Message 1')
      await user.click(screen.getByRole('button', { name: '保存' }))
      expect(await screen.findByText('Edited Message 1')).toBeInTheDocument()
      expect(screen.getByText('Message 2')).toBeInTheDocument()
    })

    it('編集成功時にメッセージ件数は変わらない', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Message 1', can_edit: true }),
        makeMessage({ id: 101, body: 'Message 2', can_edit: false }),
        makeMessage({ id: 102, body: 'Message 3', can_edit: false }),
      ])
      vi.mocked(messageApi.updateMessage).mockResolvedValue(
        makeMessage({ id: 100, body: 'Updated', can_edit: true })
      )
      renderDetail()
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: '編集' }))
      const editTextarea = screen.getByDisplayValue('Message 1')
      await user.clear(editTextarea)
      await user.type(editTextarea, 'Updated')
      await user.click(screen.getByRole('button', { name: '保存' }))
      await screen.findByText('Updated')
      expect(screen.getByText('Message 2')).toBeInTheDocument()
      expect(screen.getByText('Message 3')).toBeInTheDocument()
    })

    it('削除成功時に対象外のメッセージは保持される', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'To delete', can_delete: true }),
        makeMessage({ id: 101, body: 'To keep', can_delete: false }),
      ])
      vi.mocked(messageApi.deleteMessage).mockResolvedValue(undefined)
      window.confirm = vi.fn().mockReturnValue(true)
      renderDetail()
      const user = userEvent.setup()
      await screen.findByText('To delete')
      const deleteBtn = screen.queryAllByRole('button', { name: '削除' }).find((btn) => {
        const parent = btn.closest('.message-item')
        return parent?.textContent?.includes('To delete')
      })
      if (deleteBtn) await user.click(deleteBtn)
      expect(screen.queryByText('To delete')).not.toBeInTheDocument()
      expect(screen.getByText('To keep')).toBeInTheDocument()
    })

    it('削除成功時にメッセージ件数が1つだけ減る', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Message 1', can_delete: true }),
        makeMessage({ id: 101, body: 'Message 2', can_delete: false }),
        makeMessage({ id: 102, body: 'Message 3', can_delete: false }),
      ])
      vi.mocked(messageApi.deleteMessage).mockResolvedValue(undefined)
      window.confirm = vi.fn().mockReturnValue(true)
      renderDetail()
      const user = userEvent.setup()
      await screen.findByText('Message 1')
      const deleteBtn = screen.queryAllByRole('button', { name: '削除' }).find((btn) => {
        const parent = btn.closest('.message-item')
        return parent?.textContent?.includes('Message 1')
      })
      if (deleteBtn) await user.click(deleteBtn)
      expect(screen.queryByText('Message 1')).not.toBeInTheDocument()
      expect(screen.getByText('Message 2')).toBeInTheDocument()
      expect(screen.getByText('Message 3')).toBeInTheDocument()
    })
  })
})
