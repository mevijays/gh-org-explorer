import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoDetail } from './RepoDetail'
import { makeBranch, makeRepo } from '../test/factories'

function setup(overrides: Partial<Parameters<typeof RepoDetail>[0]> = {}) {
  const props = {
    repo: makeRepo(),
    starred: false as boolean | null,
    branches: null,
    busy: null,
    notice: null,
    error: null,
    onToggleStar: vi.fn().mockResolvedValue(undefined),
    onLoadBranches: vi.fn().mockResolvedValue(undefined),
    onCreateIssue: vi.fn().mockResolvedValue(undefined),
    onSaveTopics: vi.fn().mockResolvedValue(undefined),
    onSaveDescription: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<RepoDetail {...props} />)
  return props
}

describe('RepoDetail header', () => {
  it('links to the repo on GitHub', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'mevijays/infra' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open on GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/mevijays/infra',
    )
  })

  it('surfaces a notice and an error', () => {
    setup({ notice: 'Starred it.', error: 'Nope.' })
    expect(screen.getByRole('status')).toHaveTextContent('Starred it.')
    expect(screen.getByRole('alert')).toHaveTextContent('Nope.')
  })
})

describe('RepoDetail star button', () => {
  it.each([
    [null, 'Checking star…'],
    [false, '☆ Star'],
    [true, '★ Unstar'],
  ])('renders %s as %s', (starred, label) => {
    setup({ starred: starred as boolean | null })
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  })

  it('calls the toggle handler', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: '☆ Star' }))
    expect(props.onToggleStar).toHaveBeenCalledWith(props.repo)
  })

  it('disables the button while starring', () => {
    setup({ busy: 'star' })
    expect(screen.getByRole('button', { name: '☆ Star' })).toBeDisabled()
  })
})

describe('RepoDetail branches', () => {
  it('loads branches on demand', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'List branches' }))
    expect(props.onLoadBranches).toHaveBeenCalledWith(props.repo)
  })

  it('shows a loading label while fetching', () => {
    setup({ busy: 'branches' })
    expect(screen.getByRole('button', { name: 'Loading branches…' })).toBeDisabled()
  })

  it('renders branches with protected and default badges', () => {
    setup({
      branches: [makeBranch({ name: 'main', protected: true }), makeBranch({ name: 'dev', protected: false })],
    })
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('dev')).toBeInTheDocument()
    expect(screen.getByText('protected')).toBeInTheDocument()
    expect(screen.getByText('default')).toBeInTheDocument()
  })
})

describe('RepoDetail issue form', () => {
  it('requires a title', async () => {
    const user = userEvent.setup()
    const props = setup()

    const submit = screen.getByRole('button', { name: 'Create issue' })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Title'), 'Broken build')
    expect(submit).toBeEnabled()
    expect(props.onCreateIssue).not.toHaveBeenCalled()
  })

  it('submits and clears the form', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.type(screen.getByLabelText('Title'), '  Broken build  ')
    await user.type(screen.getByLabelText('Body'), '  it fails  ')
    await user.click(screen.getByRole('button', { name: 'Create issue' }))

    expect(props.onCreateIssue).toHaveBeenCalledWith(props.repo, 'Broken build', 'it fails')
    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Body')).toHaveValue('')
  })

  it('ignores a whitespace-only title on Enter', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.type(screen.getByLabelText('Title'), '   {Enter}')
    expect(props.onCreateIssue).not.toHaveBeenCalled()
  })

  it('shows the creating state', () => {
    setup({ busy: 'issue' })
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled()
  })
})

describe('RepoDetail metadata', () => {
  it('prefills description and topics from the repo', () => {
    setup()
    expect(screen.getByLabelText('Description')).toHaveValue('Terraform modules')
    expect(screen.getByLabelText(/Topics/)).toHaveValue('terraform, aws')
  })

  it('prefills an empty description when none is set', () => {
    setup({ repo: makeRepo({ description: null, topics: [] }) })
    expect(screen.getByLabelText('Description')).toHaveValue('')
    expect(screen.getByLabelText(/Topics/)).toHaveValue('')
  })

  it('saves a trimmed description', async () => {
    const user = userEvent.setup()
    const props = setup()

    const input = screen.getByLabelText('Description')
    await user.clear(input)
    await user.type(input, '  Updated docs  ')
    await user.click(screen.getByRole('button', { name: 'Save description' }))

    expect(props.onSaveDescription).toHaveBeenCalledWith(props.repo, 'Updated docs')
  })

  it('saves parsed topics', async () => {
    const user = userEvent.setup()
    const props = setup()

    const input = screen.getByLabelText(/Topics/)
    await user.clear(input)
    await user.type(input, 'React, VITE react')
    await user.click(screen.getByRole('button', { name: 'Save topics' }))

    expect(props.onSaveTopics).toHaveBeenCalledWith(props.repo, ['react', 'vite'])
  })

  it('shows the description saving state', () => {
    setup({ busy: 'description' })
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('shows the topics saving state', () => {
    setup({ busy: 'topics' })
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })
})
