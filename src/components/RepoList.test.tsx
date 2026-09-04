import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoList } from './RepoList'
import { makeRepo } from '../test/factories'

describe('RepoList', () => {
  it('shows an empty-filter message', () => {
    render(<RepoList repos={[]} selectedId={null} onSelect={vi.fn()} />)
    expect(screen.getByText(/No repositories match/)).toBeInTheDocument()
  })

  it('renders badges for private, archived and forked repos', () => {
    render(
      <RepoList
        repos={[makeRepo({ id: 1, name: 'secret', private: true, archived: true, fork: true })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('private')).toBeInTheDocument()
    expect(screen.getByText('archived')).toBeInTheDocument()
    expect(screen.getByText('fork')).toBeInTheDocument()
  })

  it('falls back to a placeholder description', () => {
    render(
      <RepoList
        repos={[makeRepo({ id: 2, description: null, language: null })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('No description')).toBeInTheDocument()
  })

  it('marks the selected repo and reports clicks', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const repo = makeRepo({ id: 5, name: 'infra' })
    render(<RepoList repos={[repo]} selectedId={5} onSelect={onSelect} />)

    const button = screen.getByRole('button', { name: /infra/ })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await user.click(button)
    expect(onSelect).toHaveBeenCalledWith(repo)
  })
})
