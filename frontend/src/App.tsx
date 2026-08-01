import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Home } from './pages/Home'
import { Workspaces } from './pages/Workspaces'
import { WorkspaceDetail } from './pages/WorkspaceDetail'
import { Channels } from './pages/Channels'
import { ChannelDetail } from './pages/ChannelDetail'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './store/auth'

export default function App() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  const showHeader = Boolean(user) && !isAuthPage

  return (
    <div className="app">
      {showHeader && (
        <header className="app-header">
          <Link to="/" className="app-brand">
            TeamLink
          </Link>
          <span className="app-header-spacer" />
          <span className="app-user">{user?.name}</span>
          <button type="button" className="btn-text" onClick={() => logout()}>
            ログアウト
          </button>
        </header>
      )}
      <main className={isAuthPage ? 'app-main app-main--auth' : 'app-main'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces"
            element={
              <ProtectedRoute>
                <Workspaces />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces/:id"
            element={
              <ProtectedRoute>
                <WorkspaceDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces/:workspaceId/channels"
            element={
              <ProtectedRoute>
                <Channels />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspaces/:workspaceId/channels/:channelId"
            element={
              <ProtectedRoute>
                <ChannelDetail />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
