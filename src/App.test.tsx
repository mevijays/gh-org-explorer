import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { GitHubClient } from './lib/github'
import { makeOrg, makeRepo, makeUser, stubFetch } from './test/factories'

const TOKEN = 'ghp_' + 'a'.repeat(36)

const baseRoutes = {
  '/user/orgs': { body: [makeOrg({ login: 'mevijays' }), makeOrg({ id: 2, login: 'vijayslab' })] },
  '/user/starred/': { status: 404 as const, body: { message: 'not starred' } },
  '/user': { body: makeUser() },
  '/orgs/': {
    body: [
      makeRepo({ id: 1, name: 'infra', stargazers_count: 30, updated_at: '2026-01-01T00:00:00Z' }),
      makeRepo({
        id: 2,
        name: 'website',
        full_name: 'mevijays/website',
        language: 'TypeScript',
        stargazers_count: 90,
        updated_at: '2026-08-01T00:00:00Z',
      }),
    ],
  },
}

function renderApp(routes: Parameters<typeof stubFetch>[0] = baseRoutes) {
  const fetchImpl = stubFetch(routes)
  render(<App createClient={(token) => new GitHubClient(token, fetchImpl)} />)
  return fetchImpl
}

async function signIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Personal access token'), TOKEN)
  await user.click(screen.getByRole('button', { name: 'Connect' }))
  await screen.findByRole('button', { name: 'Sign out' })
}

describe('App sign-in', () => {
  it('shows the token form first', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'GitHub Org Explorer' })).toBeInTheDocument()
    expect(screen.getByLabelText('Personal access token')).toBeInTheDocument()
  })

  it('signs in and lists organizations', async () => {
    const user = userEvent.setup()
    renderApp()
    await signIn(user)

    expect(screen.getByText('The Octocat')).toBeInTheDocument()
    expect(screen.getByText('Organizations (2)')).toBeInTheDocument()
    expect(screen.getByText('Pick an organization to begin.')).toBeInTheDocument()
  })

  it('keeps the form and shows the error on a bad token', async () => {
    const user = userEvent.setup()
    renderApp({ '/user': { status: 401, body: { message: 'Bad credentials' } } })

    await user.type(screen.getByLabelText('Personal access token'), TOKEN)
    await user.click(screen.getByRole('button', { name: 'Connect' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bad credentials')
    expect(screen.getByLabelText('Personal access token')).toBeInTheDocument()
  })

  it('signs back out', async () => {
    const user = userEvent.setup()
    renderApp()
    await signIn(user)
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByLabelText('Personal access token')).toBeInTheDocument()
  })
})

