import { GitHubApiError } from './errors'
import type {
  GitHubBranch,
  GitHubIssue,
  GitHubOrg,
  GitHubRepo,
  GitHubUser,
  RateLimit,
} from './types'

export const GITHUB_API = 'https://api.github.com'

interface RequestOptions {
  method?: string
  body?: unknown
  /** Treat a 404 as `false` instead of throwing (used by boolean state checks). */
  booleanStatus?: boolean
}

/**
 * Thin, typed wrapper over the GitHub REST API.
 *
 * Every method funnels through `request` so authentication, error shaping and
 * rate-limit bookkeeping live in exactly one place.
 */
export class GitHubClient {
  private readonly token: string
  private readonly fetchImpl: typeof fetch
  private lastRateLimit: RateLimit | null = null

  constructor(token: string, fetchImpl: typeof fetch = fetch) {
    this.token = token.trim()
    // `fetch` must be called with the global object as its receiver. Storing it
    // on the instance and calling `this.fetchImpl(...)` would pass the client
    // as the receiver instead, which browsers reject with
    // "Failed to execute 'fetch' on 'Window': Illegal invocation".
    this.fetchImpl = fetchImpl.bind(globalThis)
  }

  get rateLimit(): RateLimit | null {
    return this.lastRateLimit
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  private captureRateLimit(response: Response): void {
    const limit = response.headers.get('x-ratelimit-limit')
    const remaining = response.headers.get('x-ratelimit-remaining')
    const reset = response.headers.get('x-ratelimit-reset')
    if (limit === null || remaining === null || reset === null) return
    this.lastRateLimit = {
      limit: Number(limit),
      remaining: Number(remaining),
      reset: Number(reset),
    }
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, booleanStatus = false } = options
    const url = `${GITHUB_API}${path}`

    const init: RequestInit = { method, headers: this.headers() }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
      init.headers = { ...this.headers(), 'Content-Type': 'application/json' }
    }

    const response = await this.fetchImpl(url, init)
    this.captureRateLimit(response)

    if (booleanStatus) {
      if (response.status === 204) return true as T
      if (response.status === 404) return false as T
    }

    if (!response.ok) {
      throw new GitHubApiError(await describeFailure(response), response.status, url)
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  getViewer(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user')
  }

  listOrgs(): Promise<GitHubOrg[]> {
    return this.request<GitHubOrg[]>('/user/orgs?per_page=100')
  }

  listOrgRepos(org: string, page = 1): Promise<GitHubRepo[]> {
    return this.request<GitHubRepo[]>(
      `/orgs/${encodeURIComponent(org)}/repos?per_page=50&sort=updated&page=${page}`,
    )
  }

  listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.request<GitHubBranch[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
    )
  }

  isStarred(owner: string, repo: string): Promise<boolean> {
    return this.request<boolean>(
      `/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { booleanStatus: true },
    )
  }

  setStarred(owner: string, repo: string, starred: boolean): Promise<void> {
    return this.request<void>(
      `/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { method: starred ? 'PUT' : 'DELETE' },
    )
  }

  createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      { method: 'POST', body: { title, body } },
    )
  }

  updateTopics(owner: string, repo: string, topics: string[]): Promise<{ names: string[] }> {
    return this.request<{ names: string[] }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics`,
      { method: 'PUT', body: { names: topics } },
    )
  }

  updateDescription(owner: string, repo: string, description: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { method: 'PATCH', body: { description } },
    )
  }
}

async function describeFailure(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string }
    if (payload && typeof payload.message === 'string' && payload.message.length > 0) {
      return payload.message
    }
  } catch {
    // Body was empty or not JSON; fall through to the generic message.
  }
  return `GitHub responded with ${response.status}`
}
