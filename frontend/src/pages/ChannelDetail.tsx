import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import * as api from '../api/channels'
import type { Channel, ChannelMember } from '../api/channels'
import * as messageApi from '../api/messages'
import type { Message } from '../api/messages'
import { listMembers as listWorkspaceMembers } from '../api/workspaces'
import type { Member as WorkspaceMember } from '../api/workspaces'
import { useAuth } from '../store/auth'
import { ApiError } from '../api/client'

// チャンネル詳細。編集/参加/退出/招待/削除を権限に応じて出し分ける。
// (表示制御はUX目的。権限判定の正はバックエンド)
export function ChannelDetail() {
  const { workspaceId: wsParam, channelId: chParam } = useParams<{
    workspaceId: string
    channelId: string
  }>()
  const workspaceId = Number(wsParam)
  const channelId = Number(chParam)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [channel, setChannel] = useState<Channel | null>(null)
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [candidates, setCandidates] = useState<WorkspaceMember[]>([])
  const [nameInput, setNameInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [inviteUserId, setInviteUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [messageLoading, setMessageLoading] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [messageBody, setMessageBody] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')
  const [messageSubmitting, setMessageSubmitting] = useState(false)

  async function loadCandidates(ch: Channel, currentMembers: ChannelMember[]) {
    if (ch.kind !== 'private' || !ch.can_manage) {
      setCandidates([])
      return
    }
    const wsMembers = await listWorkspaceMembers(workspaceId)
    const memberIds = new Set(currentMembers.map((m) => m.user.id))
    setCandidates(wsMembers.filter((m) => !memberIds.has(m.user.id) && m.user.id !== user?.id))
  }

  async function loadMessages() {
    setMessageLoading(true)
    setMessageError(null)
    try {
      const msgs = await messageApi.getMessages(workspaceId, channelId)
      setMessages(msgs)
    } catch (err) {
      setMessageError(err instanceof ApiError ? err.message : 'メッセージ読み込みに失敗しました。')
    } finally {
      setMessageLoading(false)
    }
  }

  async function load() {
    setLoading(true)
    setNotFound(false)
    try {
      const ch = await api.getChannel(workspaceId, channelId)
      setChannel(ch)
      setNameInput(ch.name)
      setDescInput(ch.description ?? '')
      const mem = await api.listChannelMembers(workspaceId, channelId)
      setMembers(mem)
      await loadCandidates(ch, mem)
      await loadMessages()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true)
      } else {
        setError(err instanceof ApiError ? err.message : '読み込みに失敗しました。')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, channelId])

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (submitting) return
    setSubmitting(true)
    try {
      const ch = await api.updateChannel(workspaceId, channelId, {
        name: nameInput.trim(),
        description: descInput.trim(),
      })
      setChannel(ch)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoin() {
    setError(null)
    if (submitting) return
    setSubmitting(true)
    try {
      await api.joinChannel(workspaceId, channelId)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '参加に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLeave() {
    setError(null)
    if (submitting) return
    setSubmitting(true)
    try {
      await api.leaveChannel(workspaceId, channelId)
      // 非公開は退出後に閲覧不可となるため、一覧へ戻る。
      navigate(`/workspaces/${workspaceId}/channels`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '退出に失敗しました。')
      setSubmitting(false)
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (submitting || !inviteUserId) return
    setSubmitting(true)
    try {
      await api.inviteChannelMember(workspaceId, channelId, Number(inviteUserId))
      setInviteUserId('')
      const mem = await api.listChannelMembers(workspaceId, channelId)
      setMembers(mem)
      if (channel) await loadCandidates(channel, mem)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '招待に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setError(null)
    if (!window.confirm('このチャンネルを削除しますか？')) return
    if (submitting) return
    setSubmitting(true)
    try {
      await api.deleteChannel(workspaceId, channelId)
      navigate(`/workspaces/${workspaceId}/channels`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました。')
      setSubmitting(false)
    }
  }

  async function handleCreateMessage(e: FormEvent) {
    e.preventDefault()
    setMessageError(null)
    if (!channel?.joined) return
    if (messageSubmitting) return
    const trimmedBody = messageBody.trim()
    if (trimmedBody.length === 0) return

    setMessageSubmitting(true)
    try {
      const newMessage = await messageApi.createMessage(workspaceId, channelId, messageBody)
      setMessages((currentMessages) => {
        if (currentMessages.some((message) => message.id === newMessage.id)) {
          return currentMessages
        }
        return [...currentMessages, newMessage]
      })
      setMessageBody('')
    } catch (err) {
      setMessageError(err instanceof ApiError ? err.message : 'メッセージ投稿に失敗しました。')
    } finally {
      setMessageSubmitting(false)
    }
  }

  async function handleUpdateMessage(messageId: number, e: FormEvent) {
    e.preventDefault()
    setMessageError(null)
    if (messageSubmitting) return
    const trimmedBody = editBody.trim()
    if (trimmedBody.length === 0) return

    setMessageSubmitting(true)
    try {
      const updatedMessage = await messageApi.updateMessage(workspaceId, channelId, messageId, editBody)
      setMessages((currentMessages) =>
        currentMessages.map((m) => (m.id === messageId ? updatedMessage : m))
      )
      setEditingId(null)
      setEditBody('')
    } catch (err) {
      setMessageError(err instanceof ApiError ? err.message : 'メッセージ編集に失敗しました。')
    } finally {
      setMessageSubmitting(false)
    }
  }

  async function handleDeleteMessage(messageId: number) {
    setMessageError(null)
    if (!window.confirm('このメッセージを削除しますか？')) return
    if (messageSubmitting) return

    setMessageSubmitting(true)
    try {
      await messageApi.deleteMessage(workspaceId, channelId, messageId)
      setMessages((currentMessages) =>
        currentMessages.filter((m) => m.id !== messageId)
      )
    } catch (err) {
      setMessageError(err instanceof ApiError ? err.message : 'メッセージ削除に失敗しました。')
    } finally {
      setMessageSubmitting(false)
    }
  }

  if (loading) return <p>読み込み中...</p>
  if (notFound) {
    return <p role="alert">チャンネルが存在しない、または閲覧権限がありません。</p>
  }
  if (!channel) return <p role="alert">{error ?? 'チャンネルが見つかりません。'}</p>

  const creator = members.find((m) => m.user.id === channel.created_by_id)
  const canLeave = channel.joined && channel.created_by_id !== user?.id
  const canJoin = channel.kind === 'public' && !channel.joined

  return (
    <div>
      <p>
        <Link to={`/workspaces/${workspaceId}/channels`}>チャンネル一覧へ戻る</Link>
      </p>
      <h1>{channel.name}</h1>
      <p>
        <span className="channel-badge" data-kind={channel.kind}>
          {channel.kind === 'private' ? '非公開' : '公開'}
        </span>
      </p>
      <p>{channel.description || '(説明なし)'}</p>
      <p>作成者: {creator ? creator.user.name : `ID:${channel.created_by_id}`}</p>
      <p>{channel.joined ? '参加中' : '未参加'}</p>
      {error && <p role="alert">{error}</p>}

      {canJoin && (
        <button onClick={handleJoin} disabled={submitting}>
          参加
        </button>
      )}
      {canLeave && (
        <button onClick={handleLeave} disabled={submitting}>
          退出する
        </button>
      )}

      {channel.can_manage && (
        <section>
          <h2>チャンネルを編集</h2>
          <form onSubmit={handleUpdate}>
            <label>
              チャンネル名
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                maxLength={80}
              />
            </label>
            <label>
              説明
              <textarea
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                maxLength={500}
              />
            </label>
            <button type="submit" disabled={submitting}>
              更新
            </button>
          </form>
        </section>
      )}

      <section>
        <h2>メンバー</h2>
        <ul>
          {members.map((m) => (
            <li key={m.id}>{m.user.name}</li>
          ))}
        </ul>
      </section>

      <section className="messages-section">
        <h2>メッセージ</h2>
        {messageError && <p role="alert" className="message-error">{messageError}</p>}
        {messageLoading ? (
          <p>メッセージを読み込み中...</p>
        ) : messages.length === 0 ? (
          <p className="no-messages">まだメッセージはありません。</p>
        ) : (
          <div className="messages-list">
            {messages.map((msg) => (
              <div key={msg.id} className="message-item">
                {editingId === msg.id ? (
                  <form onSubmit={(e) => handleUpdateMessage(msg.id, e)} className="edit-form">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      maxLength={5000}
                      rows={3}
                    />
                    <div className="form-actions">
                      <button type="submit" disabled={messageSubmitting}>
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditBody('')
                        }}
                        disabled={messageSubmitting}
                      >
                        キャンセル
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="message-header">
                      <strong>{msg.user.name}</strong>
                      <span className="message-date">
                        {new Date(msg.created_at).toLocaleString('ja-JP', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {msg.is_edited && <span className="message-edited">（編集済み）</span>}
                    </div>
                    <div className="message-body">{msg.body}</div>
                    <div className="message-actions">
                      {msg.can_edit && (
                        <button
                          onClick={() => {
                            setEditingId(msg.id)
                            setEditBody(msg.body)
                          }}
                          disabled={messageSubmitting}
                        >
                          編集
                        </button>
                      )}
                      {msg.can_delete && (
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={messageSubmitting}
                        >
                          削除
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {channel.joined && (
          <form onSubmit={handleCreateMessage} className="message-form">
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="メッセージを入力..."
              maxLength={5000}
              rows={3}
            />
            <button type="submit" disabled={messageSubmitting || messageBody.trim().length === 0}>
              送信
            </button>
          </form>
        )}
        {!channel.joined && (
          <p className="message-info">チャンネルに参加するとメッセージを投稿できます。</p>
        )}
      </section>

      {channel.kind === 'private' && channel.can_manage && (
        <section>
          <h2>メンバーを招待</h2>
          <form onSubmit={handleInvite}>
            <label>
              招待するユーザー
              <select value={inviteUserId} onChange={(e) => setInviteUserId(e.target.value)}>
                <option value="">選択してください</option>
                {candidates.map((c) => (
                  <option key={c.user.id} value={c.user.id}>
                    {c.user.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={submitting || !inviteUserId}>
              招待
            </button>
          </form>
        </section>
      )}

      {channel.can_manage && (
        <section>
          <h2>チャンネルを削除</h2>
          <button onClick={handleDelete} disabled={submitting}>
            削除
          </button>
        </section>
      )}
    </div>
  )
}
