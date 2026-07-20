import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { ApiError } from '../api/client'

export function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setSubmitting(true)
    try {
      await signup({ name, email, password })
      navigate('/')
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setFieldErrors(err.errors)
        setError('入力内容を確認してください。')
      } else {
        setError(err instanceof ApiError ? err.message : '登録に失敗しました。')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>新規登録</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          表示名
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          パスワード(8文字以上)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {fieldErrors.email && <p>{fieldErrors.email.join(' ')}</p>}
        <button type="submit" disabled={submitting}>
          登録
        </button>
      </form>
      <p>
        すでにアカウントがある場合は <Link to="/login">ログイン</Link>
      </p>
    </div>
  )
}
