import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchMessages } from '../messageSearches'
import { ApiError } from '../client'

describe('searchMessages', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/v1/auth/csrf') {
          return Promise.resolve({
            json: () => Promise.resolve({ csrfToken: 'test-token' }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              messages: [],
              query: '',
              total_count: 0,
            }),
        } as Response)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('正しいworkspaceIdを含むURLでGETする', async () => {
    await searchMessages(10, 'test')
    const fetchMock = vi.mocked(fetch)
    const call = fetchMock.mock.calls.find(([url]) =>
      (url as string).startsWith('/api/v1/workspaces/10/messages/search'),
    )
    expect(call).toBeDefined()
    expect(call?.[1]?.method ?? 'GET').toBe('GET')
  })

  it('qをURLエンコードして送信する', async () => {
    await searchMessages(10, '障害 対応')
    const fetchMock = vi.mocked(fetch)
    const call = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes('/workspaces/10/messages/search'),
    )
    const url = call?.[0] as string
    const query = new URL(url, 'http://localhost').searchParams.get('q')
    expect(query).toBe('障害 対応')
  })

  it('日本語検索語を送信できる', async () => {
    await searchMessages(10, '検索テスト')
    const fetchMock = vi.mocked(fetch)
    const call = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes('/workspaces/10/messages/search'),
    )
    const url = call?.[0] as string
    const query = new URL(url, 'http://localhost').searchParams.get('q')
    expect(query).toBe('検索テスト')
  })

  it('空白や%や_を含む検索語が壊れずに送信できる', async () => {
    await searchMessages(10, '100% foo_bar')
    const fetchMock = vi.mocked(fetch)
    const call = fetchMock.mock.calls.find(([url]) =>
      (url as string).includes('/workspaces/10/messages/search'),
    )
    const url = call?.[0] as string
    const query = new URL(url, 'http://localhost').searchParams.get('q')
    expect(query).toBe('100% foo_bar')
  })

  it('レスポンスを返す', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/v1/auth/csrf') {
          return Promise.resolve({
            json: () => Promise.resolve({ csrfToken: 'test-token' }),
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              messages: [
                {
                  id: 10,
                  channel: { id: 3, name: 'general' },
                  user: { id: 2, name: '山田' },
                  body: '障害対応を開始します',
                  created_at: '2026-01-01T00:00:00Z',
                  updated_at: '2026-01-01T00:00:00Z',
                  is_edited: false,
                },
              ],
              query: '障害',
              total_count: 1,
            }),
        } as Response)
      }),
    )
    const result = await searchMessages(10, '障害')
    expect(result.total_count).toBe(1)
    expect(result.messages[0].body).toBe('障害対応を開始します')
    expect(result.query).toBe('障害')
  })

  it('APIエラーを呼び出し元へ伝える', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/v1/auth/csrf') {
          return Promise.resolve({
            json: () => Promise.resolve({ csrfToken: 'test-token' }),
          } as Response)
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'ワークスペースが見つかりません。' }),
        } as Response)
      }),
    )
    await expect(searchMessages(999, 'test')).rejects.toBeInstanceOf(ApiError)
  })
})
