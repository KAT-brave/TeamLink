import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Workspaces } from '../Workspaces'
import * as api from '../../api/workspaces'
import { ApiError } from '../../api/client'

vi.mock('../../api/workspaces')

function renderPage() {
  return render(
    <MemoryRouter>
      <Workspaces />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listWorkspaces).mockResolvedValue([
    { id: 1, name: 'Alpha', owner_id: 1 },
  ])
})

describe('Workspaces', () => {
  it('所属ワークスペース一覧を表示する', async () => {
    renderPage()
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('新規作成すると一覧を再取得する', async () => {
    vi.mocked(api.createWorkspace).mockResolvedValue({ id: 2, name: 'Beta', owner_id: 1 })
    renderPage()
    await screen.findByText('Alpha')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('ワークスペース名'), 'Beta')
    await user.click(screen.getByRole('button', { name: '作成' }))

    expect(api.createWorkspace).toHaveBeenCalledWith('Beta')
    expect(api.listWorkspaces).toHaveBeenCalledTimes(2)
  })

  it('招待コード参加に失敗するとエラーを表示する', async () => {
    vi.mocked(api.joinWorkspace).mockRejectedValue(new ApiError(404, '招待コードが無効です。'))
    renderPage()
    await screen.findByText('Alpha')
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('招待コードで参加'), 'bad')
    await user.click(screen.getByRole('button', { name: '参加' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('招待コードが無効です。')
  })
})
