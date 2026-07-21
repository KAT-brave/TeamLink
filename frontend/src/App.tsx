import { Routes, Route } from 'react-router-dom'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { Home } from './pages/Home'
import { Workspaces } from './pages/Workspaces'
import { WorkspaceDetail } from './pages/WorkspaceDetail'
import { ProtectedRoute } from './components/ProtectedRoute'

export default function App() {
  return (
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
    </Routes>
  )
}