describe('App repository browsing', () => {
  it('lists repositories for the chosen org with stats', async () => {
    const user = userEvent.setup()
    renderApp()
    await signIn(user)
    await user.click(screen.getByRole('button', { name: /mevijays/ }))

    expect(await screen.findByText('Repositories in mevijays')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /infra/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /website/ })).toBeInTheDocument()

    const stats = screen.getByRole('group', { name: 'Repository statistics' })
    expect(within(stats).getByText('120')).toBeInTheDocument()
  })

  it('filters the list', async () => {
    const user = userEvent.setup()
    renderApp()
    await signIn(user)
    await user.click(screen.getByRole('button', { name: /mevijays/ }))
    await screen.findByRole('button', { name: /website/ })

    await user.type(screen.getByLabelText('Filter repositories'), 'website')

    expect(screen.queryByRole('button', { name: /infra/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('re-sorts by stars', async () => {
    const user = userEvent.setup()
    renderApp()
    await signIn(user)
    await user.click(screen.getByRole('button', { name: /mevijays/ }))
    await screen.findByRole('button', { name: /website/ })

    await user.selectOptions(screen.getByLabelText('Sort'), 'stars')

    const names = screen
      .getAllByRole('button', { pressed: false })
      .map((node) => node.textContent ?? '')
      .filter((text) => text.includes('★'))
    expect(names[0]).toContain('website')
  })

  it('refreshes the repository list', async () => {
    const user = userEvent.setup()
    const fetchImpl = renderApp()
    await signIn(user)
    await user.click(screen.getByRole('button', { name: /mevijays/ }))
    await screen.findByRole('button', { name: /website/ })

    const before = fetchImpl.calls.length
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(fetchImpl.calls.length).toBeGreaterThan(before))
  })

  it('reports a failure to list repositories', async () => {
    const user = userEvent.setup()
    renderApp({ ...baseRoutes, '/orgs/': { status: 403, body: { message: 'SAML enforcement' } } })
    await signIn(user)
    await user.click(screen.getByRole('button', { name: /mevijays/ }))

    expect(await screen.findByText(/No repositories match/)).toBeInTheDocument()
  })
})

describe('App repository actions', () => {
  async function openRepo(user: ReturnType<typeof userEvent.setup>) {
    await signIn(user)
    await user.click(screen.getByRole('button', { name: /mevijays/ }))
    await user.click(await screen.findByRole('button', { name: /infra/ }))
    await screen.findByRole('heading', { name: 'mevijays/infra' })
  }

  it('prompts to select a repo before showing the detail panel', async () => {
    const user = userEvent.setup()
    renderApp()
    await signIn(user)
    expect(screen.getByText(/Select a repository to star it/)).toBeInTheDocument()
  })

  it('stars a repository end to end', async () => {
    const user = userEvent.setup()
    renderApp({ ...baseRoutes, '/user/starred/': [{ status: 404 }, { status: 204 }] })
    await openRepo(user)

    await user.click(await screen.findByRole('button', { name: '☆ Star' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Starred mevijays/infra')
    expect(screen.getByRole('button', { name: '★ Unstar' })).toBeInTheDocument()
  })

  it('lists branches end to end', async () => {
    const user = userEvent.setup()
    renderApp({
      ...baseRoutes,
      '/branches': {
        body: [
          { name: 'main', protected: true, commit: { sha: 'a' } },
          { name: 'dev', protected: false, commit: { sha: 'b' } },
        ],
      },
    })
    await openRepo(user)

    await user.click(screen.getByRole('button', { name: 'List branches' }))

    expect(await screen.findByText('dev')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loaded 2 branches.')
  })

  it('creates an issue end to end', async () => {
    const user = userEvent.setup()
    renderApp({
      ...baseRoutes,
      '/issues': { status: 201, body: { number: 42, title: 'Flaky test', html_url: 'u', state: 'open' } },
    })
    await openRepo(user)

    await user.type(screen.getByLabelText('Title'), 'Flaky test')
    await user.click(screen.getByRole('button', { name: 'Create issue' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Created issue #42: Flaky test')
  })

  it('saves topics end to end', async () => {
    const user = userEvent.setup()
    renderApp({ ...baseRoutes, '/topics': { body: { names: ['platform'] } } })
    await openRepo(user)

    const topics = screen.getByLabelText(/Topics/)
    await user.clear(topics)
    await user.type(topics, 'Platform')
    await user.click(screen.getByRole('button', { name: 'Save topics' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Saved 1 topic.')
  })

  it('saves a description end to end', async () => {
    const user = userEvent.setup()
    renderApp({ ...baseRoutes, '/repos/': { body: makeRepo({ id: 1, description: 'Platform infra' }) } })
    await openRepo(user)

    const description = screen.getByLabelText('Description')
    await user.clear(description)
    await user.type(description, 'Platform infra')
    await user.click(screen.getByRole('button', { name: 'Save description' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Description updated.')
  })

  it('surfaces an action failure in the detail panel', async () => {
    const user = userEvent.setup()
    renderApp({
      ...baseRoutes,
      '/branches': { status: 404, body: { message: 'Not Found' } },
    })
    await openRepo(user)

    await user.click(screen.getByRole('button', { name: 'List branches' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Not Found')
  })
})
