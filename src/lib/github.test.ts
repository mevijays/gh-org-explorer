import { describe, expect, it } from 'vitest'
import { GitHubClient } from './github'
import { GitHubApiError } from './errors'
import { makeBranch, makeOrg, makeRepo, makeUser, stubFetch } from '../test/factories'

describe('GitHubClient reads', () => {
  it('fetches the viewer with auth headers', async () => {
    const fetchImpl = stubFetch({ '/user': { body: makeUser() } })
    const client = new GitHubClient('  ghp_token  ', fetchImpl)

    const viewer = await client.getViewer()

    expect(viewer.login).toBe('octocat')
    const headers = new Headers(fetchImpl.calls[0].init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer ghp_token')
    expect(headers.get('X-GitHub-Api-Version')).toBe('2022-11-28')
  })

  it('lists organizations', async () => {
    const fetchImpl = stubFetch({ '/user/orgs': { body: [makeOrg()] } })
    const orgs = await new GitHubClient('t', fetchImpl).listOrgs()
    expect(orgs).toHaveLength(1)
    expect(orgs[0].login).toBe('mevijays')
  })

  it('lists org repos on the requested page', async () => {
    const fetchImpl = stubFetch({ '/orgs/': { body: [makeRepo()] } })
    await new GitHubClient('t', fetchImpl).listOrgRepos('me vijays', 3)
    expect(fetchImpl.calls[0].url).toContain('/orgs/me%20vijays/repos')
    expect(fetchImpl.calls[0].url).toContain('page=3')
  })

  it('lists branches', async () => {
    const fetchImpl = stubFetch({ '/branches': { body: [makeBranch()] } })
    const branches = await new GitHubClient('t', fetchImpl).listBranches('mevijays', 'infra')
    expect(branches[0].name).toBe('main')
  })

  it('records rate limit headers', async () => {
    const fetchImpl = stubFetch({ '/user': { body: makeUser() } })
    const client = new GitHubClient('t', fetchImpl)
    expect(client.rateLimit).toBeNull()
    await client.getViewer()
    expect(client.rateLimit).toEqual({ limit: 5000, remaining: 4999, reset: 1780000000 })
  })

  it('leaves rate limit unset when headers are absent', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(makeUser()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch
    const client = new GitHubClient('t', fetchImpl)
    await client.getViewer()
    expect(client.rateLimit).toBeNull()
  })
})

describe('GitHubClient star state', () => {
  it('reports a starred repo from a 204', async () => {
    const fetchImpl = stubFetch({ '/user/starred/': { status: 204 } })
    await expect(new GitHubClient('t', fetchImpl).isStarred('o', 'r')).resolves.toBe(true)
  })

  it('reports an unstarred repo from a 404', async () => {
    const fetchImpl = stubFetch({ '/user/starred/': { status: 404, body: { message: 'nope' } } })
    await expect(new GitHubClient('t', fetchImpl).isStarred('o', 'r')).resolves.toBe(false)
  })

  it('stars with PUT and unstars with DELETE', async () => {
    const fetchImpl = stubFetch({ '/user/starred/': { status: 204 } })
    const client = new GitHubClient('t', fetchImpl)
    await client.setStarred('o', 'r', true)
    await client.setStarred('o', 'r', false)
    expect(fetchImpl.calls.map((call) => call.init?.method)).toEqual(['PUT', 'DELETE'])
  })
})

describe('GitHubClient writes', () => {
  it('creates an issue with a JSON body', async () => {
    const fetchImpl = stubFetch({
      '/issues': { status: 201, body: { number: 7, title: 'Bug', html_url: 'u', state: 'open' } },
    })
    const issue = await new GitHubClient('t', fetchImpl).createIssue('o', 'r', 'Bug', 'details')

    expect(issue.number).toBe(7)
    const call = fetchImpl.calls[0]
    expect(call.init?.method).toBe('POST')
    expect(JSON.parse(String(call.init?.body))).toEqual({ title: 'Bug', body: 'details' })
    expect(new Headers(call.init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('replaces topics with PUT', async () => {
    const fetchImpl = stubFetch({ '/topics': { body: { names: ['a', 'b'] } } })
    const result = await new GitHubClient('t', fetchImpl).updateTopics('o', 'r', ['a', 'b'])
    expect(result.names).toEqual(['a', 'b'])
    expect(fetchImpl.calls[0].init?.method).toBe('PUT')
  })

  it('patches the description', async () => {
    const fetchImpl = stubFetch({ '/repos/': { body: makeRepo({ description: 'new' }) } })
    const repo = await new GitHubClient('t', fetchImpl).updateDescription('o', 'r', 'new')
    expect(repo.description).toBe('new')
    expect(fetchImpl.calls[0].init?.method).toBe('PATCH')
  })
})

describe('GitHubClient error handling', () => {
  it('throws a GitHubApiError carrying the API message', async () => {
    const fetchImpl = stubFetch({ '/user': { status: 401, body: { message: 'Bad credentials' } } })
    const error = await new GitHubClient('t', fetchImpl).getViewer().catch((e) => e)

    expect(error).toBeInstanceOf(GitHubApiError)
    expect(error.message).toBe('Bad credentials')
    expect(error.status).toBe(401)
  })

  it('falls back to a generic message when the body is not JSON', async () => {
    const fetchImpl = (async () => new Response('<html>oops</html>', { status: 503 })) as typeof fetch
    const error = await new GitHubClient('t', fetchImpl).getViewer().catch((e) => e)
    expect(error.message).toBe('GitHub responded with 503')
  })

  it('falls back when the JSON body has no message', async () => {
    const fetchImpl = stubFetch({ '/user': { status: 500, body: { error: 'x' } } })
    const error = await new GitHubClient('t', fetchImpl).getViewer().catch((e) => e)
    expect(error.message).toBe('GitHub responded with 500')
  })

  it('still throws for non-404 failures on boolean endpoints', async () => {
    const fetchImpl = stubFetch({ '/user/starred/': { status: 403, body: { message: 'blocked' } } })
    await expect(new GitHubClient('t', fetchImpl).isStarred('o', 'r')).rejects.toThrow('blocked')
  })

  it('builds absolute URLs from the API base', async () => {
    const fetchImpl = stubFetch({ '/user': { body: makeUser() } })
    await new GitHubClient('t', fetchImpl).getViewer()
    expect(fetchImpl.calls[0].url).toBe('https://api.github.com/user')
  })
})
