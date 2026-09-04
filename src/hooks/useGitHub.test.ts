import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useGitHub } from './useGitHub'
import { GitHubClient } from '../lib/github'
import { loadToken, saveToken } from '../lib/storage'
import { makeBranch, makeOrg, makeRepo, makeUser, stubFetch } from '../test/factories'

const TOKEN = 'ghp_' + 'a'.repeat(36)

function harness(routes: Parameters<typeof stubFetch>[0]) {
  const fetchImpl = stubFetch(routes)
  const hook = renderHook(() =>
    useGitHub({ createClient: (token) => new GitHubClient(token, fetchImpl) }),
  )
  return { hook, fetchImpl }
}

const happyRoutes = {
  '/user/orgs': { body: [makeOrg({ login: 'mevijays' })] },
  '/user/starred/': { status: 404 as const, body: { message: 'not starred' } },
  '/user': { body: makeUser() },
  '/orgs/': { body: [makeRepo({ id: 1, name: 'infra' }), makeRepo({ id: 2, name: 'web' })] },
}

async function connected(routes: Parameters<typeof stubFetch>[0] = happyRoutes) {
  const { hook, fetchImpl } = harness(routes)
  await act(async () => {
    await hook.result.current.connect(TOKEN)
  })
  return { hook, fetchImpl }
}

describe('useGitHub connect', () => {
  it('loads the viewer and orgs and persists the token', async () => {
    const { hook } = await connected()

    expect(hook.result.current.state.viewer?.login).toBe('octocat')
    expect(hook.result.current.state.orgs).toHaveLength(1)
    expect(hook.result.current.state.authError).toBeNull()
    expect(loadToken()).toBe(TOKEN)
  })

  it('records an auth error and keeps no token', async () => {
    const { hook } = await connected({
      '/user': { status: 401, body: { message: 'Bad credentials' } },
    })

    expect(hook.result.current.state.viewer).toBeNull()
    expect(hook.result.current.state.token).toBeNull()
    expect(hook.result.current.state.authError).toContain('Bad credentials')
    expect(loadToken()).toBeNull()
  })

  it('rehydrates a stored token on mount', () => {
    saveToken(TOKEN)
    const { hook } = harness(happyRoutes)
    expect(hook.result.current.state.token).toBe(TOKEN)
  })

  it('clears everything on disconnect', async () => {
    const { hook } = await connected()
    act(() => hook.result.current.disconnect())

    expect(hook.result.current.state.viewer).toBeNull()
    expect(hook.result.current.state.orgs).toEqual([])
    expect(loadToken()).toBeNull()
  })
})

describe('useGitHub org and repo selection', () => {
  it('loads repos for the selected org', async () => {
    const { hook } = await connected()
    await act(async () => {
      await hook.result.current.selectOrg('mevijays')
    })

    expect(hook.result.current.state.selectedOrg).toBe('mevijays')
    expect(hook.result.current.state.repos).toHaveLength(2)
    expect(hook.result.current.state.loadingRepos).toBe(false)
  })

  it('reports a repo listing failure', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/orgs/': { status: 403, body: { message: 'SAML enforcement' } },
    })
    await act(async () => {
      await hook.result.current.selectOrg('mevijays')
    })

    expect(hook.result.current.state.repos).toEqual([])
    expect(hook.result.current.state.actionError).toContain('SAML enforcement')
  })

  it('refreshes the current org', async () => {
    const { hook, fetchImpl } = await connected()
    await act(async () => {
      await hook.result.current.selectOrg('mevijays')
    })
    const before = fetchImpl.calls.length
    await act(async () => {
      await hook.result.current.refreshRepos()
    })
    expect(fetchImpl.calls.length).toBeGreaterThan(before)
  })

  it('does nothing when refreshing with no org selected', async () => {
    const { hook, fetchImpl } = await connected()
    const before = fetchImpl.calls.length
    await act(async () => {
      await hook.result.current.refreshRepos()
    })
    expect(fetchImpl.calls).toHaveLength(before)
  })

  it('resolves the star state of the selected repo', async () => {
    const { hook } = await connected({ ...happyRoutes, '/user/starred/': { status: 204 } })
    await act(async () => {
      await hook.result.current.selectRepo(makeRepo())
    })
    await waitFor(() => expect(hook.result.current.state.starred).toBe(true))
  })

  it('records an error when the star check fails', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/user/starred/': { status: 500, body: { message: 'boom' } },
    })
    await act(async () => {
      await hook.result.current.selectRepo(makeRepo())
    })
    await waitFor(() => expect(hook.result.current.state.actionError).toContain('boom'))
  })
})

