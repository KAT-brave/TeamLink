// バックエンドAPIの薄いラッパ。
// - credentials: 'include' で httpOnly セッションCookie を送受信
// - 変更系(POST/DELETE等)は CSRF トークンを X-CSRF-Token ヘッダで送る
let csrfToken: string | null = null

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' })
  const data = await res.json()
  csrfToken = data.csrfToken
  return csrfToken as string
}

export class ApiError extends Error {
  status: number
  errors?: Record<string, string[]>
  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

type Options = { method?: string; body?: unknown }

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = await ensureCsrfToken()
  }

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // CSRFトークンが失効している場合は次回再取得させる
    if (res.status === 422) csrfToken = null
    const message =
      (data && (data.error as string)) ?? 'エラーが発生しました。時間をおいて再度お試しください。'
    throw new ApiError(res.status, message, data?.errors)
  }
  return data as T
}

export function resetCsrfToken() {
  csrfToken = null
}
