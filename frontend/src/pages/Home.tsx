import { useAuth } from '../store/auth'

// 認証確認用の保護画面(プレースホルダ)。本格的なチャットUIは後続PRで実装。
export function Home() {
  const { user, logout } = useAuth()
  return (
    <div>
      <h1>TeamLink</h1>
      <p>ようこそ、{user?.name} さん</p>
      <button onClick={() => logout()}>ログアウト</button>
    </div>
  )
}