describe('useGitHub repo actions', () => {
  it('stars and then unstars a repo', async () => {
    const { hook, fetchImpl } = await connected({
      ...happyRoutes,
      '/user/starred/': [{ status: 404 }, { status: 204 }, { status: 204 }],
    })
    const repo = makeRepo()
    await act(async () => {
      await hook.result.current.selectRepo(repo)
    })
    await act(async () => {
      await hook.result.current.toggleStar(repo)
    })

    expect(hook.result.current.state.starred).toBe(true)
    expect(hook.result.current.state.notice).toContain('Starred mevijays/infra')

    await act(async () => {
      await hook.result.current.toggleStar(repo)
    })
    expect(hook.result.current.state.starred).toBe(false)
    expect(hook.result.current.state.notice).toContain('Removed star')
    expect(fetchImpl.calls.some((call) => call.init?.method === 'DELETE')).toBe(true)
  })

  it('surfaces a star failure', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/user/starred/': { status: 403, body: { message: 'forbidden' } },
    })
    await act(async () => {
      await hook.result.current.toggleStar(makeRepo())
    })
    expect(hook.result.current.state.actionError).toContain('forbidden')
    expect(hook.result.current.state.busy).toBeNull()
  })

  it('loads branches and pluralizes the notice', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/branches': { body: [makeBranch({ name: 'main' }), makeBranch({ name: 'dev' })] },
    })
    await act(async () => {
      await hook.result.current.loadBranches(makeRepo())
    })

    expect(hook.result.current.state.branches).toHaveLength(2)
    expect(hook.result.current.state.notice).toBe('Loaded 2 branches.')
  })

  it('uses the singular form for one branch', async () => {
    const { hook } = await connected({ ...happyRoutes, '/branches': { body: [makeBranch()] } })
    await act(async () => {
      await hook.result.current.loadBranches(makeRepo())
    })
    expect(hook.result.current.state.notice).toBe('Loaded 1 branch.')
  })

  it('creates an issue', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/issues': { status: 201, body: { number: 12, title: 'Bug', html_url: 'u', state: 'open' } },
    })
    await act(async () => {
      await hook.result.current.createIssue(makeRepo(), 'Bug', 'body')
    })
    expect(hook.result.current.state.notice).toBe('Created issue #12: Bug')
  })

  it('reports an issue failure', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/issues': { status: 410, body: { message: 'Issues are disabled' } },
    })
    await act(async () => {
      await hook.result.current.createIssue(makeRepo(), 'Bug', '')
    })
    expect(hook.result.current.state.actionError).toContain('Issues are disabled')
  })

  it('saves topics and updates the cached repo', async () => {
    const { hook } = await connected({ ...happyRoutes, '/topics': { body: { names: ['aws'] } } })
    await act(async () => {
      await hook.result.current.selectOrg('mevijays')
    })
    await act(async () => {
      await hook.result.current.saveTopics(makeRepo({ id: 1 }), ['aws'])
    })

    expect(hook.result.current.state.notice).toBe('Saved 1 topic.')
    expect(hook.result.current.state.repos[0].topics).toEqual(['aws'])
  })

  it('pluralizes multiple topics', async () => {
    const { hook } = await connected({ ...happyRoutes, '/topics': { body: { names: ['a', 'b'] } } })
    await act(async () => {
      await hook.result.current.saveTopics(makeRepo(), ['a', 'b'])
    })
    expect(hook.result.current.state.notice).toBe('Saved 2 topics.')
  })

  it('saves the description across the list and the selection', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/repos/': { body: makeRepo({ id: 1, description: 'Fresh' }) },
    })
    await act(async () => {
      await hook.result.current.selectOrg('mevijays')
    })
    const repo = makeRepo({ id: 1 })
    await act(async () => {
      await hook.result.current.selectRepo(repo)
    })
    await act(async () => {
      await hook.result.current.saveDescription(repo, 'Fresh')
    })

    expect(hook.result.current.state.notice).toBe('Description updated.')
    expect(hook.result.current.state.repos[0].description).toBe('Fresh')
    expect(hook.result.current.state.selectedRepo?.description).toBe('Fresh')
  })

  it('leaves other repos untouched when saving a description', async () => {
    const { hook } = await connected({
      ...happyRoutes,
      '/repos/': { body: makeRepo({ id: 2, description: 'Only me' }) },
    })
    await act(async () => {
      await hook.result.current.selectOrg('mevijays')
    })
    await act(async () => {
      await hook.result.current.saveDescription(makeRepo({ id: 2, name: 'web' }), 'Only me')
    })
    expect(hook.result.current.state.repos[0].description).toBe('Terraform modules')
    expect(hook.result.current.state.repos[1].description).toBe('Only me')
  })
})

describe('useGitHub without a client', () => {
  it('ignores every action before connecting', async () => {
    const { hook, fetchImpl } = harness(happyRoutes)
    const repo = makeRepo()

    await act(async () => {
      await hook.result.current.selectOrg('mevijays')
      await hook.result.current.toggleStar(repo)
      await hook.result.current.loadBranches(repo)
      await hook.result.current.createIssue(repo, 't', 'b')
      await hook.result.current.saveTopics(repo, ['a'])
      await hook.result.current.saveDescription(repo, 'd')
    })

    expect(fetchImpl.calls).toHaveLength(0)
    expect(hook.result.current.state.notice).toBeNull()
  })

  it('still records the repo selection without a client', async () => {
    const { hook } = harness(happyRoutes)
    await act(async () => {
      await hook.result.current.selectRepo(makeRepo({ id: 9 }))
    })
    expect(hook.result.current.state.selectedRepo?.id).toBe(9)
    expect(hook.result.current.state.starred).toBeNull()
  })
})
