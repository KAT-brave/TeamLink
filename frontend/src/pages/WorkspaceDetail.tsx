import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as api from '../api/workspaces'
import type { Member, Role, Workspace } from '../api/workspaces'
import { useAuth } from '../store/auth'
import { ApiError } from '../api/client'

// ワークスペース詳細。権限に応じて編集/招待コード/メンバー削除UIを出し分ける。
// (表示制御はUX目的。権限判定の正はバックエンド)
export function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>()
  const workspaceId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isManager = role === 'owner' || role === 'admin'

  async function load() {
    try {
      const { workspace: ws, role: r } = await api.getWorkspace(workspaceId)
      setWorkspace(ws)
      setRole(r)
      setNameInput(ws.name)
      setMembers(await api.listMembers(workspaceId))
      if (r === 'owner' || r === 'admin') {
        setInviteCode(await api.getInviteCode(workspaceId))
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '読み込みに失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  async function handleRename(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const ws = await api.updateWorkspace(workspaceId, nameInput)
      setWorkspace(ws)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '更新に失敗しました。')
    }
  }

  async function handleRegenerate() {
    setInviteCode(await api.regenerateInviteCode(workspaceId))
  }

  async function handleLeave() {
    setError(null)
    try {
      await api.leaveWorkspace(workspaceId)
      navigate('/workspaces')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '退出に失敗しました。')
    }
  }

  async function handleRemove(userId: number) {
    setError(null)
    try {
      await api.removeMember(workspaceId, userId)
      setMembers(await api.listMembers(workspaceId))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '削除に失敗しました。')
    }
  }

  if (loading) return <p>読み込み中...</p>
  if (!workspace) return <p role="alert">{error ?? 'ワークスペースが見つかりません。'}</p>

  return (
    <div>
      <h1>{workspace.name}</h1>
      {error && <p role="alert">{error}</p>}

      {isManager && (
        <form onSubmit={handleRename}>
          <label>
            ワークスペース名
            <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
          </label>
          <button type="submit">名前を更新</button>
        </form>
      )}

      {isManager && (
        <section>
          <h2>招待コード</h2>
          <p aria-label="招待コード">{inviteCode}</p>
          <button onClick={handleRegenerate}>再発行</button>
        </section>
      )}

      <section>
        <h2>メンバー</h2>
        <ul>
          {members.map((m) => (
            <li key={m.id}>
              {m.user.name}（{m.role}）
              {isManager && m.role !== 'owner' && m.user.id !== user?.id && (
                <button onClick={() => handleRemove(m.user.id)}>削除</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {role !== 'owner' && <button onClick={handleLeave}>退出する</button>}
    </div>
  )
}
