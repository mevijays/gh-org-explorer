import type { GitHubBranch, GitHubOrg, GitHubRepo, GitHubUser } from '../lib/types'

export function makeUser(overrides: Partial<GitHubUser> = {}): GitHubUser {
  return {
    login: 'octocat',
    name: 'The Octocat',
    avatar_url: 'https://example.test/octocat.png',
    html_url: 'https://github.com/octocat',
    public_repos: 8,
    ...overrides,
  }
}

export function makeOrg(overrides: Partial<GitHubOrg> = {}): GitHubOrg {
  return {
    id: 1,
    login: 'mevijays',
    description: 'Platform engineering',
    avatar_url: 'https://example.test/org.png',
    ...overrides,
  }
}

export function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 100,
    name: 'infra',
    full_name: 'mevijays/infra',
    description: 'Terraform modules',
    html_url: 'https://github.com/mevijays/infra',
    private: false,
    archived: false,
    fork: false,
    language: 'HCL',
    stargazers_count: 12,
    forks_count: 3,
    open_issues_count: 2,
    default_branch: 'main',
    topics: ['terraform', 'aws'],
    updated_at: '2026-08-30T10:00:00Z',
    ...overrides,
  }
}

export function makeBranch(overrides: Partial<GitHubBranch> = {}): GitHubBranch {
  return {
    name: 'main',
    protected: true,
    commit: { sha: 'abc1234' },
    ...overrides,
  }
}

/** Builds a `fetch` stand-in that answers from a path → response map. */
export interface StubRoute {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

export function stubFetch(routes: Record<string, StubRoute | StubRoute[]>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const counters: Record<string, number> = {}

  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const key = Object.keys(routes).find((candidate) => url.includes(candidate))
    if (key === undefined) {
      return new Response(JSON.stringify({ message: 'no stub' }), { status: 501 })
    }
    const entry = routes[key]
    const route = Array.isArray(entry)
      ? entry[Math.min(counters[key] ?? 0, entry.length - 1)]
      : entry
    counters[key] = (counters[key] ?? 0) + 1

    const status = route.status ?? 200
    const headers = new Headers({
      'content-type': 'application/json',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4999',
      'x-ratelimit-reset': '1780000000',
      ...route.headers,
    })
    if (status === 204) return new Response(null, { status, headers })
    return new Response(JSON.stringify(route.body ?? {}), { status, headers })
  }) as typeof fetch

  return Object.assign(impl, { calls })
}
