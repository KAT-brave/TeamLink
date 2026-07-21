import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api/workspaces'
import type { Workspace } from '../api/workspaces'
import { ApiError } from '../api/client'

// 所属ワークスペース一覧 + 新規作成 + 招待コードで参加
export function Workspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    setWorkspaces(await api.listWorkspaces())
    setLoading(false)
  }

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.createWorkspace(name)
      setName('')
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '作成に失敗しました。')
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.joinWorkspace(code)
      setCode('')
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '参加に失敗しました。')
    }
  }

  if (loading) return <p>読み込み中...</p>

  return (
    <div>
      <h1>ワークスペース</h1>
      {error && <p role="alert">{error}</p>}

      <ul>
        {workspaces.map((w) => (
          <li key={w.id}>
            <Link to={`/workspaces/${w.id}`}>{w.name}</Link>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate}>
        <label>
          ワークスペース名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button type="submit">作成</button>
      </form>

      <form onSubmit={handleJoin}>
        <label>
          招待コードで参加
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button type="submit">参加</button>
      </form>
    </div>
  )
}
