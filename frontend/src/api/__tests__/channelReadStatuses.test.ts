import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { updateChannelReadStatus } from '../channelReadStatuses'
import { ApiError } from '../client'

describe('updateChannelReadStatus', () => {
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
              read_status: { channel_id: 3, last_read_message_id: 10, unread_count: 0 },
            }),
        } as Response)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('正しいworkspaceId、channelIdでPATCHする', async () => {
    await updateChannelReadStatus(10, 3)
    const fetchMock = vi.mocked(fetch)
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/workspaces/10/channels/3/read')
    expect(call).toBeDefined()
    expect(call?.[1]?.method).toBe('PATCH')
  })

  it('リクエストボディを送らない', async () => {
    await updateChannelReadStatus(10, 3)
    const fetchMock = vi.mocked(fetch)
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/workspaces/10/channels/3/read')
    expect(call?.[1]?.body).toBeUndefined()
  })

  it('成功レスポンスを返す', async () => {
    const result = await updateChannelReadStatus(10, 3)
    expect(result).toEqual({
      read_status: { channel_id: 3, last_read_message_id: 10, unread_count: 0 },
    })
  })

  it('エラー時に適切にrejectする', async () => {
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
          json: () => Promise.resolve({ error: 'チャンネルが見つかりません。' }),
        } as Response)
      }),
    )
    await expect(updateChannelReadStatus(10, 999)).rejects.toBeInstanceOf(ApiError)
  })
})
