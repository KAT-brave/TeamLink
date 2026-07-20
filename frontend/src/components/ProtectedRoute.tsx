import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../store/auth'

// 未ログインなら /login へリダイレクト。権限判定の正はバックエンド側にある。
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p>読み込み中...</p>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
