import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import * as api from '../api/channels'
import type { Channel, ChannelKind } from '../api/channels'
import * as searchApi from '../api/messageSearches'
import type { MessageSearchResult } from '../api/messageSearches'
import { ApiError } from '../api/client'

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// チャンネル一覧 + 作成 + 公開チャンネルへの参加 + メッセージ検索
export function Channels() {
  const { workspaceId: workspaceIdParam } = useParams<{ workspaceId: string }>()
  const workspaceId = Number(workspaceIdParam)
  const navigate = useNavigate()

  const [channels, setChannels] = useState<Channel[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<ChannelKind>('public')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [joiningId, setJoiningId] = useState<number | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MessageSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  async function reload() {
    setChannels(await api.listChannels(workspaceId))
  }

  useEffect(() => {
    setLoading(true)
    reload()
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'チャンネルの取得に失敗しました。'),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (submitting) return
    setSubmitting(true)
    try {
      const channel = await api.createChannel(workspaceId, {
        name: name.trim(),
        description: description.trim() ? description.trim() : undefined,
        kind,
      })
      navigate(`/workspaces/${workspaceId}/channels/${channel.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'チャンネルの作成に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleJoin(channelId: number) {
    setError(null)
    if (joiningId) return
    setJoiningId(channelId)
    try {
      await api.joinChannel(workspaceId, channelId)
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'チャンネルへの参加に失敗しました。')
    } finally {
      setJoiningId(null)
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    setSearchError(null)
    const trimmed = searchQuery.trim()

    if (!trimmed) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    if (searching) return
    setSearching(true)
    try {
      const data = await searchApi.searchMessages(workspaceId, trimmed)
      setSearchResults(data.messages)
      setHasSearched(true)
    } catch (err) {
      setSearchResults([])
      setSearchError(err instanceof ApiError ? err.message : 'メッセージの検索に失敗しました。')
    } finally {
      setSearching(false)
    }
  }

  if (loading) return <p>読み込み中...</p>

  return (
    <div>
      <h1>チャンネル</h1>
      <p>
        <Link to={`/workspaces/${workspaceId}`}>ワークスペースへ戻る</Link>
      </p>
      {error && <p role="alert">{error}</p>}

      <section className="search-section">
        <h2>メッセージ検索</h2>
        <form onSubmit={handleSearch}>
          <label>
            検索語
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="メッセージを検索"
            />
          </label>
          <button type="submit" disabled={searching}>
            検索
          </button>
        </form>

        {searching && <p>検索中...</p>}
        {searchError && <p role="alert">{searchError}</p>}

        {!searching && !searchError && hasSearched && (
          <div className="search-results">
            <p>検索結果：{searchResults.length}件</p>
            {searchResults.length === 0 ? (
              <p>該当するメッセージはありません。</p>
            ) : (
              <ul>
                {searchResults.map((m) => (
                  <li key={m.id} className="search-result-item">
                    <Link to={`/workspaces/${workspaceId}/channels/${m.channel.id}`}>
                      <div className="search-result-header">
                        <span className="search-result-channel">#{m.channel.name}</span>
                        <strong>{m.user.name}</strong>
                        <span className="message-date">{formatDate(m.created_at)}</span>
                        {m.is_edited && <span className="message-edited">（編集済み）</span>}
                      </div>
                      <div className="message-body">{m.body}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {channels.length === 0 ? (
        <p>チャンネルがありません。</p>
      ) : (
        <ul>
          {channels.map((c) => (
            <li key={c.id}>
              <Link to={`/workspaces/${workspaceId}/channels/${c.id}`}>{c.name}</Link>
              <span className="channel-badge" data-kind={c.kind}>
                {c.kind === 'private' ? '非公開' : '公開'}
              </span>
              {c.unread_count > 0 && (
                <span className="channel-unread-badge">
                  {c.unread_count > 99 ? '99+' : c.unread_count}
                </span>
              )}
              {c.description && <span> — {c.description}</span>}
              {c.joined ? (
                <span> ✓ 参加済み</span>
              ) : (
                c.kind === 'public' && (
                  <button onClick={() => handleJoin(c.id)} disabled={joiningId === c.id}>
                    参加
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2>チャンネルを作成</h2>
        <form onSubmit={handleCreate}>
          <label>
            チャンネル名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label>
            説明
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </label>
          <fieldset>
            <legend>公開範囲</legend>
            <label>
              <input
                type="radio"
                name="kind"
                value="public"
                checked={kind === 'public'}
                onChange={() => setKind('public')}
              />
              公開
            </label>
            <label>
              <input
                type="radio"
                name="kind"
                value="private"
                checked={kind === 'private'}
                onChange={() => setKind('private')}
              />
              非公開
            </label>
          </fieldset>
          <button type="submit" disabled={submitting}>
            作成
          </button>
        </form>
      </section>
    </div>
  )
}
