import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { ChannelDetail } from '../ChannelDetail'
import * as api from '../../api/channels'
import type { Channel } from '../../api/channels'
import * as readStatusApi from '../../api/channelReadStatuses'
import * as messageApi from '../../api/messages'
import type { Message } from '../../api/messages'
import * as wsApi from '../../api/workspaces'
import * as authStore from '../../store/auth'
import * as cableApi from '../../api/cable'
import { ApiError } from '../../api/client'

vi.mock('../../api/channels')
vi.mock('../../api/channelReadStatuses')
vi.mock('../../api/messages')
vi.mock('../../api/workspaces')
vi.mock('../../store/auth')
vi.mock('../../api/cable')

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
    unread_count: 0,
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
  vi.mocked(readStatusApi.updateChannelReadStatus).mockResolvedValue({
    read_status: { channel_id: 3, last_read_message_id: null, unread_count: 0 },
  })
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

  describe('既読更新', () => {
    it('メッセージ一覧取得成功後に既読更新APIを呼ぶ', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Hello' }),
      ])
      renderDetail()
      await screen.findByText('Hello')
      expect(readStatusApi.updateChannelReadStatus).toHaveBeenCalledWith(10, 3)
    })

    it('メッセージ取得失敗時は既読更新APIを呼ばない', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockRejectedValue(
        new ApiError(500, '取得に失敗しました。'),
      )
      renderDetail()
      await screen.findByText('取得に失敗しました。')
      expect(readStatusApi.updateChannelReadStatus).not.toHaveBeenCalled()
    })

    it('既読更新API失敗でも取得済みメッセージを表示する', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Hello' }),
      ])
      vi.mocked(readStatusApi.updateChannelReadStatus).mockRejectedValue(
        new ApiError(500, '既読更新に失敗しました。'),
      )
      renderDetail()
      expect(await screen.findByText('Hello')).toBeInTheDocument()
    })

    it('既読更新API失敗でも投稿フォームを使用できる', async () => {
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(readStatusApi.updateChannelReadStatus).mockRejectedValue(
        new ApiError(500, '既読更新に失敗しました。'),
      )
      renderDetail()
      const textarea = await screen.findByPlaceholderText('メッセージを入力...')
      expect(textarea).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
    })
  })

  describe('WebSocket既読更新', () => {
    it('他人のmessage_created受信時に既読更新APIを呼ぶ', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 200,
          body: 'From Bob',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      })

      await screen.findByText('From Bob')
      const callsAfter = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls
      expect(callsAfter.length).toBeGreaterThan(callsBefore)
      expect(callsAfter[callsAfter.length - 1]).toEqual([10, 3])
    })

    it('自分のmessage_created受信時は既読更新APIを呼ばない', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({ id: 201, body: 'My own message', user: CURRENT_USER }),
        channel_id: 3,
      })

      await screen.findByText('My own message')
      expect(vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length).toBe(callsBefore)
    })

    it('別チャンネルのmessage_createdイベントでは既読更新APIを呼ばない', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 202,
          body: 'Other channel message',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 999,
      })

      expect(vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length).toBe(callsBefore)
    })

    it('message_updatedイベントでは既読更新APIを呼ばない', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Old content' }),
      ])

      renderDetail()
      await screen.findByText('Old content')
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      receivedHandler!({
        type: 'message_updated',
        message: makeMessage({ id: 100, body: 'Updated content' }),
        channel_id: 3,
      })

      await screen.findByText('Updated content')
      expect(vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length).toBe(callsBefore)
    })

    it('message_deletedイベントでは既読更新APIを呼ばない', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Message 1' }),
      ])

      renderDetail()
      await screen.findByText('Message 1')
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      receivedHandler!({
        type: 'message_deleted',
        message_id: 100,
        channel_id: 3,
      })

      await waitFor(() => {
        expect(screen.queryByText('Message 1')).not.toBeInTheDocument()
      })
      expect(vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length).toBe(callsBefore)
    })

    it('不正イベントでは既読更新APIを呼ばない', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      receivedHandler!({ type: 'unknown_event', foo: 'bar' })

      expect(vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length).toBe(callsBefore)
    })

    it('既読更新API失敗でもメッセージを表示する', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])
      vi.mocked(readStatusApi.updateChannelReadStatus).mockRejectedValue(
        new ApiError(500, '既読更新に失敗しました。'),
      )

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 203,
          body: 'From Bob despite error',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      })

      expect(await screen.findByText('From Bob despite error')).toBeInTheDocument()
    })

    it('既読更新API失敗でも投稿フォームを利用できる', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(messageApi.getMessages).mockResolvedValue([])
      vi.mocked(readStatusApi.updateChannelReadStatus).mockRejectedValue(
        new ApiError(500, '既読更新に失敗しました。'),
      )

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 204,
          body: 'From Bob',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      })

      await screen.findByText('From Bob')
      expect(screen.getByPlaceholderText('メッセージを入力...')).toBeEnabled()
      expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
    })

    it('StrictModeでのupdater再評価でも既読更新APIは1回だけ(purity確認)', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      // StrictModeはdevモードでstate updater関数を意図的に2回呼び出し、
      // 副作用混入(不純なupdater)を検出しやすくする。
      // markAsReadをupdater外で呼ぶ実装であれば、再評価されても呼び出しは1回のままになる。
      render(
        <StrictMode>
          <MemoryRouter initialEntries={['/workspaces/10/channels/3']}>
            <Routes>
              <Route path="/workspaces/:workspaceId/channels/:channelId" element={<ChannelDetail />} />
            </Routes>
          </MemoryRouter>
        </StrictMode>,
      )
      await screen.findByRole('heading', { name: 'general' })
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 300,
          body: 'Purity check message',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      })

      await screen.findByText('Purity check message')
      const callsAfter = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length
      expect(callsAfter - callsBefore).toBe(1)
    })

    it('同じmessage_createdイベントを2回受信しても既読更新APIは1回だけ', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })
      const callsBefore = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      const event = {
        type: 'message_created',
        message: makeMessage({
          id: 301,
          body: 'Duplicate event message',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      }
      receivedHandler!(event)
      receivedHandler!(event)

      await screen.findByText('Duplicate event message')
      const callsAfter = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length
      expect(callsAfter - callsBefore).toBe(1)
    })

    it('同じmessage_createdイベントを2回受信してもメッセージは1件だけ表示される', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      const event = {
        type: 'message_created',
        message: makeMessage({
          id: 302,
          body: 'No duplicate display',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      }
      receivedHandler!(event)
      receivedHandler!(event)

      await screen.findByText('No duplicate display')
      expect(screen.getAllByText('No duplicate display')).toHaveLength(1)
    })

    it('同じIDで内容が変わったイベントは一覧内容を同期する', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 303,
          body: 'First content',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      })
      await screen.findByText('First content')

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 303,
          body: 'Synced content',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      })

      await screen.findByText('Synced content')
      expect(screen.queryByText('First content')).not.toBeInTheDocument()
    })

    it('channelId変更時に処理済みIDがリセットされ、別チャンネルの同一ID受信でも既読更新される', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockImplementation((_workspaceId, chId) =>
        Promise.resolve(
          chId === 3 ? makeChannel({ id: 3, name: 'general' }) : makeChannel({ id: 4, name: 'random' }),
        ),
      )
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      // 同一Router内でchannelIdだけを切り替えるため、テスト用のナビゲーションリンクを併設する
      render(
        <MemoryRouter initialEntries={['/workspaces/10/channels/3']}>
          <Link to="/workspaces/10/channels/4">Switch to channel B</Link>
          <Routes>
            <Route path="/workspaces/:workspaceId/channels/:channelId" element={<ChannelDetail />} />
          </Routes>
        </MemoryRouter>,
      )
      await screen.findByRole('heading', { name: 'general' })

      // チャンネルA(id=3)でID=400を処理済みにする
      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 400,
          body: 'Channel A message',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 3,
      })
      await screen.findByText('Channel A message')
      const callsAfterChannelA = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      // チャンネルB(id=4)へ切り替え(同一コンポーネントインスタンス内でのchannelId変更)
      const user = userEvent.setup()
      await user.click(screen.getByText('Switch to channel B'))
      await screen.findByRole('heading', { name: 'random' })

      // チャンネルBで同じ数値ID=400のイベントを受信しても正しく既読更新される
      receivedHandler!({
        type: 'message_created',
        message: makeMessage({
          id: 400,
          body: 'Channel B message',
          user: { id: 2, name: 'Bob', email: 'b@example.com' },
        }),
        channel_id: 4,
      })
      await screen.findByText('Channel B message')
      const callsAfterChannelB = vi.mocked(readStatusApi.updateChannelReadStatus).mock.calls.length

      expect(callsAfterChannelB).toBeGreaterThan(callsAfterChannelA)
    })
  })

  describe('WebSocket購読', () => {
    it('ChannelDetail表示時にMessageChannelを購読する', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      vi.mocked(cableApi.subscribeToMessages).mockReturnValue(mockSubscription as any)
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      expect(cableApi.subscribeToMessages).toHaveBeenCalledWith(
        { channel: 'MessageChannel', channel_id: 3 },
        expect.objectContaining({ received: expect.any(Function) }),
      )
    })

    it('unmount時にunsubscribeする', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      vi.mocked(cableApi.subscribeToMessages).mockReturnValue(mockSubscription as any)
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())

      const { unmount } = render(
        <MemoryRouter initialEntries={['/workspaces/10/channels/3']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/channels/:channelId" element={<ChannelDetail />} />
          </Routes>
        </MemoryRouter>,
      )
      await screen.findByRole('heading', { name: 'general' })
      unmount()
      expect(mockSubscription.unsubscribe).toHaveBeenCalled()
    })

    it('cleanup時に購読を完全に解除する', async () => {
      const mockSub = { unsubscribe: vi.fn() }
      vi.mocked(cableApi.subscribeToMessages).mockReturnValue(mockSub as any)
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())

      const { unmount } = render(
        <MemoryRouter initialEntries={['/workspaces/10/channels/3']}>
          <Routes>
            <Route path="/workspaces/:workspaceId/channels/:channelId" element={<ChannelDetail />} />
          </Routes>
        </MemoryRouter>,
      )
      await screen.findByRole('heading', { name: 'general' })
      expect(cableApi.subscribeToMessages).toHaveBeenCalledTimes(1)

      unmount()
      expect(mockSub.unsubscribe).toHaveBeenCalledTimes(1)
    })

    it('message_createdイベント受信時に対象channelIdのメッセージを追加', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Existing' }),
      ])

      renderDetail()
      await screen.findByText('Existing')

      const newMessage = makeMessage({
        id: 101,
        body: 'New message',
        user: { id: 2, name: 'Bob', email: 'b@example.com' },
      })
      receivedHandler!({
        type: 'message_created',
        message: newMessage,
        channel_id: 3,
      })

      expect(await screen.findByText('New message')).toBeInTheDocument()
    })

    it('message_createdイベント受信時に対象外channelIdは無視', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Existing' }),
      ])

      renderDetail()
      await screen.findByText('Existing')

      receivedHandler!({
        type: 'message_created',
        message: makeMessage({ id: 101, body: 'Other channel' }),
        channel_id: 999,
      })

      expect(screen.queryByText('Other channel')).not.toBeInTheDocument()
    })

    it('message_createdイベント受信時に受信者本人なら can_edit、can_deleteは付与される', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      const newMessage = makeMessage({
        id: 101,
        body: 'My message',
        user: CURRENT_USER,
        can_edit: false,
        can_delete: false,
      })
      receivedHandler!({
        type: 'message_created',
        message: newMessage,
        channel_id: 3,
      })

      await waitFor(() => {
        expect(screen.getByText('My message')).toBeInTheDocument()
      })
    })

    it('message_createdイベント受信時に他人なら can_edit、can_deleteは false', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      const newMessage = makeMessage({
        id: 101,
        body: 'Others message',
        user: { id: 2, name: 'Bob', email: 'b@example.com' },
        can_edit: false,
        can_delete: false,
      })
      receivedHandler!({
        type: 'message_created',
        message: newMessage,
        channel_id: 3,
      })

      await waitFor(() => {
        expect(screen.getByText('Others message')).toBeInTheDocument()
      })
    })

    it('message_updatedイベント受信時に対象メッセージだけ更新', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Old content' }),
        makeMessage({ id: 101, body: 'Other message' }),
      ])

      renderDetail()
      await screen.findByText('Old content')

      receivedHandler!({
        type: 'message_updated',
        message: makeMessage({ id: 100, body: 'Updated content' }),
        channel_id: 3,
      })

      await waitFor(() => {
        expect(screen.queryByText('Old content')).not.toBeInTheDocument()
        expect(screen.getByText('Updated content')).toBeInTheDocument()
        expect(screen.getByText('Other message')).toBeInTheDocument()
      })
    })

    it('message_deletedイベント受信時に対象メッセージだけ削除', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Message 1' }),
        makeMessage({ id: 101, body: 'Message 2' }),
      ])

      renderDetail()
      await screen.findByText('Message 1')

      receivedHandler!({
        type: 'message_deleted',
        message_id: 100,
        channel_id: 3,
      })

      await waitFor(() => {
        expect(screen.queryByText('Message 1')).not.toBeInTheDocument()
        expect(screen.getByText('Message 2')).toBeInTheDocument()
      })
    })

    it('message_deletedイベント受信時に対象外channelIdは無視', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel())
      vi.mocked(messageApi.getMessages).mockResolvedValue([
        makeMessage({ id: 100, body: 'Keep this' }),
      ])

      renderDetail()
      await screen.findByText('Keep this')

      receivedHandler!({
        type: 'message_deleted',
        message_id: 100,
        channel_id: 999,
      })

      expect(screen.getByText('Keep this')).toBeInTheDocument()
    })

    it('HTTPレスポンスとbroadcast両方受信しても重複しない', async () => {
      const mockSubscription = { unsubscribe: vi.fn() }
      let receivedHandler: Function
      vi.mocked(cableApi.subscribeToMessages).mockImplementation((_params, handlers) => {
        receivedHandler = handlers.received!
        return mockSubscription as any
      })
      vi.mocked(api.getChannel).mockResolvedValue(makeChannel({ joined: true }))
      vi.mocked(messageApi.getMessages).mockResolvedValue([])

      renderDetail()
      await screen.findByRole('heading', { name: 'general' })

      const newMsg = makeMessage({ id: 101, body: 'Test' })
      vi.mocked(messageApi.createMessage).mockResolvedValue(newMsg)

      const user = userEvent.setup()
      const textarea = screen.getByPlaceholderText('メッセージを入力...')
      await user.type(textarea, 'Test')
      await user.click(screen.getByRole('button', { name: '送信' }))

      // HTTPレスポンスで追加
      expect(await screen.findByText('Test')).toBeInTheDocument()

      // 同じIDでbroadcast受信
      receivedHandler!({
        type: 'message_created',
        message: newMsg,
        channel_id: 3,
      })

      // 重複しないことを確認
      const allTestMessages = screen.getAllByText('Test')
      expect(allTestMessages.length).toBe(1)
    })
  })
})
