import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoToolbar } from './RepoToolbar'

function setup(overrides: Partial<Parameters<typeof RepoToolbar>[0]> = {}) {
  const props = {
    query: '',
    sort: 'updated' as const,
    count: 3,
    total: 10,
    onQueryChange: vi.fn(),
    onSortChange: vi.fn(),
    onRefresh: vi.fn(),
    busy: false,
    ...overrides,
  }
  render(<RepoToolbar {...props} />)
  return props
}

describe('RepoToolbar', () => {
  it('shows the filtered count', () => {
    setup()
    expect(screen.getByText('3 of 10')).toBeInTheDocument()
  })

  it('reports query changes', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.type(screen.getByLabelText('Filter repositories'), 'ab')
    expect(props.onQueryChange).toHaveBeenCalledTimes(2)
  })

  it('reports sort changes', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.selectOptions(screen.getByLabelText('Sort'), 'stars')
    expect(props.onSortChange).toHaveBeenCalledWith('stars')
  })

  it('triggers a refresh', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(props.onRefresh).toHaveBeenCalled()
  })

  it('disables refresh while busy', () => {
    setup({ busy: true })
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeDisabled()
  })
})
